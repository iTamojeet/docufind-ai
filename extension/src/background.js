// DocuFind AI Background Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUMMARIZE') {
      handleSummarize(message.payload, sender.tab.id)
          .then(result => sendResponse({ ok: true, result }))
          .catch(error => sendResponse({ ok: false, error: error.message }));
      return true; // Keep channel open for async
  }
  
  if (message.type === 'EXTRACT_TEXT_OCR') {
      handleOCR(message.payload, sender.tab.id)
          .then(result => sendResponse({ ok: true, result }))
          .catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
  }
  
  if (message.type === 'GET_OPTIONS') {
      getOptions()
          .then(options => sendResponse({ ok: true, options }))
          .catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
  }
  
  if (message.type === 'SET_OPTIONS') {
      setOptions(message.payload)
          .then(() => sendResponse({ ok: true }))
          .catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
  }
});

async function handleSummarize(payload, tabId) {
  try {
      const { source, href, text, name, itemId } = payload;
      const opts = await getOptions();
      const BACKEND_URL = opts.backendUrl || 'http://localhost:8080';
      
      let contentToSummarize = text;
      
      // If we have a URL but no text, try to fetch content
      if (!contentToSummarize && href) {
          try {
              // For security reasons, we'll let the backend handle URL fetching
              // or we can try to fetch if it's a same-origin request
              contentToSummarize = `Content from URL: ${href}\nPlease analyze this URL and provide a summary.`;
          } catch (error) {
              console.error('Failed to fetch URL content:', error);
              contentToSummarize = `Document: ${name || href}`;
          }
      }
      
      if (!contentToSummarize) {
          contentToSummarize = `File: ${name || 'Unknown file'}`;
      }
      
      // Send to backend for summarization
      const response = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              text: contentToSummarize,
              href: href,
              max_tokens: 400
          })
      });
      
      if (!response.ok) {
          throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Format summary
      let summary = 'No summary available';
      if (result.summary) {
          if (typeof result.summary === 'object' && result.summary.title && result.summary.bullets) {
              summary = `${result.summary.title}\n\n${result.summary.bullets.map(b => `• ${b}`).join('\n')}`;
          } else {
              summary = String(result.summary);
          }
      } else if (result.error) {
          summary = `Error: ${result.error}`;
      }
      
      // Send result back to content script
      chrome.tabs.sendMessage(tabId, {
          type: 'SUMMARY_RESULT',
          payload: {
              itemId: itemId,
              summary: summary,
              error: result.error
          }
      }).catch(error => {
          console.error('Failed to send summary to tab:', error);
      });
      
      return { success: true, summary };
      
  } catch (error) {
      console.error('Summarization error:', error);
      
      // Send error back to content script
      chrome.tabs.sendMessage(tabId, {
          type: 'SUMMARY_RESULT',
          payload: {
              itemId: payload.itemId,
              error: error.message
          }
      }).catch(() => {});
      
      throw error;
  }
}

async function handleOCR(payload, tabId) {
  try {
      const { src, itemId } = payload;
      
      // Create a canvas to process the image
      const response = await fetch(src);
      const blob = await response.blob();
      
      // We'll use Tesseract.js in the content script instead
      // Send message back to content script to handle OCR
      chrome.tabs.sendMessage(tabId, {
          type: 'PROCESS_OCR',
          payload: {
              itemId: itemId,
              src: src
          }
      });
      
      return { success: true };
      
  } catch (error) {
      console.error('OCR error:', error);
      
      chrome.tabs.sendMessage(tabId, {
          type: 'OCR_RESULT',
          payload: {
              itemId: payload.itemId,
              error: error.message
          }
      }).catch(() => {});
      
      throw error;
  }
}

async function getOptions() {
  return new Promise(resolve => {
      chrome.storage.local.get([
          'backendUrl',
          'geminiApiKey', 
          'ocrEnabled',
          'maxSummaryLength',
          'autoScan'
      ], (result) => {
          resolve({
              backendUrl: result.backendUrl || 'http://localhost:8080',
              geminiApiKey: result.geminiApiKey || '',
              ocrEnabled: result.ocrEnabled !== false, // Default true
              maxSummaryLength: result.maxSummaryLength || 400,
              autoScan: result.autoScan !== false // Default true
          });
      });
  });
}

async function setOptions(options) {
  return new Promise(resolve => {
      chrome.storage.local.set(options, () => {
          resolve();
      });
  });
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
      // Set default options
      setOptions({
          backendUrl: 'http://localhost:8080',
          ocrEnabled: true,
          maxSummaryLength: 400,
          autoScan: true
      });
      
      // Open options page
      chrome.runtime.openOptionsPage();
  }
});

// Handle browser action click
chrome.action.onClicked.addListener((tab) => {
  // Toggle sidebar visibility by sending message to content script
  chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_SIDEBAR'
  }).catch(() => {
      // If content script not loaded, inject it
      chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/chat-scanner.js']
      });
  });
});

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
      id: 'docufind-scan',
      title: 'Scan for documents with DocuFind AI',
      contexts: ['page']
  });
  
  chrome.contextMenus.create({
      id: 'docufind-summarize-selection',
      title: 'Summarize selected text',
      contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'docufind-scan') {
      chrome.tabs.sendMessage(tab.id, {
          type: 'MANUAL_SCAN'
      });
  }
  
  if (info.menuItemId === 'docufind-summarize-selection') {
      handleSummarize({
          source: 'text',
          text: info.selectionText,
          itemId: `selection-${Date.now()}`
      }, tab.id);
  }
});

// Keep service worker alive
let keepAliveInterval;

function keepAlive() {
  keepAliveInterval = setInterval(() => {
      chrome.runtime.getPlatformInfo(() => {
          // This keeps the service worker active
      });
  }, 20000);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
  }
}

// Start keep alive when extension starts
keepAlive();

// Clean up on suspend
chrome.runtime.onSuspend.addListener(() => {
  stopKeepAlive();
});