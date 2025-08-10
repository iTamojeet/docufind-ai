# DocuFind AI

DocuFind AI is a powerful Chrome extension that helps you quickly find, organize, and summarize documents, links, and files from **chat histories** on popular platforms like WhatsApp Web, Telegram, Slack, Microsoft Teams, and Discord using AI assistance.

## 🚀 Features

- **Chat-Focused Scanning**: Specifically designed for chat platforms - scans the active chat window for documents and links
- **Multi-Platform Support**: Works with WhatsApp Web, Telegram Web, Slack, Microsoft Teams, Discord
- **AI-Powered Summarization**: Uses Google Gemini AI to generate concise summaries of documents and links
- **Smart Sidebar Interface**: Non-intrusive sidebar that appears on supported chat platforms
- **OCR Support**: Extract text from images shared in chats using Tesseract.js
- **Advanced Filtering**: Filter by document type, date range, and keywords
- **Chronological Organization**: Shows files in the order they appeared in chat history
- **Caching System**: Stores summaries locally to avoid redundant API calls
- **Export Options**: Copy or download summaries as text files
- **Privacy-Focused**: Only scans when you choose, processes data locally when possible

## 🎯 How It Works

1. **Open a supported chat platform** (WhatsApp Web, Telegram, Slack, Teams, or Discord)
2. **Select a specific chat conversation** you want to analyze
3. **Click the DocuFind AI extension icon** or use the automatic sidebar
4. **Scan the current chat** for documents, images, and links
5. **Filter and browse** found items chronologically
6. **Click any item** to preview and get AI-powered summaries
7. **Copy or download** summaries for your records

### Supported Chat Platforms

- **WhatsApp Web** (`web.whatsapp.com`) - ✅ Full support
- **Telegram Web** (`web.telegram.org`) - ✅ Full support  
- **Slack** (`*.slack.com`) - ✅ Full support
- **Microsoft Teams** (`teams.microsoft.com`) - ✅ Full support
- **Discord** (`discord.com`, `app.discord.com`) - ✅ Full support

### File Types Detected

- **Documents**: PDF, DOCX, DOC, XLSX, XLS, PPTX, TXT, CSV
- **Images**: JPG, PNG, GIF, WebP, SVG (with OCR support)
- **Links**: Any HTTP/HTTPS URLs shared in chat
- **Media**: MP4, WebM, MP3 (metadata extraction)

## 📋 Prerequisites

- Python 3.8 or higher
- Google Chrome or Chromium browser  
- Google Gemini API key
- Access to supported chat platforms

## 🛠 Quick Setup

### Option 1: Automated Setup (Recommended)

```bash
# Clone and setup with one command
git clone https://github.com/yourusername/docufind-ai.git
cd docufind-ai
chmod +x install.sh
./install.sh
```

### Option 2: Manual Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/docufind-ai.git
cd docufind-ai
```

### 2. Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file with your configuration:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
BACKEND_PORT=8080
```

4. Start the backend server:
```bash
python app.py
```

The backend will be available at `http://localhost:8080`

### 3. Browser Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` folder
4. The DocuFind AI extension should now appear in your extensions

### 4. Get Google Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add the API key to your `.env` file

## 🎯 Usage

### Basic Usage

1. **Navigate to a chat platform**: Open WhatsApp Web, Telegram, Slack, Teams, or Discord
2. **Select a chat**: Click on the specific conversation you want to analyze
3. **Activate DocuFind**: The sidebar should appear automatically, or click the extension icon
4. **Scan the chat**: Click "Scan Current Chat" or it will scan automatically
5. **Browse results**: Use filters to find specific types of files or time periods
6. **Get summaries**: Click any item to preview and request AI summarization
7. **Export**: Copy or download summaries for your records

### Sidebar Features

- **Real-time Chat Detection**: Shows which chat platform and conversation is active
- **Smart Filters**: 
  - "All" - Show all found items
  - "Docs" - Documents and files only  
  - "Images" - Pictures and graphics
  - "Links" - URLs and web links
  - "Last 7d" - Items from the past week
- **Search Bar**: Find items by filename or keywords
- **Chronological Display**: Items shown in the order they appeared in chat
- **Click to Expand**: Preview items and request AI summaries
- **OCR Toggle**: Enable text extraction from images

### AI Summarization

When you click on any document or link:
- **Documents**: Attempts to extract text content for analysis
- **Links**: Fetches webpage content (when possible) 
- **Images**: Uses OCR to extract text, then summarizes
- **Generated Summary**: Shows title and bullet points
- **Export Options**: Copy to clipboard or download as text file

### Extension Popup

Click the extension icon to access:
- **Platform Status**: Shows if current site is supported
- **Quick Scan**: Manually trigger a chat scan
- **Toggle Sidebar**: Show/hide the sidebar
- **Settings**: Access configuration options

## 🏗 Architecture

### Backend (FastAPI)
- **app.py**: Main application with AI summarization logic
- **Gemini Integration**: Uses Google's Gemini AI for content analysis
- **CORS Support**: Enables cross-origin requests from the extension

### Browser Extension
- **manifest.json**: Extension configuration and permissions
- **background.js**: Service worker for handling API calls
- **content_script.js**: Injects sidebar and scans page content
- **sidebar.html/js/css**: Main UI components
- **popup.html/js**: Extension popup interface

### Key Components

1. **Content Scanner**: Automatically detects documents, images, and links on web pages
2. **AI Summarizer**: Sends content to backend for Gemini AI analysis
3. **Cache System**: Stores summaries to reduce API calls
4. **OCR Engine**: Client-side text extraction from images
5. **Export System**: Download or copy summaries

## 📊 Supported File Types

- **Documents**: PDF, DOCX, DOC, XLSX, XLS, TXT
- **Images**: JPG, PNG, GIF, WebP (with OCR support)
- **Links**: Any HTTP/HTTPS URL
- **Media**: MP4, WebM (metadata extraction)

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Your Google Gemini API key | Required |
| `GEMINI_API_URL` | Gemini API endpoint | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` |
| `BACKEND_PORT` | Backend server port | `8080` |

### Extension Settings

The extension stores settings in Chrome's local storage:
- `backendUrl`: Backend server URL (default: `http://localhost:8080`)
- `docuFind_cache`: Cached summaries

## 🚀 Development

### Running in Development Mode

1. Start the backend with auto-reload:
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8080
```

2. Load the unpacked extension in Chrome developer mode
3. Make changes and reload the extension as needed

### Building for Production

1. Update the backend URL in the extension configuration
2. Deploy the backend to your preferred cloud service
3. Package the extension for Chrome Web Store submission

## 🔒 Security & Privacy

- **Local Processing**: OCR runs entirely in the browser
- **API Security**: Uses HTTPS for all external API calls
- **No Data Storage**: Extension doesn't store personal data permanently
- **CORS Protection**: Backend includes appropriate CORS headers
- **Sandboxed Iframe**: Sidebar runs in a sandboxed context

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

1. **Extension not loading**: Check that developer mode is enabled and the extension folder path is correct
2. **API errors**: Verify your Gemini API key is valid and has sufficient quota
3. **CORS errors**: Ensure the backend is running and accessible from the extension
4. **OCR not working**: Enable the OCR toggle in the sidebar and ensure you're using HTTPS

### Debug Mode

Enable debug logging by opening Chrome DevTools:

1. Right-click on the page and select "Inspect"
2. Go to the Console tab to see extension logs
3. Check the Network tab for API request/response details
4. Use the Application tab to inspect stored data

### Performance Tips

- **Cache Management**: The extension automatically caches summaries. Clear cache if experiencing issues:
  ```javascript
  // In Chrome DevTools Console
  chrome.storage.local.clear()
  ```
- **Rate Limiting**: The Gemini API has rate limits. The extension handles errors gracefully
- **Large Files**: For large documents, consider breaking them into smaller chunks

## 📈 Roadmap

### Upcoming Features

- [ ] **Multi-language Support**: Support for non-English content
- [ ] **Advanced Filters**: Filter by file size, creation date, content type
- [ ] **Batch Processing**: Summarize multiple documents at once
- [ ] **Integration APIs**: Support for additional AI providers
- [ ] **Export Formats**: Support for PDF, Word document exports
- [ ] **Team Features**: Share summaries and collections
- [ ] **Mobile Support**: Progressive web app version

### Known Limitations

- **Cross-origin Restrictions**: Some websites may block content access due to CORS policies
- **File Size Limits**: Large files (>20MB) may timeout during processing
- **API Quotas**: Gemini API usage is subject to Google's rate limits
- **OCR Accuracy**: Text extraction quality depends on image clarity
- **Real-time Updates**: Sidebar updates may have a slight delay on dynamic pages

## 🔗 Useful Resources

- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Chrome Extension Development Guide](https://developer.chrome.com/docs/extensions/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Tesseract.js OCR Library](https://tesseract.projectnaptha.com/)

## 📞 Support

### Getting Help

1. **Check the Issues**: Look through existing GitHub issues for similar problems
2. **Documentation**: Review this README and inline code comments
3. **Community**: Join our discussions for community support
4. **Bug Reports**: Create detailed bug reports with:
   - Browser version and OS
   - Extension version
   - Console error messages
   - Steps to reproduce

### Contact Information

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/docufind-ai/issues)
- **Email**: your.email@example.com
- **Documentation**: [Full documentation](https://github.com/yourusername/docufind-ai/wiki)

## 🙏 Acknowledgments

- **Google Gemini**: For providing the AI summarization capabilities
- **Tesseract.js**: For client-side OCR functionality
- **FastAPI**: For the excellent Python web framework
- **Chrome Extensions Team**: For the comprehensive extension platform
- **Open Source Community**: For inspiration and code contributions

## 📊 Project Statistics

- **Languages**: Python, JavaScript, HTML, CSS
- **Framework**: FastAPI (Backend), Vanilla JS (Frontend)
- **AI Provider**: Google Gemini
- **OCR Engine**: Tesseract.js
- **Storage**: Chrome Local Storage
- **Architecture**: Client-Server with Browser Extension

---

**Made with ❤️ by Tamojeet**

*DocuFind AI - Making document discovery and summarization effortless.*