(function(){
    const resultsEl = document.getElementById('results');
    const searchEl = document.getElementById('search');
    const filters = document.querySelectorAll('.filters button');
    const ocrToggle = document.getElementById('ocrToggle');
  
    let items = [];
    let cache = {};
  
    window.addEventListener('message', e=>{
      const {type, payload} = e.data || {};
      if(type === 'SCAN_RESULTS'){ items = payload || []; renderItems(); }
      if(type === 'CACHE'){ cache = payload || {}; }
    });
  
    // request existing cache from content script
    parent.postMessage({type:'GET_CACHED'}, '*');
  
    searchEl.addEventListener('input', renderItems);
    filters.forEach(b=> b.addEventListener('click', ()=>{ filters.forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderItems(); }));
    document.getElementById('last7').addEventListener('click', ()=>{ filters.forEach(x=>x.classList.remove('active')); document.getElementById('last7').classList.add('active'); renderItems(); });
  
    function renderItems(){
      const q = searchEl.value.trim().toLowerCase();
      const active = Array.from(filters).find(f=>f.classList.contains('active'))?.dataset?.filter || 'all';
      const now = Date.now();
      const shown = items.filter(it => {
        if(active !== 'all' && active !== 'document' && active !== 'image' && active !== 'link' && active !== undefined) {}
        if(active==='document' && it.type !== 'document') return false;
        if(active==='image' && it.type !== 'image') return false;
        if(active==='link' && it.type !== 'link') return false;
        if(document.getElementById('last7')?.classList.contains('active')){
          if((now - it.timestamp) > (7*24*60*60*1000)) return false;
        }
        if(q && !((it.name||'').toLowerCase().includes(q) || (it.text||'').toLowerCase().includes(q) || (it.href||'').toLowerCase().includes(q))) return false;
        return true;
      });
      resultsEl.innerHTML = shown.map(renderItemHtml).join('') || '<div style="padding:12px;color:#666">No items found</div>';
      // attach click handlers
      resultsEl.querySelectorAll('.item').forEach(el=> el.addEventListener('click', onItemClick));
    }
  
    function renderItemHtml(it){
      const when = new Date(it.timestamp).toLocaleString();
      const title = it.name || it.text || it.href || it.src || 'Unknown';
      return `<div class="item" data-key="${encodeURIComponent(it.href||it.src||title)}">
        <div><strong>${escapeHtml(title)}</strong></div>
        <div class="meta">${it.type.toUpperCase()} • ${when}</div>
        <div class="preview" style="display:none"></div>
      </div>`;
    }
  
    function onItemClick(e){
      const root = e.currentTarget;
      const key = decodeURIComponent(root.dataset.key);
      const item = items.find(i => (i.href||i.src||(i.name||i.text)) && (i.href===key || i.src===key || i.name===key || i.text===key));
      if(!item) return;
  
      const preview = root.querySelector('.preview');
      if(preview.style.display === 'block'){ preview.style.display='none'; return; }
      preview.style.display = 'block';
      preview.innerHTML = '<em>Loading preview...</em>';
  
      // try to extract text locally for common cases
      if(item.type === 'document'){
        // if PDF -> use pdf.js (we expect the page to have access to pdf.js or we inject a script)
        preview.innerHTML = `<div>Preparing document text extraction...</div>`;
        // send the content_script / background a message to fetch/extract the document (content script can fetch same-origin resources)
        parent.postMessage({type:'EXTRACT_TEXT', payload: item}, '*');
      } else if(item.type === 'image'){
        preview.innerHTML = `<div><img src="${escapeHtml(item.src)}" style="max-width:100%"/></div><div><button id="doOCR">Extract text (OCR)</button></div>`;
        preview.querySelector('#doOCR').addEventListener('click', ()=> doOCR(item.src, preview));
      } else if(item.type === 'link'){
        // show quick link preview and request summary on demand
        preview.innerHTML = `<div><a target="_blank" href="${escapeHtml(item.href)}">Open link</a></div><div><button id="summBtn">Summarize</button></div>`;
        preview.querySelector('#summBtn').addEventListener('click', ()=> requestSummary({source:'link', href:item.href}));
      }
    }
  
    async function doOCR(src, previewEl){
      if(!ocrToggle.checked){ alert('Enable OCR toggle first'); return; }
      previewEl.innerHTML = '<div>Running OCR — this runs locally in browser (tesseract.js)</div>';
      // lazy-load tesseract
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@v4.1.1/dist/tesseract.min.js';
      script.onload = async ()=>{
        const { createWorker } = window.Tesseract;
        const worker = createWorker();
        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const r = await worker.recognize(src);
        const text = r.data.text;
        previewEl.innerHTML = `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre><div><button id="summBtn2">Summarize</button></div>`;
        previewEl.querySelector('#summBtn2').addEventListener('click', ()=> requestSummary({source:'image', text}));
        await worker.terminate();
      };
      document.head.appendChild(script);
    }
  
    // Centralized: request summary from backend via background script
    function requestSummary(payload){
      // payload should at least contain {source: 'link'|'document'|'image', text?, href?}
      // if we cached summary, show it
      const cacheKey = JSON.stringify({href:payload.href||payload.text?.slice(0,80)});
      if(cache[cacheKey]){
        showSummaryInPreview(cache[cacheKey]);
        return;
      }
      // show loading UI
      const msg = { type: 'REQUEST_SUMMARY', payload };
      parent.postMessage(msg, '*');
    }
  
    // receive summaries back via parent window message from content_script -> background -> network -> content
    window.addEventListener('message', e=>{
      const {type,payload} = e.data||{};
      if(type === 'SUMMARY_RESULT'){
        // find preview area for that payload.key and show
        const key = payload.key;
        cache[key] = payload.summary;
        chrome.storage.local.set({docuFind_cache: cache});
        showSummaryInPreview(payload.summary);
      }
    });
  
    function showSummaryInPreview(summary){
      // find the first visible preview and place summary
      const vis = document.querySelector('.preview[style*="display: block"]');
      if(!vis) return;
      vis.innerHTML = `<div><strong>AI summary</strong></div><div style="white-space:pre-wrap">${escapeHtml(summary)}</div><div style="margin-top:8px"><button id="copySum">Copy</button><button id="downloadSum">Download</button></div>`;
      vis.querySelector('#copySum').addEventListener('click', ()=> navigator.clipboard.writeText(summary));
      vis.querySelector('#downloadSum').addEventListener('click', ()=>{
        const blob = new Blob([summary], {type:'text/plain'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'summary.txt'; a.click();
      });
    }
  
    // small helpers
    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  
  })();