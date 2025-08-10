# DocuFind AI

DocuFind AI is a powerful browser extension that helps you quickly find, organize, and summarize documents, links, and files from chat histories and web pages using AI assistance.

## 🚀 Features

- **Smart Content Discovery**: Automatically scans web pages for documents, images, and links
- **AI-Powered Summarization**: Uses Google Gemini AI to generate concise summaries of content
- **Real-time Sidebar**: Non-intrusive sidebar interface for easy access
- **OCR Support**: Extract text from images using Tesseract.js
- **Advanced Filtering**: Filter content by type, date, and keywords
- **Caching System**: Stores summaries locally to avoid redundant API calls
- **Export Options**: Copy or download summaries as text files

## 📋 Prerequisites

- Python 3.8 or higher
- Node.js (for development)
- Google Chrome or Chromium browser
- Google Gemini API key

## 🛠 Installation

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

1. **Automatic Scanning**: The extension automatically injects a sidebar on web pages and scans for documents, links, and images
2. **Manual Scanning**: Use the popup (click the extension icon) to manually scan the current page
3. **Filtering**: Use the sidebar filters to narrow down results by type or date
4. **Summarization**: Click on any item in the sidebar to preview it and request an AI summary

### Sidebar Features

- **Search**: Use the search bar to find specific content
- **Type Filters**: Filter by documents, images, or links
- **Time Filters**: Show only items from the last 7 days
- **OCR**: Extract text from images (enable the OCR toggle first)
- **Export**: Copy or download summaries

### API Endpoints

The backend provides the following API endpoints:

- `POST /analyze`: Analyze and summarize text or messages
  ```json
  {
    "text": "Content to analyze",
    "messages": ["array", "of", "messages"],
    "href": "optional_source_url"
  }
  ```

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