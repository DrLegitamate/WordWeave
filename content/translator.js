class Translator {
  constructor() {
    this.state = null;
    this.translationCache = new Map();
    this.observer = null;
    this.isProcessing = false;
    this.processedElements = new WeakSet();
    this.retryCount = 0;
    this.maxRetries = 3;
    this.progressBar = null;
    this.commonWords = new Set();

    console.log('WordWeave: Translator constructor called');
    this.initialize();
  }

  async initialize() {
    try {
      console.log('WordWeave: Starting initialization...');

      // Get state from background script
      this.state = await browser.runtime.sendMessage({ type: 'GET_STATE' });

      if (!this.state) {
        console.error('WordWeave: Failed to get initial state from background script.');
        this.scheduleRetry();
        return;
      }

      console.log('WordWeave: Extension initialized with state:', this.state);

      // Check if site is excluded
      try {
        const excludeResponse = await browser.runtime.sendMessage({
          type: 'CHECK_SITE_EXCLUDED'
        });

        if (excludeResponse?.excluded) {
          console.log('WordWeave: Site excluded from translation.');
          return;
        }
      } catch (error) {
        console.warn('WordWeave: Could not check site exclusion:', error);
      }

      // Load common words for the detected language
      await this.loadCommonWords();

      this.setupMessageListener();
      this.createProgressBar();
      this.setupMutationObserver();

      if (this.state.enabled) {
        console.log('WordWeave: Extension is enabled, starting page processing...');
        setTimeout(() => this.processPage(), 1000);
      } else {
        console.log('WordWeave: Extension is disabled.');
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
        console.log(`WordWeave: Loaded ${this.commonWords.size} common words`);
      }
    } catch (error) {
      console.warn('WordWeave: Could not load common words:', error);
    }
  }

  createProgressBar() {
    const existingBar = document.querySelector('.gt-progress-container');
    if (existingBar) {
      existingBar.remove();
    }

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
    console.log('WordWeave: State updated:', newState);
    const wasEnabled = this.state.enabled;
    this.state = newState;

    // Reload common words if source language changed
    if (newState.sourceLanguage !== this.state.sourceLanguage) {
      await this.loadCommonWords();
    }

    if (this.state.enabled && !wasEnabled) {
      console.log('WordWeave: Extension enabled, processing page...');
      this.processPage();
    } else if (!this.state.enabled && wasEnabled) {
      console.log('WordWeave: Extension disabled, restoring original content...');
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
        console.log('WordWeave: New content detected, processing...');
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.processPage(), 1000);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async translateSelection(text) {
    if (!text || !text.trim()) return;

    try {
      this.showProgress();
      this.updateProgress(50, 100, "Translating selection...");

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
    setTimeout(() => popup.remove(), 10000);
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
    }, 4000);
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
    console.log('WordWeave: Finding text containers...');
    const containers = [];
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (this.shouldSkipElement(node)) return NodeFilter.FILTER_REJECT;
          
          const hasDirectText = Array.from(node.childNodes).some(child => 
            child.nodeType === Node.TEXT_NODE && 
            child.textContent.trim().length > 15
          );
          
          if (hasDirectText) {
            return NodeFilter.FILTER_ACCEPT;
          }
          
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      if (!this.processedElements.has(node)) {
        containers.push(node);
      }
    }

    console.log(`WordWeave: Found ${containers.length} text containers`);
    return containers.slice(0, 60);
  }

  extractWordsFromElement(element) {
    const text = element.textContent || "";
    
    // Extract individual words and meaningful phrases
    const words = text.match(/\b[\w']+\b/g) || [];
    const phrases = [];
    
    // Add individual words (filtered by length and common words)
    words.forEach(word => {
      const cleanWord = word.toLowerCase().trim();
      if (cleanWord.length >= 3 && !this.commonWords.has(cleanWord)) {
        phrases.push(word);
      }
    });
    
    // Add some meaningful short phrases (2-4 words)
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
    
    console.log(`WordWeave: Extracted ${phrases.length} words/phrases from element`);
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

    // Prioritize longer, more meaningful words/phrases
    const sortedWords = words.sort((a, b) => {
      // Prefer phrases over single words
      const aWordCount = a.split(/\s+/).length;
      const bWordCount = b.split(/\s+/).length;
      if (aWordCount !== bWordCount) {
        return bWordCount - aWordCount;
      }
      // Then by length
      return b.length - a.length;
    });

    const selectedWords = sortedWords.slice(0, targetCount);

    console.log(`WordWeave: Selected ${selectedWords.length} words/phrases for translation (${rate} intensity)`);
    return selectedWords;
  }

  async processPage() {
    if (!this.state?.enabled || this.isProcessing) {
      console.log('WordWeave: Cannot process page - already processing or disabled.');
      return;
    }

    this.isProcessing = true;
    console.log('WordWeave: Starting page processing...');

    try {
      this.showProgress();
      this.updateProgress(0, 100, 'Finding text...');

      const containers = this.findTextContainers();
      if (containers.length === 0) {
        console.log('WordWeave: No text containers found');
        this.updateProgress(100, 100, 'No text found');
        setTimeout(() => this.hideProgress(), 2000);
        return;
      }

      console.log(`WordWeave: Processing ${containers.length} containers`);

      let processedCount = 0;
      let totalTranslations = 0;

      for (let i = 0; i < containers.length; i++) {
        const element = containers[i];
        this.updateProgress(i, containers.length, `Processing text blocks...`);
        
        const words = this.extractWordsFromElement(element);
        if (words.length === 0) {
          processedCount++;
          continue;
        }

        const wordsToTranslate = this.selectWordsForTranslation(words, this.state.translationRate);
          
        if (wordsToTranslate.length === 0) {
          processedCount++;
          continue;
        }

        console.log(`WordWeave: Translating ${wordsToTranslate.length} words/phrases:`, wordsToTranslate);

        try {
          const translations = await this.translateWords(wordsToTranslate);
          if (Object.keys(translations).length > 0) {
            this.applyTranslationsToElement(element, translations);
            this.processedElements.add(element);
            totalTranslations += Object.keys(translations).length;
            console.log(`WordWeave: Applied ${Object.keys(translations).length} translations to element`);
          }
        } catch (error) {
          console.error('WordWeave: Error translating words for element:', error);
        }

        processedCount++;
        
        // Small delay to prevent overwhelming the translation service
        if (i < containers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      console.log(`WordWeave: Processing complete. Applied ${totalTranslations} total translations.`);
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
  
  async translateWords(words) {
    const translations = {};
    
    for (const word of words) {
      // Create a cache key
      const cacheKey = word.toLowerCase().trim();
      
      // Check cache first
      if (this.translationCache.has(cacheKey)) {
        translations[word] = this.translationCache.get(cacheKey);
        continue;
      }

      try {
        console.log(`WordWeave: Translating word/phrase: "${word}"`);
        
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
          console.log(`WordWeave: Translated "${word}" -> "${response.translation}"`);
        } else {
          console.log(`WordWeave: No translation for "${word}" (same as original or empty)`);
        }
      } catch (error) {
        console.error(`WordWeave: Error translating word "${word}":`, error);
      }

      // Delay between individual word translations
      await new Promise(resolve => setTimeout(resolve, 80));
    }

    console.log(`WordWeave: Translated ${Object.keys(translations).length} out of ${words.length} words/phrases`);
    return translations;
  }

  applyTranslationsToElement(element, translations) {
    if (Object.keys(translations).length === 0) return;

    console.log(`WordWeave: Applying translations to element:`, translations);

    const walker = document.createTreeWalker(
      element, 
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return node.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
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

    // Create regex for all words/phrases to translate (sorted by length, longest first)
    const sortedOriginals = Object.keys(translations).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(${sortedOriginals.map(this.escapeRegExp).join('|')})\\b`, 'gi');

    textNodes.forEach(textNode => {
      const textContent = textNode.textContent;
      const parent = textNode.parentNode;

      if (!parent || this.processedElements.has(parent)) {
        return;
      }

      const matches = [...textContent.matchAll(regex)];
      if (matches.length === 0) return;

      console.log(`WordWeave: Found ${matches.length} word/phrase matches in text node`);

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach(match => {
        const originalWord = match[0];
        const translatedWord = translations[originalWord] || 
                              translations[Object.keys(translations).find(key => 
                                key.toLowerCase() === originalWord.toLowerCase())];
        
        if (!translatedWord) return;

        // Add text before the match
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(textContent.substring(lastIndex, match.index)));
        }

        // Add the translated word in a span
        const span = document.createElement('span');
        span.className = 'gt-word';
        span.setAttribute('data-original', originalWord);
        span.textContent = translatedWord;
        span.style.setProperty('--gt-highlight-color', this.state.highlightColor || '#4a90e2');
        
        fragment.appendChild(span);
        lastIndex = match.index + originalWord.length;
      });

      // Add any remaining text
      if (lastIndex < textContent.length) {
        fragment.appendChild(document.createTextNode(textContent.substring(lastIndex)));
      }

      // Replace the text node
      try {
        parent.replaceChild(fragment, textNode);
        console.log('WordWeave: Successfully replaced text node with word translations');
      } catch(e) {
        console.error("WordWeave: Failed to replace text node:", e);
      }
    });
  }

  restoreOriginalContent() {
    console.log('WordWeave: Restoring original content...');
    const translatedElements = document.querySelectorAll('.gt-word');
    
    translatedElements.forEach(element => {
      const original = element.getAttribute('data-original');
      if (original && element.parentNode) {
          element.parentNode.replaceChild(document.createTextNode(original), element);
      }
    });

    // Normalize parent elements to merge adjacent text nodes
    const parents = new Set([...translatedElements].map(el => el.parentNode).filter(Boolean));
    parents.forEach(p => p.normalize());
    
    this.processedElements = new WeakSet();
    this.translationCache.clear();
  }

  scheduleRetry() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = 2000 * this.retryCount;
      console.log(`WordWeave: Scheduling retry attempt ${this.retryCount} in ${delay}ms`);
      setTimeout(() => this.initialize(), delay);
    } else {
        console.error("WordWeave: Max retries reached. Could not initialize.");
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

// Self-initializing function to ensure the script runs when ready
function main() {
    if (window.wordWeaveTranslator) {
        return;
    }
    console.log('WordWeave: Content script loaded.');
    window.wordWeaveTranslator = new Translator();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}