# WordWeave

WordWeave is a powerful Firefox extension designed to help users understand foreign language content by intelligently translating a percentage of words on web pages. The extension provides an immersive translation experience that makes foreign content more accessible without completely replacing the original language.

## 🌟 Features

### Core Functionality
- **Smart Translation**: Automatically translates a configurable percentage of words on web pages using LibreTranslate
- **Contextual Learning**: See translations in context while preserving the original language structure
- **Hover Tooltips**: View original words by hovering over translations
- **Adjustable Intensity**: Control translation density (Light: 10%, Medium: 25%, Intensive: 40%)

### Translation Tools
- **Context Menu Integration**: Translate selected text with right-click
- **Real-time Processing**: Dynamic translation as new content loads
- **Multiple Services**: LibreTranslate (default) and MyMemory fallback
- **Language Detection**: Automatic source language detection

### Customization
- **18 Supported Languages**: Arabic, Chinese, Dutch, English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Polish, Portuguese, Russian, Spanish, Turkish, Ukrainian, Vietnamese
- **Visual Customization**: Adjust highlight colors, font sizes, and appearance
- **Content Control**: Choose what types of content to translate (headers, navigation, etc.)
- **Site Management**: Exclude specific websites from translation

### Advanced Features
- **Responsive Design**: Works seamlessly across desktop and mobile Firefox
- **Privacy-Focused**: Uses privacy-respecting translation services
- **Performance Optimized**: Efficient processing with minimal impact on page load times
- **Neumorphism UI**: Beautiful, modern interface design

## 🚀 Installation

### From Firefox Add-ons Store
*Coming soon - extension is currently in development*

### Manual Installation (Development)
1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the downloaded repository

## 📖 How to Use

### Getting Started
1. **Enable the Extension**: Click the WordWeave icon in your toolbar and toggle it on
2. **Choose Your Languages**: Select source and target languages from the dropdown menus
3. **Set Intensity**: Choose how many words you want translated (Light: 10%, Medium: 25%, Intensive: 40%)
4. **Start Browsing**: Visit any website and watch as words get translated automatically

### Translation Features
- **Hover for Originals**: Hover over translated words to see the original text
- **Context Menu**: Right-click selected text to get instant translations
- **Adjustable Rate**: Control the percentage of words that get translated

### Advanced Settings
Access advanced settings by clicking "Advanced Settings" in the popup:
- **Translation Settings**: Control what content gets translated and language preferences
- **Appearance**: Customize colors, fonts, and visual style
- **Sites**: Manage excluded websites
- **Data**: Reset settings and manage extension data

## 🛠️ Technical Details

### Architecture
- **Background Script**: Manages state, handles translations, and coordinates between components
- **Content Script**: Processes web pages and applies translations
- **Popup Interface**: Quick access to settings and controls
- **Options Page**: Comprehensive settings and customization

### Translation Services
- **Primary**: LibreTranslate (privacy-focused, open-source)
- **Fallback**: MyMemory (backup service for reliability)
- **Auto-detection**: Automatically detects source language when enabled

### Privacy & Security
- **No Data Collection**: Your browsing data stays on your device
- **Open Source Translation**: Uses LibreTranslate for privacy
- **Local Storage**: All settings stored locally
- **Minimal Permissions**: Only requests necessary permissions

## 🎯 Translation Methodology

WordWeave uses intelligent translation principles:

### Contextual Translation
Words are translated in their natural context, preserving the original language structure while making content more accessible.

### Percentage-Based Approach
Instead of translating everything, WordWeave translates a configurable percentage of words, allowing users to:
- Maintain exposure to the original language
- Gradually increase comprehension
- Customize difficulty level

### Smart Word Selection
The extension intelligently selects words for translation based on:
- Word frequency and importance
- Content type (headers, body text, navigation)
- User-defined translation intensity

## 🔧 Development

### Prerequisites
- Firefox Developer Edition (recommended)
- Node.js (for development tools)
- Basic knowledge of WebExtensions API

### Setup
```bash
git clone https://github.com/yourusername/wordweave
cd wordweave
npm install
```

### Testing
1. Load the extension in Firefox using `about:debugging`
2. Test on various websites with different content types
3. Verify translation services are working
4. Check responsive design on different screen sizes

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Bug Reports
- Use the GitHub issue tracker
- Include Firefox version and extension version
- Provide steps to reproduce the issue
- Include screenshots if relevant

### Feature Requests
- Check existing issues first
- Describe the feature and its benefits
- Consider implementation complexity

### Code Contributions
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📊 Supported Languages

| Language | Code | Native Name |
|----------|------|-------------|
| Arabic | ar | العربية |
| Chinese | zh | 中文 |
| Dutch | nl | Nederlands |
| English | en | English |
| French | fr | Français |
| German | de | Deutsch |
| Hindi | hi | हिन्दी |
| Indonesian | id | Bahasa Indonesia |
| Italian | it | Italiano |
| Japanese | ja | 日本語 |
| Korean | ko | 한국어 |
| Polish | pl | Polski |
| Portuguese | pt | Português |
| Russian | ru | Русский |
| Spanish | es | Español |
| Turkish | tr | Türkçe |
| Ukrainian | uk | Українська |
| Vietnamese | vi | Tiếng Việt |

## 🔒 Privacy Policy

WordWeave is committed to protecting your privacy:

- **No Personal Data Collection**: We don't collect, store, or transmit personal information
- **Local Storage Only**: All your settings stay on your device
- **Translation Services**: Text is sent to translation services only for processing
- **No Tracking**: No analytics, tracking, or user behavior monitoring
- **Open Source**: Full transparency through open source code

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **LibreTranslate**: For providing privacy-focused translation services
- **Firefox WebExtensions**: For the robust extension platform
- **Open Source Community**: For feedback and contributions

## 📞 Support

- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: Check the wiki for detailed guides
- **Community**: Join discussions in the issues section

---

**Make foreign content accessible with WordWeave!** 🌍🔗

*Translate intelligently, browse naturally, understand progressively.*