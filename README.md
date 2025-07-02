# WordWeave

WordWeave is a powerful Firefox extension designed to help language learners expand their vocabulary naturally while browsing the web. The extension intelligently replaces words with their translations in your target language, creating an immersive learning environment that fits seamlessly into your daily browsing routine.

## 🌟 Features

### Core Functionality
- **Smart Translation**: Automatically translates selected words on web pages using LibreTranslate
- **Contextual Learning**: Learn vocabulary in context while reading real content
- **Hover Tooltips**: See original words by hovering over translations
- **Adjustable Intensity**: Control how many words get translated (Light, Medium, Intensive)

### Learning Tools
- **Daily Goals**: Set and track daily vocabulary learning targets
- **Progress Tracking**: Monitor words learned, streaks, and overall progress
- **Learning Statistics**: Detailed insights into your language learning journey
- **Word Management**: Mark words as learned and track your vocabulary growth

### Customization
- **18 Supported Languages**: Arabic, Chinese, Dutch, English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Polish, Portuguese, Russian, Spanish, Turkish, Ukrainian, Vietnamese
- **Visual Customization**: Adjust highlight colors, font sizes, and appearance
- **Content Control**: Choose what types of content to translate (headers, navigation, etc.)
- **Site Management**: Exclude specific websites from translation

### Advanced Features
- **Multiple Translation Services**: LibreTranslate (default) and MyMemory fallback
- **Vocabulary Import/Export**: Backup and restore your learning progress
- **Context Menu Integration**: Translate selected text with right-click
- **Responsive Design**: Works seamlessly across desktop and mobile Firefox
- **Privacy-Focused**: Uses privacy-respecting translation services

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
2. **Choose Your Language**: Select your target language from the dropdown menu
3. **Set Intensity**: Choose how many words you want translated (Light: 10%, Medium: 25%, Intensive: 40%)
4. **Start Browsing**: Visit any website and watch as words get translated automatically

### Learning Features
- **Hover for Originals**: Hover over translated words to see the original text
- **Mark as Learned**: Right-click translated words to mark them as learned
- **Track Progress**: Check your daily progress and learning streaks in the popup
- **Set Goals**: Customize your daily learning goals in the settings

### Advanced Settings
Access advanced settings by clicking "Advanced Settings" in the popup:
- **Translation Settings**: Control what content gets translated
- **Appearance**: Customize colors, fonts, and visual style
- **Learning**: Set goals and view detailed statistics
- **Sites**: Manage excluded websites
- **Data**: Import/export vocabulary and manage your data

## 🛠️ Technical Details

### Architecture
- **Background Script**: Manages state, handles translations, and coordinates between components
- **Content Script**: Processes web pages and applies translations
- **Popup Interface**: Quick access to settings and statistics
- **Options Page**: Comprehensive settings and data management

### Translation Services
- **Primary**: LibreTranslate (privacy-focused, open-source)
- **Fallback**: MyMemory (backup service for reliability)
- **Auto-detection**: Automatically detects source language

### Privacy & Security
- **No Data Collection**: Your learning data stays on your device
- **Open Source Translation**: Uses LibreTranslate for privacy
- **Local Storage**: All settings and progress stored locally
- **Minimal Permissions**: Only requests necessary permissions

## 🎯 Learning Methodology

WordWeave uses proven language learning principles:

### Contextual Learning
Words are learned in their natural context, making them more memorable and easier to understand.

### Spaced Repetition
The extension tracks learned words and gradually reduces their translation frequency.

### Progressive Difficulty
Start with light translation intensity and increase as you become more comfortable.

### Immersive Experience
Learning happens naturally during your regular browsing, without dedicated study time.

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

### Building
```bash
npm run build
```

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

### Translation Help
- Help improve translation accuracy
- Add support for new languages
- Improve language detection

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
- **Local Storage Only**: All your learning data stays on your device
- **Translation Services**: Text is sent to translation services only for processing
- **No Tracking**: No analytics, tracking, or user behavior monitoring
- **Open Source**: Full transparency through open source code

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **LibreTranslate**: For providing privacy-focused translation services
- **Firefox WebExtensions**: For the robust extension platform
- **Language Learning Community**: For feedback and feature suggestions
- **Open Source Contributors**: For making this project possible

## 📞 Support

- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: Check the wiki for detailed guides
- **Community**: Join discussions in the issues section

---

**Start your language learning journey today with WordWeave!** 🌍📚

*Learn naturally, browse freely, grow continuously.*