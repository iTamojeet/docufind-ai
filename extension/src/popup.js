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
      const response = await fetch("http://localhost:8080/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: data })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const json = await response.json();
      
      let summaryText = "No summary available";
      if (json.summary) {
        if (typeof json.summary === 'object' && json.summary.title && json.summary.bullets) {
          summaryText = `<strong>${json.summary.title}</strong><br><ul>${json.summary.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;
        } else {
          summaryText = String(json.summary);
        }
      } else if (json.error) {
        summaryText = `Error: ${json.error}`;
      }
      
      resultsDiv.innerHTML += `<hr><b>AI Summary:</b><br>${summaryText}`;
    } catch (err) {
      console.error('AI Summary Error:', err);
      resultsDiv.innerHTML += `<hr><b>AI Summary:</b> Error calling AI: ${err.message}`;
    }
  }
});