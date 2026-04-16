const DEBUG = false;
const dbg = (...args) => DEBUG && console.log(...args);
const dbgWarn = (...args) => DEBUG && console.warn(...args);

const CONFIG = {
  CACHE_MAX_SIZE: 1000,
  CACHE_TTL_MS: 30 * 60 * 1000,       // 30 minutes
  MIN_REQUEST_INTERVAL_MS: 200,
  CONCURRENT_REQUESTS: 5,
  FETCH_TIMEOUT_MS: 30000,             // 30 seconds
  BATCH_INTER_CHUNK_DELAY_MS: 100,
  WORDS_FOR_DETECTION: 100,
  MIN_DETECTION_CONFIDENCE: 3,
};

const DEFAULT_STATE = {
  enabled: false,
  translationRate: 'moderate',
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

let state = { ...DEFAULT_STATE };

// Word frequency lists for better translation selection
const WORD_FREQUENCY = {
  common: {
    'en': ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'],
    'es': ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'se', 'las', 'me', 'una', 'todo', 'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese', 'la', 'si', 'ya', 'ver', 'porque', 'dar', 'cuando', 'él', 'muy', 'sin', 'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo', 'yo', 'también', 'hasta', 'año', 'dos', 'querer', 'entre', 'así', 'primero', 'desde', 'grande', 'eso', 'ni', 'nos', 'llegar', 'pasar', 'tiempo', 'ella', 'sí', 'día', 'uno', 'bien', 'poco', 'deber', 'entonces', 'poner', 'aquí', 'parecer', 'como', 'nuevo', 'salir', 'donde', 'parte', 'tener', 'nada', 'caso', 'buscar', 'venir', 'ahora', 'mientras', 'durante']
  }
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
    if (!text || text.length < 10) {
      return 'en';
    }

    const words = text.toLowerCase().split(/\s+/).slice(0, CONFIG.WORDS_FOR_DETECTION);
    const scores = {};

    Object.keys(this.patterns).forEach(lang => {
      scores[lang] = 0;
    });

    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length < 2) return;

      Object.keys(this.patterns).forEach(lang => {
        if (this.patterns[lang].includes(cleanWord)) {
          scores[lang] += 2;
        } else if (this.patterns[lang].some(pattern => cleanWord.includes(pattern))) {
          scores[lang] += 1;
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

    return maxScore >= CONFIG.MIN_DETECTION_CONFIDENCE ? detectedLang : 'en';
  },

  detectLanguageBatch(texts) {
    if (texts.length === 0) return 'en';
    return this.detectLanguage(texts.join(' '));
  }
};

// Translation services configuration
const TRANSLATION_SERVICES = {
  libretranslate: {
    url: 'https://libretranslate.com/translate',
    batchUrl: 'https://libretranslate.com/translate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    formatRequest: (text, targetLang, sourceLang = 'auto') => ({
      q: text,
      source: sourceLang,
      target: targetLang
    }),
    formatBatchRequest: (texts, targetLang, sourceLang = 'auto') => ({
      q: texts,
      source: sourceLang,
      target: targetLang
    }),
    parseResponse: (data) => data.translatedText,
    parseBatchResponse: (data) => Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText],
    supportsAutoDetect: true,
    supportsBatch: true
  },
  mymemory: {
    url: 'https://api.mymemory.translated.net/get',
    method: 'GET',
    formatRequest: (text, targetLang, sourceLang = 'en') =>
      `?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`,
    formatBatchRequest: (texts, targetLang, sourceLang = 'en') =>
      `?q=${encodeURIComponent(texts[0])}&langpair=${sourceLang}|${targetLang}`,
    parseResponse: (data) => data.responseData.translatedText,
    parseBatchResponse: (data) => [data.responseData.translatedText],
    supportsAutoDetect: false,
    supportsBatch: false
  }
};

// Translation cache
const translationCache = new Map();

function getCachedTranslation(text, targetLang) {
  const key = `${text.toLowerCase().trim()}_${targetLang}`;
  const cached = translationCache.get(key);

  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL_MS) {
    return cached.translation;
  }

  translationCache.delete(key);
  return null;
}

function setCachedTranslation(text, targetLang, translation) {
  const key = `${text.toLowerCase().trim()}_${targetLang}`;

  if (translationCache.size >= CONFIG.CACHE_MAX_SIZE) {
    // Evict oldest entry
    translationCache.delete(translationCache.keys().next().value);
  }

  translationCache.set(key, { translation, timestamp: Date.now() });
}

// Fetch with timeout
async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Rate limiting
const translationQueue = [];
let isProcessingQueue = false;
let lastRequestTime = 0;

async function translateTextWithRateLimit(text, targetLang, sourceLang = null) {
  return new Promise((resolve, reject) => {
    translationQueue.push({ text, targetLang, sourceLang, resolve, reject });
    if (!isProcessingQueue) {
      processTranslationQueue();
    }
  });
}

async function processTranslationQueue() {
  if (translationQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  isProcessingQueue = true;
  const request = translationQueue.shift();

  try {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < CONFIG.MIN_REQUEST_INTERVAL_MS) {
      await new Promise(resolve =>
        setTimeout(resolve, CONFIG.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest)
      );
    }

    const result = await translateText(request.text, request.targetLang, request.sourceLang);
    lastRequestTime = Date.now();
    request.resolve(result);
  } catch (error) {
    request.reject(error);
  }

  setTimeout(processTranslationQueue, 0);
}

// Validate state updates
function validateStateUpdate(payload) {
  const validated = {};

  if (payload.translationRate &&
      ['minimal', 'light', 'moderate', 'medium', 'heavy', 'intensive'].includes(payload.translationRate)) {
    validated.translationRate = payload.translationRate;
  }

  if (payload.targetLanguage && typeof payload.targetLanguage === 'string' &&
      payload.targetLanguage.length === 2) {
    validated.targetLanguage = payload.targetLanguage;
  }

  if (payload.sourceLanguage && typeof payload.sourceLanguage === 'string' &&
      payload.sourceLanguage.length === 2) {
    validated.sourceLanguage = payload.sourceLanguage;
  }

  ['enabled', 'translateHeaders', 'translateNav', 'showTooltips', 'autoDetectLanguage'].forEach(key => {
    if (typeof payload[key] === 'boolean') {
      validated[key] = payload[key];
    }
  });

  if (payload.highlightColor && /^#[0-9A-F]{6}$/i.test(payload.highlightColor)) {
    validated.highlightColor = payload.highlightColor;
  }

  if (payload.fontSize && ['small', 'medium', 'large'].includes(payload.fontSize)) {
    validated.fontSize = payload.fontSize;
  }

  if (Array.isArray(payload.excludedSites)) {
    validated.excludedSites = payload.excludedSites.filter(site =>
      typeof site === 'string' && site.length > 0
    );
  }

  return validated;
}

// Batch translation function
async function translateTextBatch(texts, targetLang, sourceLang = null) {
  const service = TRANSLATION_SERVICES[state.translationService] || TRANSLATION_SERVICES.libretranslate;
  dbg('WordWeave Background: Using translation service for batch:', state.translationService);

  try {
    let sourceLanguage = sourceLang;
    if (!sourceLanguage) {
      if (state.autoDetectLanguage && service.supportsAutoDetect) {
        sourceLanguage = 'auto';
      } else if (state.autoDetectLanguage) {
        sourceLanguage = LANGUAGE_DETECTOR.detectLanguageBatch(texts);
      } else {
        sourceLanguage = state.sourceLanguage || 'en';
      }
    }

    if (service.supportsBatch) {
      const url = service.batchUrl || service.url;
      const options = {
        method: 'POST',
        headers: service.headers || {},
        body: JSON.stringify(service.formatBatchRequest(texts, targetLang, sourceLanguage))
      };

      dbg('WordWeave Background: Making batch request to:', url);
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) {
        throw new Error(`Translation service error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      const translations = service.parseBatchResponse(data);

      if (!translations || !Array.isArray(translations)) {
        throw new Error('Invalid batch translation response');
      }

      return translations;
    } else {
      const translations = [];

      for (let i = 0; i < texts.length; i += CONFIG.CONCURRENT_REQUESTS) {
        const chunk = texts.slice(i, i + CONFIG.CONCURRENT_REQUESTS);
        try {
          const chunkResults = await Promise.all(
            chunk.map(text => translateText(text, targetLang, sourceLanguage))
          );
          translations.push(...chunkResults);
        } catch (chunkError) {
          console.error('WordWeave Background: Chunk translation error:', chunkError);
          translations.push(...chunk.map(() => null));
        }

        if (i + CONFIG.CONCURRENT_REQUESTS < texts.length) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_INTER_CHUNK_DELAY_MS));
        }
      }

      return translations;
    }
  } catch (error) {
    console.error('WordWeave Background: Batch translation failed:', error);
    throw error;
  }
}

/**
 * Initialize state from storage with validation and error handling
 */
function initializeState() {
  browser.storage.local.get().then(result => {
    try {
      if (result && typeof result === 'object') {
        // Validate and merge stored state with defaults
        const validatedState = validateStateUpdate(result);
        state = { ...DEFAULT_STATE, ...validatedState };
        dbg('WordWeave Background: State loaded from storage:', state);
      } else {
        state = { ...DEFAULT_STATE };
        dbg('WordWeave Background: No stored state found, using defaults');
      }
    } catch (error) {
      console.error('WordWeave Background: Error loading state:', error);
      state = { ...DEFAULT_STATE };
      console.warn('WordWeave Background: Using default state due to error');
    }
  }).catch(error => {
    console.error('WordWeave Background: Storage access failed:', error);
    state = { ...DEFAULT_STATE };
  });
}

// Initialize state when service worker starts
initializeState();

// Listen for messages from content scripts and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  dbg('WordWeave Background: Received message:', message.type);
  switch (message.type) {
    case 'GET_STATE': {
      sendResponse(state);
      break;
    }
    case 'UPDATE_STATE': {
      const validatedPayload = validateStateUpdate(message.payload);
      const oldState = { ...state };
      state = { ...state, ...validatedPayload };

      // Persist the updated state to storage
      browser.storage.local.set(validatedPayload).then(() => {
        dbg('WordWeave Background: State updated and persisted:', validatedPayload);

        // Broadcast the full state to all tabs
        browser.tabs.query({}).then(tabs => {
          tabs.forEach(tab => {
            if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('moz-extension://')) {
              browser.tabs.sendMessage(tab.id, {
                type: 'STATE_UPDATED',
                payload: state
              }).catch(error => {
                dbg('WordWeave Background: Could not send message to tab:', error);
              });
            }
          });
        }).catch(error => {
          console.error('WordWeave Background: Failed to query tabs:', error);
        });

        sendResponse({ success: true });
      }).catch(error => {
        console.error('WordWeave Background: Failed to persist state:', error);
        // Rollback state if persistence fails
        state = oldState;
        sendResponse({ success: false, error: 'Failed to save state to storage' });
      });
      break;
    }
    case 'TRANSLATE_TEXT': {
      dbg('WordWeave Background: Translating text:', message.payload.text);
      translateTextWithRateLimit(message.payload.text, state.targetLanguage, message.payload.sourceLang)
        .then(translation => sendResponse({ translation }))
        .catch(error => {
          console.error('WordWeave Background: Translation error:', error);
          sendResponse({ error: error.message });
        });
      return true;
    }
    case 'TRANSLATE_TEXT_BATCH': {
      dbg('WordWeave Background: Translating batch:', message.payload.texts?.length, 'texts');
      translateTextBatch(message.payload.texts, state.targetLanguage, message.payload.sourceLang)
        .then(translations => sendResponse({ translations }))
        .catch(error => {
          console.error('WordWeave Background: Batch translation error:', error);
          sendResponse({ error: error.message });
        });
      return true;
    }
    case 'CHECK_SITE_EXCLUDED': {
      const url = new URL(sender.tab.url);
      const isExcluded = state.excludedSites.some(site =>
        url.hostname.includes(site) || site.includes(url.hostname)
      );
      sendResponse({ excluded: isExcluded });
      break;
    }
    case 'DETECT_LANGUAGE': {
      const detectedLang = LANGUAGE_DETECTOR.detectLanguage(message.payload.text);
      sendResponse({ language: detectedLang });
      break;
    }
    case 'GET_WORD_FREQUENCY': {
      const lang = message.payload.language || 'en';
      const commonWords = WORD_FREQUENCY.common[lang] || WORD_FREQUENCY.common['en'];
      sendResponse({ commonWords });
      break;
    }
  }
});

async function translateText(text, targetLang, sourceLang = null) {
  if (!text || text.trim().length === 0) {
    throw new Error('Empty text provided for translation');
  }

  if (!targetLang || targetLang.length !== 2) {
    throw new Error('Invalid target language');
  }

  const cachedTranslation = getCachedTranslation(text, targetLang);
  if (cachedTranslation) {
    return cachedTranslation;
  }

  const service = TRANSLATION_SERVICES[state.translationService] || TRANSLATION_SERVICES.libretranslate;

  try {
    let sourceLanguage = sourceLang;
    if (!sourceLanguage) {
      if (state.autoDetectLanguage && service.supportsAutoDetect) {
        sourceLanguage = 'auto';
      } else if (state.autoDetectLanguage) {
        sourceLanguage = LANGUAGE_DETECTOR.detectLanguage(text);
      } else {
        sourceLanguage = state.sourceLanguage || 'en';
      }
    }

    if (sourceLanguage === targetLang && sourceLanguage !== 'auto') {
      return text;
    }

    let url = service.url;
    const options = {
      method: service.method,
      headers: service.headers || {}
    };
    if (service.method === 'POST') {
      options.body = JSON.stringify(service.formatRequest(text, targetLang, sourceLanguage));
    } else {
      url += service.formatRequest(text, targetLang, sourceLanguage);
    }

    dbg('WordWeave Background: Requesting translation for:', text.substring(0, 50));
    const response = await fetchWithTimeout(url, options);
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

    setCachedTranslation(text, targetLang, translation);
    return translation;
  } catch (error) {
    console.error('WordWeave Background: Translation failed:', error);

    const fallbackStrategies = [
      () => tryAlternativeService(text, targetLang, sourceLang),
      () => tryCachedTranslation(text, targetLang),
      () => trySimpleWordTranslation(text, targetLang)
    ];

    for (const strategy of fallbackStrategies) {
      try {
        const result = await strategy();
        if (result) return result;
      } catch (fallbackError) {
        dbgWarn('WordWeave Background: Fallback failed:', fallbackError);
      }
    }

    throw new Error('All translation attempts failed: ' + error.message);
  }
}

async function tryAlternativeService(text, targetLang, sourceLang) {
  if (state.translationService === 'mymemory') {
    throw new Error('No alternative service available');
  }

  const fallbackService = TRANSLATION_SERVICES.mymemory;
  const fallbackSourceLang = sourceLang || LANGUAGE_DETECTOR.detectLanguage(text);
  const fallbackUrl = fallbackService.url + fallbackService.formatRequest(text, targetLang, fallbackSourceLang);
  const fallbackResponse = await fetchWithTimeout(fallbackUrl, {});
  if (!fallbackResponse.ok) {
    throw new Error(`Fallback service error: ${fallbackResponse.status}`);
  }
  const fallbackData = await fallbackResponse.json();
  if (fallbackData.responseStatus !== 200) {
    throw new Error(`Fallback API error: ${fallbackData.responseDetails}`);
  }
  const fallbackTranslation = fallbackService.parseResponse(fallbackData);
  setCachedTranslation(text, targetLang, fallbackTranslation);
  return fallbackTranslation;
}

function tryCachedTranslation(text, targetLang) {
  return getCachedTranslation(text, targetLang);
}

function trySimpleWordTranslation(text) {
  if (text.split(/\s+/).length === 1 && text.length < 4) {
    return text;
  }
  return null;
}

// Register context menu on install/startup (required for MV3 service workers)
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate with WordWeave',
    contexts: ['selection']
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    browser.tabs.sendMessage(tab.id, {
      type: 'TRANSLATE_SELECTION',
      payload: { text: info.selectionText }
    });
  }
});
