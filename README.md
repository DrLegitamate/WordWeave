# WordWeave 🌍

**Learn languages naturally while browsing with intelligent, context-aware translations**

WordWeave is a powerful Firefox extension that revolutionizes language learning by providing **smart word and phrase translations** on any website. Unlike traditional translators that replace entire content, WordWeave selectively translates individual words and meaningful phrases, preserving the natural reading experience while providing contextual learning opportunities.

---

## 🌟 Key Features

### 🧠 **Smart Word Selection**
- **Intelligent Filtering**: Skips common words you already know
- **Context-Aware**: Translates "can" correctly based on context ("tin can" vs "you can do this")
- **Meaningful Phrases**: Includes short phrases (2-4 words) for better context
- **Adaptive Learning**: Focuses on vocabulary that matters for your level

### ⚡ **Precision Translation System**
- **6 Intensity Levels**: From minimal (3%) to intensive (50%) word coverage
- **Word-Level Accuracy**: Only translated words are highlighted, not entire blocks
- **Real-Time Processing**: Dynamic translation as new content loads
- **Privacy-First**: Uses LibreTranslate for secure, private translations

### 🎨 **Seamless User Experience**
- **Hover Tooltips**: See original words by hovering over translations
- **Context Menu**: Right-click any text for instant translation
- **Visual Customization**: Adjust colors, fonts, and appearance
- **Clean Interface**: Only translated content is visually distinct

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
3. **Set Intensity**: Choose how many words to translate
4. **Start Learning**: Visit any website and see individual word translations!

---

## 🎯 How WordWeave Works

### **The Smart Translation Difference** 🧠

WordWeave solves the context problem that plagues traditional translators:

| ❌ **Traditional Problem** | ✅ **WordWeave Solution** |
|---------------------------|---------------------------|
| "can" → always "lata" (tin can) | **Context-aware**: "I **can** do this" → "**puedo**" |
| "bank" → always "banco" (financial) | **Smart detection**: "river **bank**" → "**orilla**" |
| Entire sentences replaced | **Selective**: Only specific **words** highlighted |
| Overwhelming text blocks | **Clean**: Original text preserved with targeted learning |

### **Intelligent Word Selection** 📝

WordWeave carefully chooses what to translate:

1. **Filters out common words** you likely already know
2. **Prioritizes meaningful vocabulary** for learning
3. **Includes contextual phrases** when needed for clarity
4. **Maintains reading flow** with selective highlighting

### **Translation Intensity Levels** 📊

Choose your learning pace:

| Level | Coverage | Best For | What You See |
|-------|----------|----------|--------------|
| **Minimal** | 3% | Complete beginners | Few key words translated |
| **Light** | 8% | Gentle introduction | Light vocabulary exposure |
| **Moderate** | 15% | Balanced learning | Comfortable word density |
| **Medium** | 25% | Standard learning | Regular vocabulary building |
| **Heavy** | 35% | Intensive study | High word exposure |
| **Intensive** | 50% | Advanced learners | Maximum vocabulary challenge |

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
- **Word Filtering**: Smart common word detection

### **Privacy & Security** 🔒
- **No Data Collection**: Your browsing stays private
- **Local Storage**: All settings stored on your device
- **Open Source**: Full transparency and community-driven
- **Minimal Permissions**: Only requests necessary access

---

## 📖 Usage Guide

### **Basic Usage**
1. **Browse Normally**: Visit any foreign language website
2. **See Translations**: Individual translated words appear highlighted
3. **Hover for Originals**: Mouse over to see original words
4. **Right-Click Translate**: Select any text for instant translation

### **What You'll See**
- **Original text**: "I need to **depositar** money at the **banco**"
- **Clean highlighting**: Only translated words stand out
- **Preserved context**: Sentence structure remains natural
- **Hover tooltips**: See "deposit" and "bank" on hover

### **Advanced Settings**
Access comprehensive settings via "Advanced Settings":

#### **Translation Tab** 🌐
- **Source/Target Languages**: Configure language pairs
- **Translation Intensity**: Adjust word coverage percentage
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
│  Translation    │    │   Word-Level     │    │  User Settings  │
│   Services      │    │   Processing     │    │   Management    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **Translation Pipeline**
1. **Content Detection**: Identify translatable text containers
2. **Word Extraction**: Extract individual words and short phrases
3. **Smart Filtering**: Remove common words using frequency lists
4. **Context Analysis**: Maintain word relationships and meaning
5. **Selective Translation**: Translate only chosen vocabulary
6. **Precise Application**: Replace only specific words, not entire blocks
7. **Visual Enhancement**: Apply styling only to translated words

### **Performance Optimizations**
- **Intelligent Caching**: Avoid redundant translations
- **Batch Processing**: Efficient API usage
- **Debounced Updates**: Smooth handling of dynamic content
- **Memory Management**: Prevent memory leaks with WeakSet usage
- **Word-Level Precision**: Minimal DOM manipulation

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
| **Translation Precision** | ✅ Word-level accuracy | ❌ Block-level replacement |
| **Context Awareness** | ✅ Smart word selection | ❌ Word-by-word only |
| **Learning Focus** | ✅ Selective vocabulary | ❌ Complete replacement |
| **Reading Experience** | ✅ Preserved flow | ❌ Disrupted layout |
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

**WordWeave** - *Translate precisely, browse naturally, learn effectively* 🌍🔗

[⭐ Star on GitHub](https://github.com/DrLegitamate/WordWeave) | [🐛 Report Issues](https://github.com/DrLegitamate/WordWeave/issues) | [💡 Request Features](https://github.com/DrLegitamate/WordWeave/issues/new)

</div>