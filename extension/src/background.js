chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.type === 'SUMMARIZE'){
      // call backend /summarize
      handleSummarize(message.payload).then(r=> sendResponse({ok:true})).catch(e=> sendResponse({ok:false,error:e.message}));
      return true; // keep channel open for async
    }
  });
  
  async function handleSummarize(payload){
    // payload: {source, text?, href?}
    // We call the backend endpoint (user must set BACKEND_URL in options).
    const opts = await getOptions();
    const BACKEND = opts.backendUrl || 'https://your-backend.example.com';
    const keyHint = payload.href || (payload.text && payload.text.slice(0,80)) || 'local';
    // fetch text for a link if not provided
    let text = payload.text;
    if(!text && payload.href){
      try{
        const res = await fetch('/_docufind_proxy?url=' + encodeURIComponent(payload.href));
        // content script cannot set host permissions to cross-origin; this proxy path is expected on the backend
        text = await res.text();
      }catch(e){ text = `Unable to fetch content: ${e.message}`; }
    }
    // send to backend summarize endpoint
    const response = await fetch(BACKEND.replace(/\/$/, '') + '/summarize', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({text, href: payload.href})
    });
    const json = await response.json();
    // forward to all tabs (the content_script will deliver to iframe)
    const summary = json.summary || (json.error || 'No summary');
    // include a small key so sidebar can cache
    const key = JSON.stringify({href:payload.href||null, snippet: (text||'').slice(0,80)});
    // send to all tabs (the content script side will pick this up and forward to the iframe)
    chrome.tabs.query({}, tabs=>{
      for(const t of tabs) chrome.tabs.sendMessage(t.id, {type:'SUMMARY_RESULT', payload:{key, summary}}).catch(()=>{});
    });
  }
  
  function getOptions(){
    return new Promise(resolve=> chrome.storage.local.get(['backendUrl'], res=> resolve(res||{})));
  }