document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan-btn');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const settingsBtn = document.getElementById('settings-btn');
  const platformStatus = document.getElementById('platform-status');
  const platformName = document.getElementById('platform-name');
  const platformDesc = document.getElementById('platform-desc');
  const errorContainer = document.getElementById('error-container');
  const statsDiv = document.getElementById('stats');
  const statsContent = document.getElementById('stats-content');
  
  // Platform configurations
  const SUPPORTED_PLATFORMS = {
      'web.whatsapp.com': {
          name: 'WhatsApp Web',
          desc: 'Ready to scan chat messages for documents and links',
          supported: true
      },
      'web.telegram.org': {
          name: 'Telegram Web',
          desc: 'Ready to scan chat messages for documents and links',
          supported: true
      },
      'slack.com': {
          name: 'Slack',
          desc: 'Ready to scan workspace messages for files and links',
          supported: true
      },
      'teams.microsoft.com': {
          name: 'Microsoft Teams',
          desc: 'Ready to scan team conversations for documents',
          supported: true
      },
      'discord.com': {
          name: 'Discord',
          desc: 'Ready to scan server messages for media and links',
          supported: true
      },
      'app.discord.com': {
          name: 'Discord',
          desc: 'Ready to scan server messages for media and links',
          supported: true
      }
  };

  let currentTab = null;
  let isScanning = false;

  // Initialize popup
  init();

  async function init() {
      try {
          // Get current tab
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          currentTab = tabs[0];
          
          // Check platform support
          checkPlatformSupport();
          
          // Load stats
          loadStats();
          
          // Setup event listeners
          setupEventListeners();
          
      } catch (error) {
          showError('Failed to initialize extension: ' + error.message);
      }
  }

  function checkPlatformSupport() {
      if (!currentTab || !currentTab.url) {
          setPlatformStatus('Unknown', 'Cannot detect current website', false);
          return;
      }

      const url = new URL(currentTab.url);
      const hostname = url.hostname;
      
      // Check if current site is supported
      let platform = null;
      for (const [domain, config] of Object.entries(SUPPORTED_PLATFORMS)) {
          if (hostname.includes(domain.split('.')[0]) || hostname === domain) {
              platform = config;
              break;
          }
      }

      if (platform) {
          setPlatformStatus(platform.name, platform.desc, true);
          scanBtn.disabled = false;
      } else {
          setPlatformStatus(
              'Unsupported Platform', 
              'DocuFind AI works best on WhatsApp Web, Telegram, Slack, Teams, and Discord',
              false
          );
          scanBtn.disabled = true;
      }
  }

  function setPlatformStatus(name, desc, supported) {
      platformName.textContent = supported ? `✅ ${name}` : `❌ ${name}`;
      platformDesc.textContent = desc;
      
      platformStatus.className = supported ? 'platform-status' : 'platform-status unsupported';
  }

  function setupEventListeners() {
      scanBtn.addEventListener('click', handleScan);
      toggleSidebarBtn.addEventListener('click', handleToggleSidebar);
      settingsBtn.addEventListener('click', handleSettings);
      
      // Footer links
      document.getElementById('help-link').addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: 'https://github.com/yourusername/docufind-ai#readme' });
      });
      
      document.getElementById('feedback-link').addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: 'https://github.com/yourusername/docufind-ai/issues' });
      });
      
      document.getElementById('options-link').addEventListener('click', (e) => {
          e.preventDefault();
          chrome.runtime.openOptionsPage();
      });
  }

  async function handleScan() {
      if (isScanning || !currentTab) return;
      
      isScanning = true;
      updateScanButton(true);
      hideError();
      
      try {
          // Send scan message to content script
          const response = await chrome.tabs.sendMessage(currentTab.id, {
              type: 'MANUAL_SCAN'
          });
          
          if (response && response.ok) {
              showStats('Scan completed successfully!');
              // Close popup after successful scan
              setTimeout(() => window.close(), 1500);
          } else {
              throw new Error(response?.error || 'Scan failed');
          }
          
      } catch (error) {
          console.error('Scan error:', error);
          
          // If content script not loaded, try to inject it
          try {
              await chrome.scripting.executeScript({
                  target: { tabId: currentTab.id },
                  files: ['src/chat-scanner.js']
              });
              
              // Wait a bit for the script to initialize
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Try scan again
              await chrome.tabs.sendMessage(currentTab.id, {
                  type: 'MANUAL_SCAN'
              });
              
              showStats('Content script loaded and scan initiated!');
              setTimeout(() => window.close(), 1500);
              
          } catch (injectionError) {
              showError('Failed to start scanning. Please refresh the page and try again.');
          }
      } finally {
          isScanning = false;
          updateScanButton(false);
      }
  }

  async function handleToggleSidebar() {
      if (!currentTab) return;
      
      try {
          await chrome.tabs.sendMessage(currentTab.id, {
              type: 'TOGGLE_SIDEBAR'
          });
          
          // Close popup
          window.close();
          
      } catch (error) {
          showError('Sidebar not available. Please scan first to activate DocuFind AI.');
      }
  }

  function handleSettings() {
      chrome.runtime.openOptionsPage();
      window.close();
  }

  function updateScanButton(scanning) {
      if (scanning) {
          scanBtn.innerHTML = '<span class="spinner">⟳</span><span>Scanning...</span>';
          scanBtn.disabled = true;
      } else {
          scanBtn.innerHTML = '<span>🔍</span><span>Scan Current Chat</span>';
          scanBtn.disabled = false;
      }
  }

  function showError(message) {
      errorContainer.innerHTML = `<div class="error">${message}</div>`;
  }

  function hideError() {
      errorContainer.innerHTML = '';
  }

  function showStats(message) {
      statsContent.textContent = message;
      statsDiv.style.display = 'block';
  }

  async function loadStats() {
      try {
          const result = await chrome.storage.local.get(['docuFind_stats']);
          const stats = result.docuFind_stats || { scansToday: 0, totalItems: 0, summariesGenerated: 0 };
          
          if (stats.totalItems > 0) {
              showStats(`Found ${stats.totalItems} items in ${stats.scansToday} scans today`);
          }
      } catch (error) {
          console.error('Failed to load stats:', error);
      }
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SCAN_COMPLETE') {
          const { itemCount } = message.payload;
          showStats(`✅ Scan complete! Found ${itemCount} items`);
          
          // Update stats
          updateStats(itemCount);
      }
      
      if (message.type === 'SCAN_ERROR') {
          showError(message.payload.error);
      }
  });

  async function updateStats(itemCount) {
      try {
          const result = await chrome.storage.local.get(['docuFind_stats']);
          const stats = result.docuFind_stats || { scansToday: 0, totalItems: 0, summariesGenerated: 0 };
          
          stats.scansToday += 1;
          stats.totalItems += itemCount;
          stats.lastScan = Date.now();
          
          await chrome.storage.local.set({ docuFind_stats: stats });
      } catch (error) {
          console.error('Failed to update stats:', error);
      }
  }
});