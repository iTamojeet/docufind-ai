document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const backendUrlInput = document.getElementById('backend-url');
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const autoScanCheckbox = document.getElementById('auto-scan');
    const ocrEnabledCheckbox = document.getElementById('ocr-enabled');
    const maxSummaryLengthSelect = document.getElementById('max-summary-length');
    const showTimestampsCheckbox = document.getElementById('show-timestamps');
    const groupByTypeCheckbox = document.getElementById('group-by-type');
    
    const testBackendBtn = document.getElementById('test-backend');
    const testGeminiBtn = document.getElementById('test-gemini');
    const testResults = document.getElementById('test-results');
    
    const saveSettingsBtn = document.getElementById('save-settings');
    const resetSettingsBtn = document.getElementById('reset-settings');
    const clearCacheBtn = document.getElementById('clear-cache');
    const clearStatsBtn = document.getElementById('clear-stats');
    const exportDataBtn = document.getElementById('export-data');
    
    const statusMessage = document.getElementById('status-message');
    
    // Statistics elements
    const statScans = document.getElementById('stat-scans');
    const statItems = document.getElementById('stat-items');
    const statSummaries = document.getElementById('stat-summaries');
    const statTimeSaved = document.getElementById('stat-time-saved');
    
    // Default settings
    const DEFAULT_SETTINGS = {
        backendUrl: 'http://localhost:8080',
        geminiApiKey: '',
        autoScan: true,
        ocrEnabled: true,
        maxSummaryLength: 400,
        showTimestamps: true,
        groupByType: false
    };
    
    // Initialize
    init();
    
    async function init() {
        await loadSettings();
        await loadStatistics();
        setupEventListeners();
    }
    
    function setupEventListeners() {
        saveSettingsBtn.addEventListener('click', saveSettings);
        resetSettingsBtn.addEventListener('click', resetSettings);
        clearCacheBtn.addEventListener('click', clearCache);
        clearStatsBtn.addEventListener('click', clearStatistics);
        exportDataBtn.addEventListener('click', exportData);
        
        testBackendBtn.addEventListener('click', testBackend);
        testGeminiBtn.addEventListener('click', testGemini);
        
        // Auto-save on input changes (debounced)
        const inputs = [backendUrlInput, geminiApiKeyInput, maxSummaryLengthSelect];
        const checkboxes = [autoScanCheckbox, ocrEnabledCheckbox, showTimestampsCheckbox, groupByTypeCheckbox];
        
        inputs.forEach(input => {
            input.addEventListener('input', debounce(autoSave, 1000));
        });
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', autoSave);
        });
    }
    
    async function loadSettings() {
        try {
            const result = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
            const settings = { ...DEFAULT_SETTINGS, ...result };
            
            backendUrlInput.value = settings.backendUrl;
            geminiApiKeyInput.value = settings.geminiApiKey;
            autoScanCheckbox.checked = settings.autoScan;
            ocrEnabledCheckbox.checked = settings.ocrEnabled;
            maxSummaryLengthSelect.value = settings.maxSummaryLength;
            showTimestampsCheckbox.checked = settings.showTimestamps;
            groupByTypeCheckbox.checked = settings.groupByType;
            
        } catch (error) {
            console.error('Failed to load settings:', error);
            showStatus('Failed to load settings', 'error');
        }
    }
    
    async function saveSettings() {
        try {
            const settings = {
                backendUrl: backendUrlInput.value.trim() || DEFAULT_SETTINGS.backendUrl,
                geminiApiKey: geminiApiKeyInput.value.trim(),
                autoScan: autoScanCheckbox.checked,
                ocrEnabled: ocrEnabledCheckbox.checked,
                maxSummaryLength: parseInt(maxSummaryLengthSelect.value),
                showTimestamps: showTimestampsCheckbox.checked,
                groupByType: groupByTypeCheckbox.checked
            };
            
            await chrome.storage.local.set(settings);
            showStatus('Settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            showStatus('Failed to save settings', 'error');
        }
    }
    
    async function autoSave() {
        try {
            await saveSettings();
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }
    
    async function resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            try {
                await chrome.storage.local.set(DEFAULT_SETTINGS);
                await loadSettings();
                showStatus('Settings reset to defaults', 'success');
            } catch (error) {
                console.error('Failed to reset settings:', error);
                showStatus('Failed to reset settings', 'error');
            }
        }
    }
    
    async function clearCache() {
        if (confirm('Are you sure you want to clear all cached data?')) {
            try {
                await chrome.storage.local.remove(['docuFind_cache']);
                showStatus('Cache cleared successfully', 'success');
            } catch (error) {
                console.error('Failed to clear cache:', error);
                showStatus('Failed to clear cache', 'error');
            }
        }
    }
    
    async function clearStatistics() {
        if (confirm('Are you sure you want to clear all usage statistics?')) {
            try {
                await chrome.storage.local.remove(['docuFind_stats']);
                await loadStatistics();
                showStatus('Statistics cleared successfully', 'success');
            } catch (error) {
                console.error('Failed to clear statistics:', error);
                showStatus('Failed to clear statistics', 'error');
            }
        }
    }
    
    async function loadStatistics() {
        try {
            const result = await chrome.storage.local.get(['docuFind_stats']);
            const stats = result.docuFind_stats || {
                totalScans: 0,
                totalItems: 0,
                summariesGenerated: 0,
                timeSaved: 0
            };
            
            statScans.textContent = stats.totalScans || 0;
            statItems.textContent = stats.totalItems || 0;
            statSummaries.textContent = stats.summariesGenerated || 0;
            statTimeSaved.textContent = Math.round((stats.timeSaved || 0) / 60) || 0; // Convert to minutes
            
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }
    
    async function exportData() {
        try {
            const result = await chrome.storage.local.get(null);
            const exportData = {
                settings: {},
                statistics: result.docuFind_stats || {},
                cache: result.docuFind_cache || {},
                exportDate: new Date().toISOString()
            };
            
            // Extract settings
            Object.keys(DEFAULT_SETTINGS).forEach(key => {
                if (result[key] !== undefined) {
                    exportData.settings[key] = result[key];
                }
            });
            
            // Create download
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `docufind-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            showStatus('Data exported successfully', 'success');
            
        } catch (error) {
            console.error('Failed to export data:', error);
            showStatus('Failed to export data', 'error');
        }
    }
    
    async function testBackend() {
        const backendUrl = backendUrlInput.value.trim() || DEFAULT_SETTINGS.backendUrl;
        
        testBackendBtn.disabled = true;
        testBackendBtn.textContent = 'Testing...';
        testResults.innerHTML = '<div class="status info">Testing backend connection...</div>';
        
        try {
            const response = await fetch(`${backendUrl.replace(/\/$/, '')}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: 'This is a test message to verify the backend is working correctly.',
                    max_tokens: 100
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.summary) {
                    testResults.innerHTML = '<div class="status success">✅ Backend connection successful!</div>';
                } else {
                    testResults.innerHTML = '<div class="status error">❌ Backend responded but no summary received</div>';
                }
            } else {
                testResults.innerHTML = `<div class="status error">❌ Backend error: ${response.status} ${response.statusText}</div>`;
            }
            
        } catch (error) {
            testResults.innerHTML = `<div class="status error">❌ Connection failed: ${error.message}</div>`;
        } finally {
            testBackendBtn.disabled = false;
            testBackendBtn.textContent = 'Test Backend';
        }
    }
    
    async function testGemini() {
        const apiKey = geminiApiKeyInput.value.trim();
        
        if (!apiKey) {
            testResults.innerHTML = '<div class="status error">❌ Please enter a Gemini API key first</div>';
            return;
        }
        
        testGeminiBtn.disabled = true;
        testGeminiBtn.textContent = 'Testing...';
        testResults.innerHTML = '<div class="status info">Testing Gemini API connection...</div>';
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: 'Hello, this is a test. Please respond with "API test successful".' }] }
                    ]
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.candidates && result.candidates[0] && result.candidates[0].content) {
                    testResults.innerHTML = '<div class="status success">✅ Gemini API connection successful!</div>';
                } else {
                    testResults.innerHTML = '<div class="status error">❌ Gemini API responded but format unexpected</div>';
                }
            } else {
                const errorText = await response.text();
                testResults.innerHTML = `<div class="status error">❌ Gemini API error: ${response.status}<br>${errorText}</div>`;
            }
            
        } catch (error) {
            testResults.innerHTML = `<div class="status error">❌ Gemini API test failed: ${error.message}</div>`;
        } finally {
            testGeminiBtn.disabled = false;
            testGeminiBtn.textContent = 'Test Gemini API';
        }
    }
    
    function showStatus(message, type) {
        statusMessage.innerHTML = `<div class="status ${type}">${message}</div>`;
        setTimeout(() => {
            statusMessage.innerHTML = '';
        }, 5000);
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Privacy policy link handler
    document.getElementById('privacy-link').addEventListener('click', (e) => {
        e.preventDefault();
        const privacyContent = `
DocuFind AI Privacy Policy

1. Data Collection:
   - We only scan the currently active chat window for documents and links
   - Text content is temporarily processed for AI summarization
   - No personal messages or chat content is permanently stored

2. Data Processing:
   - Document scanning happens locally in your browser
   - Only selected content is sent to AI services for summarization
   - OCR processing is done locally using Tesseract.js

3. Data Storage:
   - Settings and preferences are stored locally in your browser
   - AI summaries are cached locally for performance
   - No data is sent to our servers except for AI summarization

4. Third-Party Services:
   - Google Gemini API may be used for text summarization
   - API usage follows Google's privacy policies
   - You control when content is sent for summarization

5. Data Control:
   - You can clear all cached data at any time
   - All processing can be done offline (except AI summarization)
   - Uninstalling the extension removes all local data

For questions about privacy, please contact us through GitHub issues.
        `;
        
        alert(privacyContent);
    });
});