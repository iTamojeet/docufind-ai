chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUMMARIZE') {
      handleSummarize(message.payload)
          .then(r => sendResponse({ ok: true }))
          .catch(e => sendResponse({ ok: false, error: e.message }));
      return true; // keep channel open for async
  }
});

async function handleSummarize(payload) {
  // payload: {source, text?, href?}
  const opts = await getOptions();
  const BACKEND = opts.backendUrl || 'http://localhost:8080';
  
  let text = payload.text;
  
  // If we have a URL but no text, try to fetch it
  if (!text && payload.href) {
      try {
          // For cross-origin requests, we'd need host permissions
          // For now, just pass the URL to backend
          text = `Content from: ${payload.href}`;
      } catch (e) {
          text = `Unable to fetch content: ${e.message}`;
      }
  }
  
  // Send to backend analyze endpoint
  const response = await fetch(BACKEND.replace(/\/$/, '') + '/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          text, 
          href: payload.href 
      })
  });
  
  const json = await response.json();
  
  // Extract summary from response
  let summary;
  if (json.summary) {
      if (typeof json.summary === 'object' && json.summary.title && json.summary.bullets) {
          summary = `${json.summary.title}\n\n${json.summary.bullets.map(b => `• ${b}`).join('\n')}`;
      } else {
          summary = String(json.summary);
      }
  } else {
      summary = json.error || 'No summary available';
  }
  
  // Create cache key
  const key = JSON.stringify({
      href: payload.href || null,
      snippet: (text || '').slice(0, 80)
  });
  
  // Send to all tabs
  chrome.tabs.query({}, tabs => {
      for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
              type: 'SUMMARY_RESULT',
              payload: { key, summary }
          }).catch(() => {
              // Ignore errors for tabs that don't have content script
          });
      }
  });
}

function getOptions() {
  return new Promise(resolve => 
      chrome.storage.local.get(['backendUrl'], res => 
          resolve(res || {})
      )
  );
}