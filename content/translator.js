const DEBUG = false;
const dbg = (...args) => DEBUG && console.log(...args);

const CONFIG = {
  MAX_CONTAINERS: 60,
  MIN_TEXT_LENGTH: 15,
  INTER_ELEMENT_DELAY_MS: 50,
  MUTATION_DEBOUNCE_MS: 1000,
  INIT_DELAY_MS: 1000,
  POPUP_AUTO_CLOSE_MS: 10000,
  NOTIFICATION_DURATION_MS: 4000,
  RETRY_BASE_DELAY_MS: 2000,
  MAX_RETRIES: 3,
};

class Translator {
  constructor() {
    this.state = null;
    this.translationCache = new Map();
    this.observer = null;
    this.isProcessing = false;
    this.processedElements = new WeakSet();
    this.retryCount = 0;
    this.progressBar = null;
    this.commonWords = new Set();
    this.debounceTimer = null;
    this.initialize();
  }

  async initialize() {
    try {
      this.state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
      if (!this.state) {
        console.error('WordWeave: Failed to get initial state from background script.');
        this.scheduleRetry();
        return;
      }

      try {
        const excludeResponse = await browser.runtime.sendMessage({ type: 'CHECK_SITE_EXCLUDED' });
        if (excludeResponse?.excluded) {
          dbg('WordWeave: Site excluded from translation.');
          return;
        }
      } catch (error) {
        dbg('WordWeave: Could not check site exclusion:', error);
      }

      await this.loadCommonWords();
      this.setupMessageListener();
      this.createProgressBar();
      this.setupMutationObserver();

      if (this.state.enabled) {
        setTimeout(() => this.processPage(), CONFIG.INIT_DELAY_MS);
      }
    } catch (error) {
      console.error('WordWeave: Critical initialization failed:', error);
      this.scheduleRetry();
    }
  }

  async loadCommonWords() {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'GET_WORD_FREQUENCY',
        payload: { language: this.state.sourceLanguage }
      });
      if (response?.commonWords) {
        this.commonWords = new Set(response.commonWords);
      }
    } catch (error) {
      dbg('WordWeave: Could not load common words:', error);
    }
  }

  createProgressBar() {
    document.querySelector('.gt-progress-container')?.remove();
    const progressContainer = document.createElement('div');
    progressContainer.className = 'gt-progress-container';
    progressContainer.innerHTML = `
      <div class="gt-progress-bar">
        <div class="gt-progress-fill"></div>
      </div>
      <div class="gt-progress-text">WordWeave: Ready</div>
    `;
    document.body.appendChild(progressContainer);
    this.progressBar = progressContainer;
  }

  updateProgress(current, total, status = 'Translating...') {
    if (!this.progressBar) return;
    const progressFill = this.progressBar.querySelector('.gt-progress-fill');
    const progressText = this.progressBar.querySelector('.gt-progress-text');
    if (progressFill && progressText) {
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `WordWeave: ${status} (${percentage}%)`;
    }
  }

  showProgress() {
    if (this.progressBar) {
      this.progressBar.style.display = 'flex';
      setTimeout(() => this.progressBar.classList.add('gt-progress-show'), 10);
    }
  }

  hideProgress() {
    if (this.progressBar) {
      this.progressBar.classList.remove('gt-progress-show');
      setTimeout(() => {
        if (this.progressBar && !this.progressBar.classList.contains('gt-progress-show')) {
          this.progressBar.style.display = 'none';
        }
      }, 500);
    }
  }

  setupMessageListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'STATE_UPDATED':
          this.onStateUpdated(message.payload);
          break;
        case 'TRANSLATE_SELECTION':
          this.translateSelection(message.payload.text);
          break;
      }
      sendResponse({ status: 'ok' });
      return true;
    });
  }

  async onStateUpdated(newState) {
    const wasEnabled = this.state.enabled;
    const prevSourceLanguage = this.state.sourceLanguage;
    this.state = newState;

    if (newState.sourceLanguage !== prevSourceLanguage) {
      await this.loadCommonWords();
    }

    if (this.state.enabled && !wasEnabled) {
      this.processPage();
    } else if (!this.state.enabled && wasEnabled) {
      this.restoreOriginalContent();
      this.hideProgress();
    }
  }

  setupMutationObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.observer = new MutationObserver(mutations => {
      if (!this.state?.enabled || this.isProcessing) return;
      const hasNewContent = mutations.some(mutation =>
        mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node =>
          node.nodeType === Node.ELEMENT_NODE &&
          node.textContent &&
          node.textContent.trim().length > 20
        )
      );
      if (hasNewContent) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.processPage(), CONFIG.MUTATION_DEBOUNCE_MS);
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  async translateSelection(text) {
    if (!text || !text.trim()) return;
    try {
      this.showProgress();
      this.updateProgress(50, 100, 'Translating selection...');
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        payload: { text }
      });
      if (response?.translation) {
        this.showTranslationPopup(text, response.translation);
      } else {
        throw new Error('No translation returned from background script.');
      }
    } catch (error) {
      console.error('WordWeave: Error translating selection:', error);
      this.showNotification('Could not translate selected text.', 'error');
    } finally {
      this.hideProgress();
    }
  }

  showTranslationPopup(original, translation) {
    document.querySelector('.gt-popup')?.remove();
    const popup = document.createElement('div');
    popup.className = 'gt-popup';
    popup.innerHTML = `
      <div class="gt-popup-content">
        <div class="gt-popup-header">
          <span class="gt-popup-title">Translation</span>
          <button class="gt-popup-close" title="Close">&times;</button>
        </div>
        <div class="gt-popup-body">
          <p class="gt-original">${this.escapeHtml(original)}</p>
          <p class="gt-arrow">↓</p>
          <p class="gt-translation">${this.escapeHtml(translation)}</p>
        </div>
      </div>
    `;
    document.body.appendChild(popup);
    popup.querySelector('.gt-popup-close').addEventListener('click', () => popup.remove());
    setTimeout(() => popup.remove(), CONFIG.POPUP_AUTO_CLOSE_MS);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `gt-notification gt-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('gt-notification-show'), 10);
    setTimeout(() => {
      notification.classList.remove('gt-notification-show');
      notification.addEventListener('transitionend', () => notification.remove());
    }, CONFIG.NOTIFICATION_DURATION_MS);
  }

  shouldSkipElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
    const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'NOSCRIPT', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO'];
    if (skipTags.includes(element.tagName)) return true;
    if (element.isContentEditable) return true;
    if (element.closest('[translate="no"]')) return true;
    const skipClasses = ['notranslate', 'gt-popup', 'gt-notification', 'gt-word', 'gt-progress-container'];
    if (skipClasses.some(cls => element.classList.contains(cls))) return true;
    return false;
  }

  findTextContainers() {
    const containers = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (this.shouldSkipElement(node)) return NodeFilter.FILTER_REJECT;
          const hasDirectText = Array.from(node.childNodes).some(child =>
            child.nodeType === Node.TEXT_NODE &&
            child.textContent.trim().length > CONFIG.MIN_TEXT_LENGTH
          );
          return hasDirectText ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );
    let node;
    while (node = walker.nextNode()) {
      if (!this.processedElements.has(node)) {
        containers.push(node);
      }
    }
    dbg(`WordWeave: Found ${containers.length} text containers`);
    return containers.slice(0, CONFIG.MAX_CONTAINERS);
  }

  extractWordsFromElement(element) {
    const text = element.textContent || '';
    const words = text.match(/\b[\w']+\b/g) || [];
    const phrases = [];

    words.forEach(word => {
      const cleanWord = word.toLowerCase().trim();
      if (cleanWord.length >= 3 && !this.commonWords.has(cleanWord)) {
        phrases.push(word);
      }
    });

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    sentences.forEach(sentence => {
      const sentenceWords = sentence.trim().split(/\s+/);
      if (sentenceWords.length >= 2 && sentenceWords.length <= 4) {
        const phrase = sentenceWords.join(' ').trim();
        if (phrase.length > 5 && phrase.length < 50) {
          phrases.push(phrase);
        }
      }
    });

    return phrases;
  }

  selectWordsForTranslation(words, rate) {
    if (words.length === 0) return [];
    const rateMultipliers = {
      minimal: 0.03,
      light: 0.08,
      moderate: 0.15,
      medium: 0.25,
      heavy: 0.35,
      intensive: 0.50
    };
    const multiplier = rateMultipliers[rate] || 0.15;
    const targetCount = Math.max(1, Math.floor(words.length * multiplier));

    const sortedWords = words.sort((a, b) => {
      const aWordCount = a.split(/\s+/).length;
      const bWordCount = b.split(/\s+/).length;
      if (aWordCount !== bWordCount) return bWordCount - aWordCount;
      return b.length - a.length;
    });

    return sortedWords.slice(0, targetCount);
  }

  async processPage() {
    if (!this.state?.enabled || this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.showProgress();
      this.updateProgress(0, 100, 'Finding text...');
      const containers = this.findTextContainers();

      if (containers.length === 0) {
        this.updateProgress(100, 100, 'No text found');
        setTimeout(() => this.hideProgress(), 2000);
        return;
      }

      let totalTranslations = 0;

      for (let i = 0; i < containers.length; i++) {
        const element = containers[i];
        this.updateProgress(i, containers.length, 'Processing text blocks...');

        const words = this.extractWordsFromElement(element);
        if (words.length === 0) continue;

        const wordsToTranslate = this.selectWordsForTranslation(words, this.state.translationRate);
        if (wordsToTranslate.length === 0) continue;

        try {
          const translations = await this.translateWordsBatch(wordsToTranslate);
          if (Object.keys(translations).length > 0) {
            this.applyTranslationsToElement(element, translations);
            this.processedElements.add(element);
            totalTranslations += Object.keys(translations).length;
          }
        } catch (error) {
          console.error('WordWeave: Error translating words for element:', error);
        }

        if (i < containers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.INTER_ELEMENT_DELAY_MS));
        }
      }

      this.updateProgress(100, 100, `Complete! ${totalTranslations} words/phrases translated`);
      setTimeout(() => this.hideProgress(), 3000);
    } catch (error) {
      console.error('WordWeave: Error processing page:', error);
      this.updateProgress(100, 100, 'An error occurred');
      setTimeout(() => this.hideProgress(), 3000);
    } finally {
      this.isProcessing = false;
    }
  }

  async translateWordsBatch(words) {
    const translations = {};

    const uncachedWords = words.filter(word => {
      const cacheKey = word.toLowerCase().trim();
      if (this.translationCache.has(cacheKey)) {
        translations[word] = this.translationCache.get(cacheKey);
        return false;
      }
      return true;
    });

    if (uncachedWords.length > 0) {
      try {
        const response = await browser.runtime.sendMessage({
          type: 'TRANSLATE_TEXT_BATCH',
          payload: {
            texts: uncachedWords,
            sourceLang: this.state.autoDetectLanguage ? null : this.state.sourceLanguage
          }
        });

        if (response?.translations) {
          uncachedWords.forEach((original, index) => {
            const translation = response.translations[index];
            if (translation && translation.toLowerCase() !== original.toLowerCase()) {
              translations[original] = translation;
              this.translationCache.set(original.toLowerCase().trim(), translation);
            }
          });
        }
      } catch (error) {
        console.error('WordWeave: Batch translation failed, falling back to individual:', error);
        return await this.translateWords(words);
      }
    }

    return translations;
  }

  async translateWords(words) {
    const translations = {};
    for (const word of words) {
      const cacheKey = word.toLowerCase().trim();
      if (this.translationCache.has(cacheKey)) {
        translations[word] = this.translationCache.get(cacheKey);
        continue;
      }
      try {
        const response = await browser.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          payload: {
            text: word,
            sourceLang: this.state.autoDetectLanguage ? null : this.state.sourceLanguage
          }
        });
        if (response?.translation && response.translation.toLowerCase() !== word.toLowerCase()) {
          translations[word] = response.translation;
          this.translationCache.set(cacheKey, response.translation);
        }
      } catch (error) {
        console.error(`WordWeave: Error translating word "${word}":`, error);
      }
    }
    return translations;
  }

  applyTranslationsToElement(element, translations) {
    if (Object.keys(translations).length === 0) return;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) =>
          node.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (!this.shouldSkipElement(node.parentElement)) {
        textNodes.push(node);
      }
    }
    if (textNodes.length === 0) return;

    const sortedOriginals = Object.keys(translations).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(${sortedOriginals.map(this.escapeRegExp).join('|')})\\b`, 'gi');

    textNodes.forEach(textNode => {
      const textContent = textNode.textContent;
      const parent = textNode.parentNode;
      if (!parent || this.processedElements.has(parent)) return;

      const matches = [...textContent.matchAll(regex)];
      if (matches.length === 0) return;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach(match => {
        const originalWord = match[0];
        const translatedWord = translations[originalWord] ||
          translations[Object.keys(translations).find(key =>
            key.toLowerCase() === originalWord.toLowerCase())];
        if (!translatedWord) return;

        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(textContent.substring(lastIndex, match.index)));
        }

        const span = document.createElement('span');
        span.className = 'gt-word';
        span.setAttribute('data-original', originalWord);
        span.textContent = translatedWord;
        span.style.setProperty('--gt-highlight-color', this.state.highlightColor || '#4a90e2');
        fragment.appendChild(span);
        lastIndex = match.index + originalWord.length;
      });

      if (lastIndex < textContent.length) {
        fragment.appendChild(document.createTextNode(textContent.substring(lastIndex)));
      }

      try {
        parent.replaceChild(fragment, textNode);
      } catch (e) {
        console.error('WordWeave: Failed to replace text node:', e);
      }
    });
  }

  restoreOriginalContent() {
    const translatedElements = document.querySelectorAll('.gt-word');
    translatedElements.forEach(element => {
      const original = element.getAttribute('data-original');
      if (original && element.parentNode) {
        element.parentNode.replaceChild(document.createTextNode(original), element);
      }
    });
    const parents = new Set([...translatedElements].map(el => el.parentNode).filter(Boolean));
    parents.forEach(p => p.normalize());
    this.processedElements = new WeakSet();
    this.translationCache.clear();
  }

  scheduleRetry() {
    if (this.retryCount < CONFIG.MAX_RETRIES) {
      this.retryCount++;
      const delay = CONFIG.RETRY_BASE_DELAY_MS * this.retryCount;
      setTimeout(() => this.initialize(), delay);
    } else {
      console.error('WordWeave: Max retries reached. Could not initialize.');
    }
  }

  escapeHtml(text) {
    const p = document.createElement('p');
    p.textContent = text;
    return p.innerHTML;
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

function main() {
  if (window.wordWeaveTranslator) return;
  window.wordWeaveTranslator = new Translator();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
