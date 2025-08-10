(function() {
  const resultsEl = document.getElementById('results');
  const searchEl = document.getElementById('search');
  const filters = document.querySelectorAll('.filters button[data-filter]');
  const last7Btn = document.getElementById('last7');
  const ocrToggle = document.getElementById('ocrToggle');

  let items = [];
  let cache = {};

  window.addEventListener('message', e => {
      const { type, payload } = e.data || {};
      if (type === 'SCAN_RESULTS') { 
          items = payload || []; 
          renderItems(); 
      }
      if (type === 'CACHE') { 
          cache = payload || {}; 
      }
      if (type === 'SUMMARY_RESULT') {
          const key = payload.key;
          cache[key] = payload.summary;
          // Store in extension storage
          if (typeof chrome !== 'undefined' && chrome.storage) {
              chrome.storage.local.set({ docuFind_cache: cache });
          }
          showSummaryInPreview(payload.summary);
      }
  });

  // Request existing cache from content script
  if (parent !== window) {
      parent.postMessage({ type: 'GET_CACHED' }, '*');
  }

  searchEl.addEventListener('input', renderItems);
  
  filters.forEach(b => b.addEventListener('click', () => {
      filters.forEach(x => x.classList.remove('active'));
      last7Btn.classList.remove('active');
      b.classList.add('active');
      renderItems();
  }));
  
  last7Btn.addEventListener('click', () => {
      filters.forEach(x => x.classList.remove('active'));
      last7Btn.classList.add('active');
      renderItems();
  });

  function renderItems() {
      const q = searchEl.value.trim().toLowerCase();
      const activeFilter = Array.from(filters).find(f => f.classList.contains('active'));
      const activeType = activeFilter ? activeFilter.dataset.filter : 'all';
      const isLast7 = last7Btn.classList.contains('active');
      const now = Date.now();
      
      const shown = items.filter(it => {
          // Filter by type
          if (activeType !== 'all' && it.type !== activeType) return false;
          
          // Filter by time (last 7 days)
          if (isLast7 && (now - it.timestamp) > (7 * 24 * 60 * 60 * 1000)) return false;
          
          // Filter by search query
          if (q) {
              const searchableText = [
                  it.name || '',
                  it.text || '',
                  it.href || '',
                  it.src || '',
                  it.alt || ''
              ].join(' ').toLowerCase();
              
              if (!searchableText.includes(q)) return false;
          }
          
          return true;
      });
      
      resultsEl.innerHTML = shown.length > 0 
          ? shown.map(renderItemHtml).join('') 
          : '<div style="padding:12px;color:#666">No items found</div>';
      
      // Attach click handlers
      resultsEl.querySelectorAll('.item').forEach(el => 
          el.addEventListener('click', onItemClick)
      );
  }

  function renderItemHtml(it) {
      const when = new Date(it.timestamp).toLocaleString();
      const title = it.name || it.text || it.href || it.src || 'Unknown';
      const truncatedTitle = title.length > 50 ? title.substring(0, 50) + '...' : title;
      const key = it.href || it.src || title;
      
      return `<div class="item" data-key="${encodeURIComponent(key)}">
          <div><strong>${escapeHtml(truncatedTitle)}</strong></div>
          <div class="meta">${it.type.toUpperCase()} • ${when}</div>
          <div class="preview" style="display:none"></div>
      </div>`;
  }

  function onItemClick(e) {
      const root = e.currentTarget;
      const key = decodeURIComponent(root.dataset.key);
      const item = items.find(i => {
          const itemKey = i.href || i.src || i.name || i.text;
          return itemKey === key;
      });
      
      if (!item) return;

      const preview = root.querySelector('.preview');
      if (preview.style.display === 'block') {
          preview.style.display = 'none';
          return;
      }
      
      // Close other previews
      document.querySelectorAll('.preview').forEach(p => p.style.display = 'none');
      
      preview.style.display = 'block';
      preview.innerHTML = '<em>Loading preview...</em>';

      if (item.type === 'document') {
          preview.innerHTML = `
              <div>Document: ${escapeHtml(item.name || item.href)}</div>
              <div><a target="_blank" href="${escapeHtml(item.href)}">Open Document</a></div>
              <div><button class="summ-btn">Summarize</button></div>
          `;
          preview.querySelector('.summ-btn').addEventListener('click', () => 
              requestSummary({ source: 'document', href: item.href })
          );
      } else if (item.type === 'image') {
          preview.innerHTML = `
              <div><img src="${escapeHtml(item.src)}" style="max-width:100%; max-height:200px;"/></div>
              <div><button class="ocr-btn">Extract text (OCR)</button></div>
          `;
          preview.querySelector('.ocr-btn').addEventListener('click', () => 
              doOCR(item.src, preview)
          );
      } else if (item.type === 'link') {
          preview.innerHTML = `
              <div><a target="_blank" href="${escapeHtml(item.href)}">Open link</a></div>
              <div><button class="summ-btn">Summarize</button></div>
          `;
          preview.querySelector('.summ-btn').addEventListener('click', () => 
              requestSummary({ source: 'link', href: item.href })
          );
      }
  }

  async function doOCR(src, previewEl) {
      if (!ocrToggle.checked) {
          alert('Enable OCR toggle first');
          return;
      }
      
      previewEl.innerHTML = '<div>Running OCR — this may take a moment...</div>';
      
      try {
          // Check if Tesseract is already loaded
          if (!window.Tesseract) {
              await loadTesseract();
          }
          
          const { createWorker } = window.Tesseract;
          const worker = await createWorker();
          await worker.loadLanguage('eng');
          await worker.initialize('eng');
          
          const result = await worker.recognize(src);
          const text = result.data.text;
          
          previewEl.innerHTML = `
              <pre style="white-space:pre-wrap; max-height:200px; overflow-y:auto;">${escapeHtml(text)}</pre>
              <div><button class="summ-btn">Summarize</button></div>
          `;
          previewEl.querySelector('.summ-btn').addEventListener('click', () => 
              requestSummary({ source: 'image', text })
          );
          
          await worker.terminate();
      } catch (error) {
          previewEl.innerHTML = `<div>OCR failed: ${error.message}</div>`;
      }
  }

  function loadTesseract() {
      return new Promise((resolve, reject) => {
          if (window.Tesseract) {
              resolve();
              return;
          }
          
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
      });
  }

  function requestSummary(payload) {
      // Check cache first
      const cacheKey = JSON.stringify({
          href: payload.href || null,
          snippet: (payload.text || '').slice(0, 80)
      });
      
      if (cache[cacheKey]) {
          showSummaryInPreview(cache[cacheKey]);
          return;
      }

      // Show loading state
      const activePreview = document.querySelector('.preview[style*="display: block"]');
      if (activePreview) {
          activePreview.innerHTML += '<div><em>Requesting summary...</em></div>';
      }

      // Send message to parent (content script)
      if (parent !== window) {
          parent.postMessage({ type: 'REQUEST_SUMMARY', payload }, '*');
      }
  }

  function showSummaryInPreview(summary) {
      const visiblePreview = document.querySelector('.preview[style*="display: block"]');
      if (!visiblePreview) return;

      const summaryHtml = `
          <div><strong>AI Summary</strong></div>
          <div style="white-space:pre-wrap; max-height:200px; overflow-y:auto; padding:8px; background:#f9f9f9; border-radius:4px; margin:8px 0;">
              ${escapeHtml(summary)}
          </div>
          <div style="margin-top:8px">
              <button class="copy-btn">Copy</button>
              <button class="download-btn">Download</button>
          </div>
      `;
      
      visiblePreview.innerHTML = summaryHtml;
      
      visiblePreview.querySelector('.copy-btn').addEventListener('click', () => {
          if (navigator.clipboard) {
              navigator.clipboard.writeText(summary);
          } else {
              // Fallback for older browsers
              const textArea = document.createElement('textarea');
              textArea.value = summary;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand('copy');
              document.body.removeChild(textArea);
          }
      });
      
      visiblePreview.querySelector('.download-btn').addEventListener('click', () => {
          const blob = new Blob([summary], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'summary.txt';
          a.click();
          URL.revokeObjectURL(url);
      });
  }

  function escapeHtml(s) {
      return String(s || '').replace(/[&<>"']/g, c => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
      }[c]));
  }
})();