(function() {
    // Prevent multiple injections
    if (window.docuFindChatScanner) return;
    window.docuFindChatScanner = true;

    // Chat platform configurations
    const CHAT_CONFIGS = {
        'web.whatsapp.com': {
            name: 'WhatsApp',
            chatContainer: '[data-tab="1"], [data-testid="conversation-panel-body"]',
            messageSelector: '[data-testid="msg-container"], .message-in, .message-out',
            activeChat: '[data-testid="conversation-header"] span[title], [data-testid="conversation-info-header"] span',
            attachmentSelector: '[data-testid="media-link"], [data-testid="audio-link"], [data-testid="document-link"], a[href*="blob:"], a[href*="data:"]',
            textSelector: '.selectable-text span, [data-testid="conversation-compose-box-input"]',
            timestampSelector: '[data-testid="msg-meta"] span, .msg-meta span'
        },
        'web.telegram.org': {
            name: 'Telegram',
            chatContainer: '.messages-container, #column-center .scrollable',
            messageSelector: '.message, .bubble',
            activeChat: '.chat-info .chat-title, .sidebar-header .person-title',
            attachmentSelector: '.document, .media-container a, .webpage, .attachment',
            textSelector: '.message-content, .text-content',
            timestampSelector: '.message-time, .time'
        },
        'slack.com': {
            name: 'Slack',
            chatContainer: '[data-qa="slack_kit_list"], .c-virtual_list__scroll_container',
            messageSelector: '[data-qa="message"], .c-message_kit__background',
            activeChat: '[data-qa="channel_header"] .p-channel_header__title, .p-ia__sidebar_header__title',
            attachmentSelector: '.c-file, .c-file_container, .c-link_preview, a[href*="files.slack.com"]',
            textSelector: '.c-message__body, .p-rich_text_section',
            timestampSelector: '.c-timestamp, [data-qa="message_timestamp"]'
        },
        'teams.microsoft.com': {
            name: 'Microsoft Teams',
            chatContainer: '[data-tid="chat-pane-list"], .ui-chat__messagelist',
            messageSelector: '[data-tid="chat-pane-item"], .ui-chat__item',
            activeChat: '[data-tid="chat-header"] .ui-text, .thread-header .ui-text',
            attachmentSelector: '.ui-chat__file, .attachment-item, .ui-card',
            textSelector: '.ui-chat__messagecontent, [data-tid="messageBodyContent"]',
            timestampSelector: '.ui-text__timestamp, [data-tid="timestamp"]'
        },
        'discord.com': {
            name: 'Discord',
            chatContainer: '[data-list-id="chat-messages"], .messagesWrapper-RQhkzn',
            messageSelector: '[id*="chat-messages"] > li, .message-2CShn3',
            activeChat: '.title-17SveM, .channel-name',
            attachmentSelector: '.attachment-1PZZB2, .embed-IeVjo6, .anchor-1MIwyf',
            textSelector: '.messageContent-2t3eCI, .markup-eYLPri',
            timestampSelector: '.timestamp-p1Df1m, .timestampInline-_lS3aK'
        }
    };

    let currentPlatform = null;
    let chatObserver = null;
    let sidebar = null;
    let scannedItems = [];
    let isScanning = false;

    // Initialize based on current platform
    function initializePlatform() {
        const hostname = window.location.hostname;
        
        for (const [domain, config] of Object.entries(CHAT_CONFIGS)) {
            if (hostname.includes(domain.split('.')[0])) {
                currentPlatform = config;
                console.log(`DocuFind AI: Initialized for ${config.name}`);
                break;
            }
        }

        if (!currentPlatform) {
            console.log('DocuFind AI: Unsupported chat platform');
            return;
        }

        setupSidebar();
        startChatMonitoring();
    }

    // Create and inject sidebar
    function setupSidebar() {
        // Remove existing sidebar
        if (sidebar) {
            sidebar.remove();
        }

        // Create sidebar container
        sidebar = document.createElement('div');
        sidebar.id = 'docufind-sidebar';
        sidebar.innerHTML = `
            <div class="df-header">
                <h3>📁 DocuFind AI</h3>
                <div class="df-chat-info">
                    <span id="df-active-chat">Select a chat</span>
                </div>
                <div class="df-controls">
                    <input type="text" id="df-search" placeholder="Search files, keywords..." />
                    <button id="df-refresh">🔄</button>
                    <button id="df-toggle">×</button>
                </div>
            </div>
            
            <div class="df-filters">
                <button data-filter="all" class="active">All (0)</button>
                <button data-filter="document">Docs (0)</button>
                <button data-filter="image">Images (0)</button>
                <button data-filter="link">Links (0)</button>
                <button id="df-last7">Last 7d</button>
            </div>
            
            <div id="df-status" class="df-status">
                Click a chat to scan for files and links
            </div>
            
            <div id="df-results" class="df-results">
                <!-- Scanned items will appear here -->
            </div>
            
            <div class="df-footer">
                <label>
                    <input type="checkbox" id="df-ocr-toggle"> Enable OCR for images
                </label>
                <div class="df-stats">
                    <span id="df-item-count">0 items found</span>
                </div>
            </div>
        `;

        // Apply styles
        sidebar.className = 'docufind-sidebar';
        
        // Inject into page
        document.body.appendChild(sidebar);

        // Setup event listeners
        setupSidebarEvents();
    }

    // Setup sidebar event listeners
    function setupSidebarEvents() {
        const searchInput = document.getElementById('df-search');
        const refreshBtn = document.getElementById('df-refresh');
        const toggleBtn = document.getElementById('df-toggle');
        const filters = sidebar.querySelectorAll('.df-filters button[data-filter]');
        const last7Btn = document.getElementById('df-last7');

        // Search functionality
        searchInput.addEventListener('input', debounce(renderResults, 300));

        // Refresh scan
        refreshBtn.addEventListener('click', () => {
            scanCurrentChat(true);
        });

        // Toggle sidebar
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('df-collapsed');
        });

        // Filter buttons
        filters.forEach(btn => {
            btn.addEventListener('click', () => {
                filters.forEach(f => f.classList.remove('active'));
                last7Btn.classList.remove('active');
                btn.classList.add('active');
                renderResults();
            });
        });

        // Last 7 days filter
        last7Btn.addEventListener('click', () => {
            filters.forEach(f => f.classList.remove('active'));
            last7Btn.classList.add('active');
            renderResults();
        });
    }

    // Monitor for chat changes
    function startChatMonitoring() {
        // Watch for DOM changes to detect chat switches
        const observer = new MutationObserver(debounce(() => {
            const activeChatName = getActiveChatName();
            if (activeChatName) {
                updateActiveChatDisplay(activeChatName);
                if (!isScanning) {
                    scanCurrentChat();
                }
            }
        }, 500));

        // Start observing the document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial scan
        setTimeout(() => {
            const activeChatName = getActiveChatName();
            if (activeChatName) {
                updateActiveChatDisplay(activeChatName);
                scanCurrentChat();
            }
        }, 2000);
    }

    // Get current active chat name
    function getActiveChatName() {
        if (!currentPlatform) return null;
        
        const chatElement = document.querySelector(currentPlatform.activeChat);
        if (chatElement) {
            return chatElement.textContent.trim() || chatElement.title || 'Unknown Chat';
        }
        return null;
    }

    // Update active chat display
    function updateActiveChatDisplay(chatName) {
        const activeChatElement = document.getElementById('df-active-chat');
        if (activeChatElement) {
            activeChatElement.textContent = `📱 ${chatName}`;
        }
    }

    // Scan current active chat
    function scanCurrentChat(forceRefresh = false) {
        if (!currentPlatform || isScanning) return;
        
        isScanning = true;
        updateStatus('🔍 Scanning chat messages...');

        try {
            const chatContainer = document.querySelector(currentPlatform.chatContainer);
            if (!chatContainer) {
                updateStatus('❌ Could not find chat messages');
                isScanning = false;
                return;
            }

            const messages = chatContainer.querySelectorAll(currentPlatform.messageSelector);
            scannedItems = [];

            // Scan each message
            messages.forEach((message, index) => {
                scanMessage(message, index);
            });

            // Update UI
            updateFilterCounts();
            renderResults();
            updateStatus(`✅ Scan complete - found ${scannedItems.length} items`);

        } catch (error) {
            console.error('DocuFind scan error:', error);
            updateStatus('❌ Scan failed');
        } finally {
            isScanning = false;
        }
    }

    // Scan individual message for attachments and links
    function scanMessage(messageElement, messageIndex) {
        try {
            const timestamp = extractTimestamp(messageElement);
            
            // Scan for attachments
            const attachments = messageElement.querySelectorAll(currentPlatform.attachmentSelector);
            attachments.forEach(attachment => {
                const item = extractAttachmentInfo(attachment, timestamp, messageIndex);
                if (item) {
                    scannedItems.push(item);
                }
            });

            // Scan for links in text
            const textContent = extractMessageText(messageElement);
            if (textContent) {
                const links = extractLinksFromText(textContent, timestamp, messageIndex);
                scannedItems.push(...links);
            }

        } catch (error) {
            console.error('Error scanning message:', error);
        }
    }

    // Extract timestamp from message
    function extractTimestamp(messageElement) {
        try {
            const timestampElement = messageElement.querySelector(currentPlatform.timestampSelector);
            if (timestampElement) {
                const timeText = timestampElement.textContent || timestampElement.getAttribute('datetime');
                const parsed = parseTimeString(timeText);
                return parsed || Date.now();
            }
        } catch (error) {
            console.error('Error extracting timestamp:', error);
        }
        return Date.now();
    }

    // Extract attachment information
    function extractAttachmentInfo(element, timestamp, messageIndex) {
        try {
            const href = element.href || element.dataset.src || element.src;
            const filename = element.textContent || element.alt || element.title;
            
            if (!href && !filename) return null;

            // Determine file type
            let type = 'link';
            if (filename || href) {
                const text = (filename + ' ' + href).toLowerCase();
                if (text.match(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)(\?|$)/)) {
                    type = 'document';
                } else if (text.match(/\.(jpe?g|png|gif|webp|svg|bmp)(\?|$)/)) {
                    type = 'image';
                } else if (text.match(/\.(mp4|webm|avi|mov|mp3|wav|ogg)(\?|$)/)) {
                    type = 'media';
                }
            }

            return {
                id: `${messageIndex}-${scannedItems.length}`,
                type,
                name: filename || 'Unknown File',
                href: href || null,
                src: element.src || null,
                timestamp,
                messageIndex,
                platform: currentPlatform.name
            };

        } catch (error) {
            console.error('Error extracting attachment info:', error);
            return null;
        }
    }

    // Extract message text content
    function extractMessageText(messageElement) {
        try {
            const textElement = messageElement.querySelector(currentPlatform.textSelector);
            return textElement ? textElement.textContent.trim() : '';
        } catch (error) {
            return '';
        }
    }

    // Extract links from text content
    function extractLinksFromText(text, timestamp, messageIndex) {
        const links = [];
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let match;

        while ((match = urlRegex.exec(text)) !== null) {
            const url = match[1];
            links.push({
                id: `${messageIndex}-link-${links.length}`,
                type: 'link',
                name: url,
                href: url,
                timestamp,
                messageIndex,
                platform: currentPlatform.name
            });
        }

        return links;
    }

    // Parse time string to timestamp
    function parseTimeString(timeStr) {
        if (!timeStr) return null;
        
        try {
            // Try ISO format first
            let date = new Date(timeStr);
            if (!isNaN(date.getTime())) {
                return date.getTime();
            }

            // Try common formats
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // Format: "12:34" or "12:34 PM"
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3];
                
                if (ampm && ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                if (ampm && ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                
                date = new Date(today.getTime() + hours * 3600000 + minutes * 60000);
                return date.getTime();
            }

        } catch (error) {
            console.error('Error parsing time:', error);
        }
        
        return null;
    }

    // Update filter button counts
    function updateFilterCounts() {
        const counts = scannedItems.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + 1;
            acc.total++;
            return acc;
        }, { total: 0, document: 0, image: 0, link: 0, media: 0 });

        document.querySelector('[data-filter="all"]').textContent = `All (${counts.total})`;
        document.querySelector('[data-filter="document"]').textContent = `Docs (${counts.document + (counts.media || 0)})`;
        document.querySelector('[data-filter="image"]').textContent = `Images (${counts.image})`;
        document.querySelector('[data-filter="link"]').textContent = `Links (${counts.link})`;
        
        document.getElementById('df-item-count').textContent = `${counts.total} items found`;
    }

    // Render filtered results
    function renderResults() {
        const searchTerm = document.getElementById('df-search').value.toLowerCase();
        const activeFilter = sidebar.querySelector('.df-filters button.active');
        const filterType = activeFilter ? activeFilter.dataset.filter : 'all';
        const isLast7Days = document.getElementById('df-last7').classList.contains('active');
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        let filtered = scannedItems.filter(item => {
            // Filter by type
            if (filterType !== 'all' && item.type !== filterType) {
                if (!(filterType === 'document' && item.type === 'media')) {
                    return false;
                }
            }

            // Filter by date
            if (isLast7Days && item.timestamp < sevenDaysAgo) {
                return false;
            }

            // Filter by search term
            if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) {
                return false;
            }

            return true;
        });

        // Sort by timestamp (newest first)
        filtered.sort((a, b) => b.timestamp - a.timestamp);

        // Render items
        const resultsContainer = document.getElementById('df-results');
        if (filtered.length === 0) {
            resultsContainer.innerHTML = '<div class="df-no-results">No items found matching your filters</div>';
            return;
        }

        resultsContainer.innerHTML = filtered.map(item => renderResultItem(item)).join('');

        // Attach click handlers
        filtered.forEach(item => {
            const element = document.getElementById(`df-item-${item.id}`);
            if (element) {
                element.addEventListener('click', () => handleItemClick(item));
            }
        });
    }

    // Render individual result item
    function renderResultItem(item) {
        const icon = getItemIcon(item.type);
        const timeStr = new Date(item.timestamp).toLocaleString();
        const truncatedName = item.name.length > 40 ? item.name.substring(0, 37) + '...' : item.name;

        return `
            <div class="df-result-item" id="df-item-${item.id}">
                <div class="df-item-header">
                    <span class="df-item-icon">${icon}</span>
                    <span class="df-item-name">${escapeHtml(truncatedName)}</span>
                    <span class="df-item-type">${item.type.toUpperCase()}</span>
                </div>
                <div class="df-item-meta">
                    <span class="df-item-time">${timeStr}</span>
                    <span class="df-item-platform">${item.platform}</span>
                </div>
                <div class="df-item-preview" id="df-preview-${item.id}" style="display: none;">
                    <!-- Preview content will be loaded here -->
                </div>
            </div>
        `;
    }

    // Handle item click
    function handleItemClick(item) {
        const previewElement = document.getElementById(`df-preview-${item.id}`);
        
        if (previewElement.style.display === 'block') {
            previewElement.style.display = 'none';
            return;
        }

        // Close other previews
        sidebar.querySelectorAll('.df-item-preview').forEach(p => p.style.display = 'none');
        
        previewElement.style.display = 'block';
        previewElement.innerHTML = '<div class="df-loading">Loading preview...</div>';

        // Load preview based on item type
        loadItemPreview(item, previewElement);
    }

    // Load item preview
    function loadItemPreview(item, previewElement) {
        if (item.type === 'image') {
            previewElement.innerHTML = `
                <div class="df-preview-image">
                    <img src="${escapeHtml(item.src || item.href)}" style="max-width: 100%; max-height: 200px;" />
                </div>
                <div class="df-preview-actions">
                    <button onclick="extractTextFromImage('${item.id}')">Extract Text (OCR)</button>
                </div>
            `;
        } else if (item.type === 'link') {
            previewElement.innerHTML = `
                <div class="df-preview-link">
                    <a href="${escapeHtml(item.href)}" target="_blank">📄 Open Link</a>
                </div>
                <div class="df-preview-actions">
                    <button onclick="summarizeContent('${item.id}')">📝 Summarize</button>
                </div>
            `;
        } else if (item.type === 'document' || item.type === 'media') {
            previewElement.innerHTML = `
                <div class="df-preview-document">
                    <a href="${escapeHtml(item.href || item.src)}" target="_blank">📁 ${escapeHtml(item.name)}</a>
                </div>
                <div class="df-preview-actions">
                    <button onclick="summarizeContent('${item.id}')">📝 Summarize</button>
                    <button onclick="downloadFile('${item.id}')">💾 Download</button>
                </div>
            `;
        }
    }

    // Global functions for preview actions
    window.extractTextFromImage = function(itemId) {
        const ocrEnabled = document.getElementById('df-ocr-toggle').checked;
        if (!ocrEnabled) {
            alert('Please enable OCR toggle first');
            return;
        }
        
        const item = scannedItems.find(i => i.id === itemId);
        if (!item) return;

        const previewElement = document.getElementById(`df-preview-${itemId}`);
        previewElement.innerHTML = '<div class="df-loading">Running OCR...</div>';

        // Send message to background script for OCR processing
        chrome.runtime.sendMessage({
            type: 'EXTRACT_TEXT_OCR',
            payload: { src: item.src || item.href, itemId }
        });
    };

    window.summarizeContent = function(itemId) {
        const item = scannedItems.find(i => i.id === itemId);
        if (!item) return;

        const previewElement = document.getElementById(`df-preview-${itemId}`);
        previewElement.innerHTML = '<div class="df-loading">Generating summary...</div>';

        // Send to background script for summarization
        chrome.runtime.sendMessage({
            type: 'SUMMARIZE',
            payload: {
                source: item.type,
                href: item.href || item.src,
                name: item.name,
                itemId
            }
        });
    };

    window.downloadFile = function(itemId) {
        const item = scannedItems.find(i => i.id === itemId);
        if (!item) return;

        if (item.href || item.src) {
            const a = document.createElement('a');
            a.href = item.href || item.src;
            a.download = item.name;
            a.click();
        }
    };

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'SUMMARY_RESULT') {
            const { itemId, summary, error } = message.payload;
            const previewElement = document.getElementById(`df-preview-${itemId}`);
            
            if (previewElement) {
                if (error) {
                    previewElement.innerHTML = `<div class="df-error">Error: ${error}</div>`;
                } else {
                    previewElement.innerHTML = `
                        <div class="df-summary">
                            <h4>AI Summary</h4>
                            <div class="df-summary-content">${escapeHtml(summary)}</div>
                            <div class="df-summary-actions">
                                <button onclick="copySummary('${escapeHtml(summary)}')">📋 Copy</button>
                                <button onclick="downloadSummary('${escapeHtml(summary)}')">💾 Download</button>
                            </div>
                        </div>
                    `;
                }
            }
        }

        if (message.type === 'OCR_RESULT') {
            const { itemId, text, error } = message.payload;
            const previewElement = document.getElementById(`df-preview-${itemId}`);
            
            if (previewElement) {
                if (error) {
                    previewElement.innerHTML = `<div class="df-error">OCR Error: ${error}</div>`;
                } else {
                    previewElement.innerHTML = `
                        <div class="df-ocr-result">
                            <h4>Extracted Text</h4>
                            <div class="df-ocr-text">${escapeHtml(text)}</div>
                            <div class="df-ocr-actions">
                                <button onclick="summarizeText('${itemId}', '${escapeHtml(text)}')">📝 Summarize</button>
                                <button onclick="copyText('${escapeHtml(text)}')">📋 Copy</button>
                            </div>
                        </div>
                    `;
                }
            }
        }
    });

    // Global utility functions
    window.copySummary = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Summary copied to clipboard!');
        });
    };

    window.downloadSummary = function(text) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'docufind-summary.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    window.copyText = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Text copied to clipboard!');
        });
    };

    window.summarizeText = function(itemId, text) {
        const previewElement = document.getElementById(`df-preview-${itemId}`);
        previewElement.innerHTML = '<div class="df-loading">Generating summary...</div>';

        chrome.runtime.sendMessage({
            type: 'SUMMARIZE',
            payload: {
                source: 'text',
                text: text,
                itemId
            }
        });
    };

    // Utility functions
    function updateStatus(message) {
        const statusElement = document.getElementById('df-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    function getItemIcon(type) {
        const icons = {
            document: '📄',
            image: '🖼️',
            link: '🔗',
            media: '🎬'
        };
        return icons[type] || '📎';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'df-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePlatform);
    } else {
        initializePlatform();
    }

})();