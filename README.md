# WordWeave 🌍

**Learn languages naturally while browsing with intelligent, context-aware translations**

WordWeave is a powerful Firefox extension that revolutionizes language learning by providing **context-aware phrase translations** on any website. Unlike traditional word-by-word translators, WordWeave understands context and translates meaningful phrases, making foreign content accessible while preserving the natural learning experience.

---

## 🌟 Key Features

### 🧠 **Context-Aware Translation**
- **Phrase-Based Intelligence**: Translates complete phrases and sentences for accurate meaning
- **Contextual Understanding**: "I can do this" vs "tin can" - always gets the right translation
- **Natural Language Processing**: Preserves sentence structure and grammatical relationships
- **Smart Phrase Selection**: Intelligently chooses meaningful phrases for optimal learning

### ⚡ **Intelligent Translation System**
- **6 Intensity Levels**: From minimal (3%) to intensive (50%) phrase coverage
- **Real-Time Processing**: Dynamic translation as new content loads
- **Adaptive Learning**: Balances exposure with comprehension
- **Privacy-First**: Uses LibreTranslate for secure, private translations

### 🎨 **Seamless User Experience**
- **Hover Tooltips**: See original phrases by hovering over translations
- **Context Menu**: Right-click any text for instant translation
- **Visual Customization**: Adjust colors, fonts, and appearance
- **Responsive Design**: Works perfectly on desktop and mobile Firefox

### 🌐 **Comprehensive Language Support**
**18 Languages Supported**: Arabic, Chinese, Dutch, English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Polish, Portuguese, Russian, Spanish, Turkish, Ukrainian, Vietnamese

---

## 🚀 Quick Start

### Installation
1. **From Firefox Add-ons** *(Coming Soon)*
2. **Manual Installation**: 
   - Download from [GitHub](https://github.com/DrLegitamate/WordWeave)
   - Load in Firefox via `about:debugging` → "Load Temporary Add-on"

### Setup in 30 Seconds
1. **Enable WordWeave**: Click the toolbar icon and toggle ON
2. **Choose Languages**: Select your target language (e.g., Spanish)
3. **Set Intensity**: Choose how many phrases to translate
4. **Start Learning**: Visit any website and see contextual translations!

---

## 🎯 How WordWeave Works

### **The Context Revolution** 🧠

Traditional translators fail because they translate words in isolation. WordWeave solves this with **phrase-based contextual translation**:

| ❌ **Old Way (Word-by-Word)** | ✅ **WordWeave (Context-Aware)** |
|-------------------------------|-----------------------------------|
| "can" → "lata" (always tin can) | "I **can do this**" → "**Puedo hacer esto**" |
| "bank" → "banco" (always financial) | "river **bank**" → "**orilla del río**" |
| "light" → "luz" (always illumination) | "**light weight**" → "**peso ligero**" |

### **Smart Phrase Selection** 📝

WordWeave intelligently extracts and translates:
- **Complete sentences** for full context
- **Meaningful phrases** at natural break points
- **Grammatically coherent** text segments
- **Contextually appropriate** translations

### **Intensity Levels** 📊

Choose your learning pace:

| Level | Coverage | Best For |
|-------|----------|----------|
| **Minimal** | 3% | Complete beginners, light exposure |
| **Light** | 8% | Gentle introduction to new languages |
| **Moderate** | 15% | Balanced learning experience |
| **Medium** | 25% | Standard language learning |
| **Heavy** | 35% | Intensive vocabulary building |
| **Intensive** | 50% | Maximum exposure for advanced learners |

---

## 🛠️ Advanced Features

### **Translation Services** 🔄
- **Primary**: LibreTranslate (privacy-focused, open-source)
- **Fallback**: MyMemory (reliability backup)
- **Auto-Detection**: Automatically identifies source language

### **Customization Options** 🎨
- **Visual Styling**: Custom highlight colors and fonts
- **Content Control**: Choose what to translate (headers, navigation, body text)
- **Site Management**: Exclude specific websites
- **Responsive Design**: Optimized for all screen sizes

### **Privacy & Security** 🔒
- **No Data Collection**: Your browsing stays private
- **Local Storage**: All settings stored on your device
- **Open Source**: Full transparency and community-driven
- **Minimal Permissions**: Only requests necessary access

---

## 📖 Usage Guide

### **Basic Usage**
1. **Browse Normally**: Visit any foreign language website
2. **See Translations**: Translated phrases appear highlighted
3. **Hover for Originals**: Mouse over to see original text
4. **Right-Click Translate**: Select any text for instant translation

### **Advanced Settings**
Access comprehensive settings via "Advanced Settings":

#### **Translation Tab** 🌐
- **Source/Target Languages**: Configure language pairs
- **Translation Intensity**: Adjust phrase coverage
- **Content Types**: Control what gets translated
- **Service Provider**: Choose translation engine

#### **Appearance Tab** 🎨
- **Highlight Colors**: Customize visual appearance
- **Font Sizes**: Adjust text display
- **Preview**: See changes in real-time

#### **Sites Tab** 🌍
- **Excluded Sites**: Manage website blacklist
- **Current Site**: Quick-add current domain

---

## 🔧 Technical Details

### **Architecture**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Background    │◄──►│  Content Script  │◄──►│   Popup/Options │
│     Script      │    │   (Translator)   │    │      UI         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Translation    │    │   Page Content   │    │  User Settings  │
│   Services      │    │   Processing     │    │   Management    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **Translation Pipeline**
1. **Content Detection**: Identify translatable text containers
2. **Phrase Extraction**: Split content into meaningful phrases
3. **Context Analysis**: Maintain grammatical relationships
4. **Smart Selection**: Choose phrases based on intensity setting
5. **Batch Translation**: Send phrases to translation service
6. **Contextual Application**: Replace original with translated phrases
7. **Visual Enhancement**: Apply styling and hover tooltips

### **Performance Optimizations**
- **Intelligent Caching**: Avoid redundant translations
- **Batch Processing**: Efficient API usage
- **Debounced Updates**: Smooth handling of dynamic content
- **Memory Management**: Prevent memory leaks with WeakSet usage

---

## 🌍 Supported Languages

<details>
<summary><strong>Click to see all 18 supported languages</strong></summary>

| Language | Code | Native Name | Script |
|----------|------|-------------|--------|
| Arabic | `ar` | العربية | Right-to-left |
| Chinese | `zh` | 中文 | Logographic |
| Dutch | `nl` | Nederlands | Latin |
| English | `en` | English | Latin |
| French | `fr` | Français | Latin |
| German | `de` | Deutsch | Latin |
| Hindi | `hi` | हिन्दी | Devanagari |
| Indonesian | `id` | Bahasa Indonesia | Latin |
| Italian | `it` | Italiano | Latin |
| Japanese | `ja` | 日本語 | Mixed scripts |
| Korean | `ko` | 한국어 | Hangul |
| Polish | `pl` | Polski | Latin |
| Portuguese | `pt` | Português | Latin |
| Russian | `ru` | Русский | Cyrillic |
| Spanish | `es` | Español | Latin |
| Turkish | `tr` | Türkçe | Latin |
| Ukrainian | `uk` | Українська | Cyrillic |
| Vietnamese | `vi` | Tiếng Việt | Latin with diacritics |

</details>

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### **Bug Reports** 🐛
- Use [GitHub Issues](https://github.com/DrLegitamate/WordWeave/issues)
- Include Firefox version and extension version
- Provide reproduction steps and screenshots

### **Feature Requests** 💡
- Check existing issues first
- Describe the feature and its benefits
- Consider implementation complexity

### **Code Contributions** 👨‍💻
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Submit a pull request with detailed description

### **Translation Improvements** 🌐
- Help improve language support
- Test translations in your native language
- Report context-specific translation issues

---

## 📊 Comparison

| Feature | WordWeave | Traditional Translators |
|---------|-----------|------------------------|
| **Context Awareness** | ✅ Phrase-based | ❌ Word-by-word |
| **Learning Focus** | ✅ Gradual exposure | ❌ Complete replacement |
| **Privacy** | ✅ No data collection | ❌ Often tracks users |
| **Customization** | ✅ Highly configurable | ❌ Limited options |
| **Performance** | ✅ Optimized for browsing | ❌ Often slow/intrusive |
| **Open Source** | ✅ Fully transparent | ❌ Proprietary |

---

## 🔒 Privacy Policy

**Your privacy is our priority:**

- **Zero Data Collection**: We don't collect, store, or transmit personal information
- **Local Storage Only**: All settings remain on your device
- **Translation Privacy**: Text sent only for processing, not stored
- **No Tracking**: No analytics, cookies, or user behavior monitoring
- **Open Source**: Complete transparency through public code

---

## 📞 Support & Community

### **Get Help**
- **Documentation**: Check our [Wiki](https://github.com/DrLegitamate/WordWeave/wiki)
- **Issues**: Report bugs on [GitHub](https://github.com/DrLegitamate/WordWeave/issues)
- **Discussions**: Join community conversations

### **Stay Updated**
- **GitHub**: Star and watch the repository
- **Releases**: Get notified of new versions
- **Changelog**: Track feature updates and improvements

---

## 🙏 Acknowledgments

- **LibreTranslate**: Privacy-focused translation services
- **Firefox WebExtensions**: Robust extension platform
- **Open Source Community**: Invaluable feedback and contributions
- **Language Learners**: Inspiration and real-world testing

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🚀 Get Started Today!

**Transform your browsing into a language learning adventure!**

1. **[Download WordWeave](https://github.com/DrLegitamate/WordWeave)** 📥
2. **Choose your target language** 🌐
3. **Start learning naturally** 🧠
4. **Browse the web with confidence** ✨

---

<div align="center">

**WordWeave** - *Translate intelligently, browse naturally, learn contextually* 🌍🔗

[⭐ Star on GitHub](https://github.com/DrLegitamate/WordWeave) | [🐛 Report Issues](https://github.com/DrLegitamate/WordWeave/issues) | [💡 Request Features](https://github.com/DrLegitamate/WordWeave/issues/new)

</div>