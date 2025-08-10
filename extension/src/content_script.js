(function(){
    // avoid double-injection
    if (window.docuFindInjected) return;
    window.docuFindInjected = true;
  
    // inject sidebar iframe-like container
    const sidebar = document.createElement('iframe');
    sidebar.id = 'docufind-sidebar';
    sidebar.style.cssText = `position:fixed;right:0;top:0;height:100vh;width:360px;z-index:2147483647;border:0;box-shadow: -6px 0 18px rgba(0,0,0,.12);`;
    // sandbox to reduce interference
    sidebar.sandbox = 'allow-scripts allow-popups';

    document.documentElement.appendChild(sidebar);
  
    // write sidebar content by setting srcdoc (keeps simple packaging)
    fetch(chrome.runtime.getURL('src/sidebar.html')).then(r=>r.text()).then(html=>{
      sidebar.srcdoc = html;
      // once iframe loaded, start scanning
      sidebar.onload = () => {
        // inform sidebar of initial scan
        scanPageAndSend();
        // observe DOM for changes so new messages are found
        const observer = new MutationObserver(debounce(scanPageAndSend, 1200));
        observer.observe(document.body, {childList:true, subtree:true});
  
        // listen for messages from the iframe (sidebar)
        window.addEventListener('message', handleIframeMessage);
      }
    });
  
    function handleIframeMessage(e){
      if(e.source !== sidebar.contentWindow) return;
      const {type, payload} = e.data || {};
      if(type === 'REQUEST_SUMMARY'){
        // forward to extension background which can call external API
        chrome.runtime.sendMessage({type:'SUMMARIZE', payload});
      }
      if(type === 'GET_CACHED'){
        chrome.storage.local.get(['docuFind_cache'], res=>{
          sidebar.contentWindow.postMessage({type:'CACHE', payload: res.docuFind_cache||{}}, '*');
        });
      }
    }
  
    function scanPageAndSend(){
      const items = scanForItems();
      // send items to sidebar iframe
      sidebar.contentWindow.postMessage({type:'SCAN_RESULTS', payload:items}, '*');
    }
  
    function scanForItems(){
      // Generic approach: look for anchor tags, elements that look like file links, and image/video tags.
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const linkItems = anchors.map(a=>({
        type: 'link',
        href: a.href,
        text: a.innerText || a.href,
        timestamp: guessTimestampFromNode(a) || Date.now()
      }));
  
      // images/videos
      const imgs = Array.from(document.querySelectorAll('img'));
      const imageItems = imgs.map(img=>({type:'image', src: img.src, alt: img.alt||'', timestamp: guessTimestampFromNode(img) || Date.now()}));
  
      // documents - look for filenames in text or links that end with known extensions
      const docExtensions = ['.pdf','.docx','.doc','.xlsx','.xls','.txt'];
      const docItems = anchors.filter(a=> docExtensions.some(ext=> a.href.toLowerCase().includes(ext))).map(a=>({
        type:'document', href: a.href, name: a.innerText || a.href.split('/').pop(), timestamp: guessTimestampFromNode(a) || Date.now()
      }));
  
      // Combine and sort by timestamp ascending (chronological)
      const all = [...docItems, ...imageItems, ...linkItems];
      const uniq = dedupeByHrefOrSrc(all);
      uniq.sort((a,b)=>a.timestamp - b.timestamp);
      return uniq;
    }
  
    function dedupeByHrefOrSrc(arr){
      const seen = new Set();
      return arr.filter(i=>{
        const key = i.href || i.src || i.text;
        if(seen.has(key)) return false; seen.add(key); return true;
      });
    }
  
    function guessTimestampFromNode(node){
      // Best-effort: look up the DOM tree for time elements or data-time attributes used by chat UIs.
      let n = node;
      for(let i=0;i<8 && n; i++){ // climb up
        if(n.dataset && n.dataset.timestamp) return Number(n.dataset.timestamp);
        const timeEls = n.querySelectorAll && n.querySelectorAll('time, .timestamp, .msg-time');
        if(timeEls && timeEls.length){
          const t = timeEls[0].getAttribute('datetime') || timeEls[0].innerText;
          const parsed = Date.parse(t);
          if(!isNaN(parsed)) return parsed;
        }
        n = n.parentElement;
      }
      return null;
    }
  
    // simple debounce
    function debounce(fn, wait){
      let t;
      return function(){ clearTimeout(t); t = setTimeout(fn, wait); };
    }
  
  })();