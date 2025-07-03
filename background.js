let state = {
  enabled: false,
  translationRate: 'medium',
  targetLanguage: 'es',
  sourceLanguage: 'en',
  translateHeaders: true,
  translateNav: true,
  showTooltips: true,
  highlightColor: '#4a90e2',
  fontSize: 'medium',
  translationService: 'libretranslate',
  autoDetectLanguage: true,
  excludedSites: []
};

// Language detection utility
const LANGUAGE_DETECTOR = {
  patterns: {
    'en': ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'was', 'on', 'are'],
    'es': ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da'],
    'fr': ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son'],
    'de': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im'],
    'it': ['il', 'di', 'che', 'e', 'la', 'per', 'un', 'in', 'con', 'del', 'da', 'a', 'al', 'le', 'si'],
    'pt': ['o', 'de', 'a', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no'],
    'ru': ['в', 'и', 'не', 'на', 'я', 'быть', 'то', 'он', 'оно', 'как', 'по', 'но', 'они', 'мы', 'этот'],
    'zh': ['的', '一', '是', '在', '不', '了', '有', '和', '人', '这', '中', '大', '为', '上', '个'],
    'ja': ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる', 'する'],
    'ar': ['في', 'من', 'إلى', 'على', 'هذا', 'هذه', 'التي', 'الذي', 'كان', 'لم', 'قد', 'كل', 'بعد', 'غير', 'حتى'],
    'hi': ['के', 'में', 'की', 'को', 'से', 'पर', 'है', 'का', 'एक', 'यह', 'होने', 'वह', 'लिए', 'ने', 'कि'],
    'nl': ['de', 'van', 'het', 'een', 'en', 'in', 'op', 'dat', 'met', 'voor', 'is', 'te', 'zijn', 'er', 'aan'],
    'pl': ['w', 'i', 'na', 'z', 'do', 'o', 'się', 'że', 'a', 'po', 'od', 'za', 'przez', 'dla', 'przy'],
    'tr': ['bir', 've', 'bu', 'da', 'de', 'ile', 'için', 'var', 'olan', 'daha', 'çok', 'gibi', 'kadar', 'sonra', 'ancak'],
    'ko': ['이', '의', '가', '을', '는', '에', '와', '한', '하다', '있다', '되다', '그', '나', '우리', '저'],
    'vi': ['của', 'và', 'có', 'trong', 'là', 'một', 'được', 'cho', 'đã', 'tại', 'với', 'từ', 'này', 'các', 'những'],
    'id': ['yang', 'dan', 'di', 'untuk', 'dengan', 'dari', 'pada', 'adalah', 'dalam', 'ke', 'akan', 'oleh', 'ini', 'itu', 'atau'],
    'uk': ['в', 'і', 'на', 'з', 'до', 'за', 'по', 'від', 'у', 'що', 'як', 'або', 'та', 'не', 'це']
  },

  detectLanguage(text) {
    const words = text.toLowerCase().split(/\s+/).slice(0, 50);
    const scores = {};
    
    Object.keys(this.patterns).forEach(lang => {
      scores[lang] = 0;
    });
    
    words.forEach(word => {
      Object.keys(this.patterns).forEach(lang => {
        if (this.patterns[lang].includes(word)) {
          scores[lang]++;
        }
      });
    });
    
    let maxScore = 0;
    let detectedLang = 'en';
    
    Object.keys(scores).forEach(lang => {
      if (scores[lang] > maxScore) {
        maxScore = scores[lang];
        detectedLang = lang;
      }
    });
    
    return maxScore >= 2 ? detectedLang : 'en';
  }
};

// Translation services configuration
const TRANSLATION_SERVICES = {
  libretranslate: {
    url: 'https://libretranslate.com/translate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    formatRequest: (text, targetLang, sourceLang = 'auto') => ({
      q: text,
      source: sourceLang,
      target: targetLang
    }),
    parseResponse: (data) => data.translatedText,
    supportsAutoDetect: true
  },
  mymemory: {
    url: 'https://api.mymemory.translated.net/get',
    method: 'GET',
    formatRequest: (text, targetLang, sourceLang = 'en') => 
      `?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`,
    parseResponse: (data) => data.responseData.translatedText,
    supportsAutoDetect: false
  }
};

// Initialize state from storage
browser.storage.local.get().then(result => {
  state = { ...state, ...result };
  console.log('WordWeave Background: State loaded:', state);
});

// Listen for messages from content scripts and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('WordWeave Background: Received message:', message.type);
  
  switch (message.type) {
    case 'GET_STATE':
      console.log('WordWeave Background: Sending state:', state);
      sendResponse(state);
      break;
      
    case 'UPDATE_STATE':
      state = { ...state, ...message.payload };
      browser.storage.local.set(message.payload);
      
      console.log('WordWeave Background: State updated:', state);
      
      // Notify all content scripts of state change
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('moz-extension://')) {
            browser.tabs.sendMessage(tab.id, {
              type: 'STATE_UPDATED',
              payload: state
            }).catch(() => {
              // Ignore errors for tabs that can't receive messages
            });
          }
        });
      });
      sendResponse({ success: true });
      break;
      
    case 'TRANSLATE_TEXT':
      console.log('WordWeave Background: Translating text:', message.payload.text);
      translateText(message.payload.text, state.targetLanguage, message.payload.sourceLang)
        .then(translation => {
          console.log('WordWeave Background: Translation result:', translation);
          sendResponse({ translation });
        })
        .catch(error => {
          console.error('WordWeave Background: Translation error:', error);
          sendResponse({ error: error.message });
        });
      return true;
      
    case 'CHECK_SITE_EXCLUDED':
      const url = new URL(sender.tab.url);
      const isExcluded = state.excludedSites.some(site => 
        url.hostname.includes(site) || site.includes(url.hostname)
      );
      console.log('WordWeave Background: Site exclusion check:', url.hostname, isExcluded);
      sendResponse({ excluded: isExcluded });
      break;

    case 'DETECT_LANGUAGE':
      const detectedLang = LANGUAGE_DETECTOR.detectLanguage(message.payload.text);
      console.log('WordWeave Background: Language detected:', detectedLang);
      sendResponse({ language: detectedLang });
      break;
  }
});

async function translateText(text, targetLang, sourceLang = null) {
  const service = TRANSLATION_SERVICES[state.translationService] || TRANSLATION_SERVICES.libretranslate;
  
  console.log('WordWeave Background: Using translation service:', state.translationService);
  
  try {
    let sourceLanguage = sourceLang;
    
    if (!sourceLanguage) {
      if (state.autoDetectLanguage && service.supportsAutoDetect) {
        sourceLanguage = 'auto';
      } else if (state.autoDetectLanguage && !service.supportsAutoDetect) {
        sourceLanguage = LANGUAGE_DETECTOR.detectLanguage(text);
      } else {
        sourceLanguage = state.sourceLanguage || 'en';
      }
    }
    
    console.log('WordWeave Background: Translation params:', {
      text: text.substring(0, 50),
      source: sourceLanguage,
      target: targetLang
    });
    
    if (sourceLanguage === targetLang && sourceLanguage !== 'auto') {
      console.log('WordWeave Background: Source and target languages are the same, returning original text');
      return text;
    }
    
    let url = service.url;
    let options = {
      method: service.method,
      headers: service.headers || {}
    };
    
    if (service.method === 'POST') {
      options.body = JSON.stringify(service.formatRequest(text, targetLang, sourceLanguage));
    } else {
      url += service.formatRequest(text, targetLang, sourceLanguage);
    }
    
    console.log('WordWeave Background: Making request to:', url);
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Translation service error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('WordWeave Background: Translation response:', data);
    
    if (service === TRANSLATION_SERVICES.mymemory && data.responseStatus !== 200) {
      throw new Error(`MyMemory API error: ${data.responseDetails || 'Unknown error'}`);
    }
    
    const translation = service.parseResponse(data);
    
    if (!translation || translation.trim() === '') {
      throw new Error('Empty translation received');
    }
    
    console.log('WordWeave Background: Final translation:', translation);
    return translation;
    
  } catch (error) {
    console.error('WordWeave Background: Translation failed:', error);
    
    if (state.translationService !== 'mymemory') {
      try {
        console.log('WordWeave Background: Trying fallback service...');
        const fallbackService = TRANSLATION_SERVICES.mymemory;
        const fallbackSourceLang = sourceLang || LANGUAGE_DETECTOR.detectLanguage(text);
        const fallbackUrl = fallbackService.url + fallbackService.formatRequest(text, targetLang, fallbackSourceLang);
        
        const fallbackResponse = await fetch(fallbackUrl);
        if (!fallbackResponse.ok) {
          throw new Error(`Fallback service error: ${fallbackResponse.status}`);
        }
        
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.responseStatus !== 200) {
          throw new Error(`Fallback API error: ${fallbackData.responseDetails}`);
        }
        
        const fallbackTranslation = fallbackService.parseResponse(fallbackData);
        console.log('WordWeave Background: Fallback translation successful:', fallbackTranslation);
        return fallbackTranslation;
      } catch (fallbackError) {
        console.error('WordWeave Background: Fallback translation failed:', fallbackError);
        throw new Error('All translation services failed');
      }
    }
    
    throw error;
  }
}

// Add context menu for quick actions
browser.contextMenus.create({
  id: 'translate-selection',
  title: 'Translate with WordWeave',
  contexts: ['selection']
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    browser.tabs.sendMessage(tab.id, {
      type: 'TRANSLATE_SELECTION',
      payload: { text: info.selectionText }
    });
  }
});