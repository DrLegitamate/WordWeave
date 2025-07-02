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
  customVocab: {},
  learnedWords: {},
  translationService: 'libretranslate',
  autoDetectLanguage: true,
  excludedSites: [],
  dailyGoal: 10,
  wordsLearnedToday: 0,
  lastResetDate: new Date().toDateString()
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
  
  const today = new Date().toDateString();
  if (state.lastResetDate !== today) {
    state.wordsLearnedToday = 0;
    state.lastResetDate = today;
    browser.storage.local.set({ 
      wordsLearnedToday: 0, 
      lastResetDate: today 
    });
  }
});

// Listen for messages from content scripts and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE':
      sendResponse(state);
      break;
      
    case 'UPDATE_STATE':
      state = { ...state, ...message.payload };
      browser.storage.local.set(message.payload);
      
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
      translateText(message.payload.text, state.targetLanguage, message.payload.sourceLang)
        .then(translation => {
          sendResponse({ translation });
        })
        .catch(error => {
          console.error('Translation error:', error);
          sendResponse({ error: error.message });
        });
      return true;
      
    case 'MARK_WORD_LEARNED':
      markWordAsLearned(message.payload.word, message.payload.translation);
      sendResponse({ success: true });
      break;
      
    case 'GET_STATS':
      sendResponse({
        wordsLearnedToday: state.wordsLearnedToday,
        totalWordsLearned: Object.keys(state.learnedWords).length,
        dailyGoal: state.dailyGoal,
        streak: calculateStreak()
      });
      break;
      
    case 'CHECK_SITE_EXCLUDED':
      const url = new URL(sender.tab.url);
      const isExcluded = state.excludedSites.some(site => 
        url.hostname.includes(site) || site.includes(url.hostname)
      );
      sendResponse({ excluded: isExcluded });
      break;

    case 'DETECT_LANGUAGE':
      const detectedLang = LANGUAGE_DETECTOR.detectLanguage(message.payload.text);
      sendResponse({ language: detectedLang });
      break;
  }
});

async function translateText(text, targetLang, sourceLang = null) {
  const service = TRANSLATION_SERVICES[state.translationService] || TRANSLATION_SERVICES.libretranslate;
  
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
    
    if (sourceLanguage === targetLang && sourceLanguage !== 'auto') {
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
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Translation service error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (service === TRANSLATION_SERVICES.mymemory && data.responseStatus !== 200) {
      throw new Error(`MyMemory API error: ${data.responseDetails || 'Unknown error'}`);
    }
    
    const translation = service.parseResponse(data);
    
    if (!translation || translation.trim() === '') {
      throw new Error('Empty translation received');
    }
    
    return translation;
    
  } catch (error) {
    console.error('Translation failed:', error);
    
    if (state.translationService !== 'mymemory') {
      try {
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
        
        return fallbackService.parseResponse(fallbackData);
      } catch (fallbackError) {
        console.error('Fallback translation failed:', fallbackError);
        throw new Error('All translation services failed');
      }
    }
    
    throw error;
  }
}

function markWordAsLearned(word, translation) {
  state.learnedWords[word] = {
    translation,
    learnedDate: new Date().toISOString(),
    reviewCount: 1
  };
  
  state.wordsLearnedToday++;
  
  browser.storage.local.set({
    learnedWords: state.learnedWords,
    wordsLearnedToday: state.wordsLearnedToday
  });
  
  if (state.wordsLearnedToday === state.dailyGoal) {
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Daily Goal Achieved!',
      message: `Congratulations! You've learned ${state.dailyGoal} words today.`
    });
  }
}

function calculateStreak() {
  const today = new Date();
  let streak = 0;
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toDateString();
    
    const wordsOnDate = Object.values(state.learnedWords).filter(word => 
      new Date(word.learnedDate).toDateString() === dateString
    );
    
    if (wordsOnDate.length > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  
  return streak;
}

// Add context menu for quick actions
browser.contextMenus.create({
  id: 'translate-selection',
  title: 'Translate with GlobalFoxTalk',
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