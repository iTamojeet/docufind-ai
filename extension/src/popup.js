document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("scanBtn");
  const resultsDiv = document.getElementById("results");

  scanBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: scanChat
        },
        (results) => {
          if (!results || !results[0]) {
            resultsDiv.textContent = "No results found.";
            return;
          }
          const data = results[0].result;
          resultsDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
          sendToAI(data);
        }
      );
    });
  });

  function scanChat() {
    const messages = [...document.querySelectorAll("div, span, p")]
      .map(el => el.innerText)
      .filter(text => text && (text.includes("http") || text.match(/\.(pdf|docx|jpg|png|mp4)/i)));
    return messages;
  }

  async function sendToAI(data) {
    try {
      const response = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: data })
      });
      const json = await response.json();
      resultsDiv.innerHTML += `<hr><b>AI Summary:</b><br>${json.summary}`;
    } catch (err) {
      resultsDiv.innerHTML += "<hr><b>AI Summary:</b> Error calling AI.";
    }
  }
});
