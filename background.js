let state = {
  enabled: false,
  translationRate: 'medium',
  targetLanguage: 'es',
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

// Translation services configuration
const TRANSLATION_SERVICES = {
  libretranslate: {
    url: 'https://libretranslate.com/translate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    formatRequest: (text, targetLang) => ({
      q: text,
      source: 'auto',
      target: targetLang
    }),
    parseResponse: (data) => data.translatedText
  },
  mymemory: {
    url: 'https://api.mymemory.translated.net/get',
    method: 'GET',
    formatRequest: (text, targetLang) => 
      `?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`,
    parseResponse: (data) => data.responseData.translatedText
  }
};

// Initialize state from storage
browser.storage.local.get().then(result => {
  state = { ...state, ...result };
  
  // Reset daily counter if it's a new day
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
      translateText(message.payload.text, state.targetLanguage)
        .then(translation => {
          sendResponse({ translation });
        })
        .catch(error => {
          console.error('Translation error:', error);
          sendResponse({ error: error.message });
        });
      return true; // Required for async response
      
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
  }
});

async function translateText(text, targetLang) {
  const service = TRANSLATION_SERVICES[state.translationService] || TRANSLATION_SERVICES.libretranslate;
  
  try {
    let url = service.url;
    let options = {
      method: service.method,
      headers: service.headers || {}
    };
    
    if (service.method === 'POST') {
      options.body = JSON.stringify(service.formatRequest(text, targetLang));
    } else {
      url += service.formatRequest(text, targetLang);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Translation service error: ${response.status}`);
    }
    
    const data = await response.json();
    return service.parseResponse(data);
    
  } catch (error) {
    console.error('Translation failed:', error);
    
    // Fallback to alternative service
    if (state.translationService !== 'mymemory') {
      try {
        const fallbackService = TRANSLATION_SERVICES.mymemory;
        const fallbackUrl = fallbackService.url + fallbackService.formatRequest(text, targetLang);
        const fallbackResponse = await fetch(fallbackUrl);
        const fallbackData = await fallbackResponse.json();
        return fallbackService.parseResponse(fallbackData);
      } catch (fallbackError) {
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
  
  // Show achievement notification
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
  // Simple streak calculation - could be enhanced
  const today = new Date();
  let streak = 0;
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toDateString();
    
    // Check if any words were learned on this date
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