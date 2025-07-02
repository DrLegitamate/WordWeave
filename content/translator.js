class Translator {
  constructor() {
    this.state = null;
    this.translationCache = new Map();
    this.pendingTranslations = new Set();
    this.observer = null;
    this.isProcessing = false;
    this.processedElements = new WeakSet();
    this.retryCount = 0;
    this.maxRetries = 3;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Check if site is excluded
      const excludeResponse = await browser.runtime.sendMessage({ 
        type: 'CHECK_SITE_EXCLUDED' 
      });
      
      if (excludeResponse.excluded) {
        console.log('GlobalFoxTalk: Site excluded from translation');
        return;
      }
      
      this.state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
      
      if (!this.state) {
        console.error('GlobalFoxTalk: Failed to get initial state');
        return;
      }
      
      console.log('GlobalFoxTalk: Extension initialized, enabled:', this.state.enabled);
      
      this.setupMessageListener();
      this.setupMutationObserver();
      this.setupContextMenuHandler();
      
      // Process page if extension is enabled
      if (this.state.enabled) {
        setTimeout(() => this.processPage(), 1000);
      }
      
    } catch (error) {
      console.error('GlobalFoxTalk: Initialization failed:', error);
      this.scheduleRetry();
    }
  }

  setupMessageListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STATE_UPDATED') {
        this.state = message.payload;
        if (this.state.enabled) {
          this.processPage();
        } else {
          this.restoreOriginalContent();
        }
      } else if (message.type === 'TRANSLATE_SELECTION') {
        this.translateSelection(message.payload.text);
      }
      sendResponse({ status: 'ok' });
    });
  }

  setupMutationObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.observer = new MutationObserver(mutations => {
      if (!this.state?.enabled || this.isProcessing) return;

      const newNodes = [];
      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && !this.shouldSkipElement(node)) {
              newNodes.push(node);
            }
          });
        }
      }

      if (newNodes.length > 0) {
        this.processNewNodes(newNodes);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  setupContextMenuHandler() {
    // Context menu handling is done through message listener
  }

  async translateSelection(text) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        payload: {
          text: text,
          sourceLang: this.state.autoDetectLanguage ? null : this.state.sourceLanguage,
          targetLang: this.state.targetLanguage
        }
      });

      if (response && response.translation) {
        this.showTranslationPopup(text, response.translation);
      } else {
        this.showNotification('Could not translate selected text.', 'error');
      }
    } catch (error) {
      console.error('GlobalFoxTalk: Error translating selection:', error);
      this.showNotification('Error translating text. Please try again.', 'error');
    }
  }

  showTranslationPopup(original, translation) {
    // Remove any existing popup
    const existingPopup = document.querySelector('.gt-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'gt-popup';
    popup.innerHTML = `
      <div class="gt-popup-content">
        <div class="gt-popup-header">
          <span class="gt-popup-title">Translation</span>
          <button class="gt-popup-close">&times;</button>
        </div>
        <div class="gt-popup-body">
          <span class="gt-original">${this.escapeHtml(original)}</span>
          <span class="gt-arrow">→</span>
          <span class="gt-translation">${this.escapeHtml(translation)}</span>
        </div>
        <div class="gt-popup-actions">
          <button class="gt-learn-btn">Mark as Learned</button>
        </div>
      </div>
    `;

    // Position popup near selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      popup.style.position = 'fixed';
      popup.style.left = `${rect.left}px`;
      popup.style.top = `${rect.bottom + 10}px`;
      popup.style.zIndex = '10001';
    }

    document.body.appendChild(popup);

    // Event listeners
    popup.querySelector('.gt-popup-close').addEventListener('click', () => {
      popup.remove();
    });

    popup.querySelector('.gt-learn-btn').addEventListener('click', () => {
      this.markWordAsLearned(original, translation);
      popup.remove();
    });

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 10000);
  }

  async markWordAsLearned(word, translation) {
    try {
      await browser.runtime.sendMessage({
        type: 'MARK_WORD_LEARNED',
        payload: { word, translation }
      });
      this.showNotification(`"${word}" marked as learned!`, 'success');
    } catch (error) {
      console.error('Error marking word as learned:', error);
      this.showNotification('Error saving word', 'error');
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `gt-notification gt-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
      notification.classList.add('gt-notification-show');
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('gt-notification-show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }

  shouldSkipElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
    
    const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'NOSCRIPT', 'SVG'];
    const skipClasses = ['no-translate', 'notranslate', 'gt-popup', 'gt-notification', 'gt-word'];

    if (element.closest('button, [role="button"]') !== null) {
      return true;
    }

    if (skipTags.includes(element.tagName)) {
      return true;
    }

    if (skipClasses.some(cls => element.classList?.contains(cls))) {
      return true;
    }

    if (element.isContentEditable) {
      return true;
    }

    if (element.getAttribute('translate') === 'no' || element.closest('[translate="no"]') !== null) {
      return true;
    }

    return false;
  }

  isSignificantTextBlock(element) {
    if (element.nodeType !== Node.ELEMENT_NODE) return false;
    if (this.shouldSkipElement(element)) return false;
    if (!element.textContent?.trim()) return false;
    if (this.processedElements.has(element)) return false;

    const textLength = element.textContent.trim().length;
    if (textLength < 10 || textLength > 2000) return false;

    // Check if element has meaningful text content (not just whitespace/symbols)
    const meaningfulText = element.textContent.match(/[a-zA-ZÀ-ÿĀ-žА-я]/g);
    if (!meaningfulText || meaningfulText.length < 5) return false;

    return true;
  }

  extractWordsFromElement(element) {
    const text = element.textContent.trim();
    if (!text) return [];

    // Extract words using improved regex
    const words = text.match(/\b[a-zA-ZÀ-ÿĀ-žА-я]{2,20}\b/g) || [];
    
    return words.filter(word => {
      const lowerWord = word.toLowerCase();
      return !this.state.learnedWords[lowerWord] && 
             !this.translationCache.has(lowerWord) &&
             word.length >= 2 && 
             word.length <= 20;
    });
  }

  async processPage() {
    if (!this.state?.enabled || this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('GlobalFoxTalk: Processing page for translation...');

    try {
      // Find all text-containing elements
      const elements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, a, strong, em, b, i, article, section, main');
      
      const significantElements = Array.from(elements)
        .filter(el => this.isSignificantTextBlock(el))
        .slice(0, 50); // Limit to first 50 elements

      console.log(`GlobalFoxTalk: Found ${significantElements.length} elements to process`);

      if (significantElements.length === 0) {
        console.log('GlobalFoxTalk: No suitable elements found');
        this.isProcessing = false;
        return;
      }

      // Process elements in batches
      for (let i = 0; i < significantElements.length; i += 5) {
        const batch = significantElements.slice(i, i + 5);
        await this.processBatch(batch);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error('GlobalFoxTalk: Error processing page:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processBatch(elements) {
    for (const element of elements) {
      try {
        const words = this.extractWordsFromElement(element);
        if (words.length === 0) continue;

        // Apply translation rate filter
        const rateMultipliers = { low: 0.1, medium: 0.25, high: 0.4 };
        const rate = rateMultipliers[this.state.translationRate] || 0.25;
        const wordsToTranslate = words.filter(() => Math.random() < rate).slice(0, 3);

        if (wordsToTranslate.length === 0) continue;

        // Translate words
        const translations = await this.translateWords(wordsToTranslate);
        
        // Apply translations to element
        if (Object.keys(translations).length > 0) {
          this.applyTranslationsToElement(element, translations);
          this.processedElements.add(element);
        }

      } catch (error) {
        console.error('GlobalFoxTalk: Error processing element:', error);
      }
    }
  }

  async translateWords(words) {
    const translations = {};
    
    for (const word of words) {
      try {
        if (this.translationCache.has(word.toLowerCase())) {
          translations[word] = this.translationCache.get(word.toLowerCase());
          continue;
        }

        const response = await browser.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          payload: {
            text: word,
            sourceLang: this.state.autoDetectLanguage ? null : this.state.sourceLanguage
          }
        });

        if (response && response.translation && response.translation !== word) {
          translations[word] = response.translation;
          this.translationCache.set(word.toLowerCase(), response.translation);
        }

      } catch (error) {
        console.error(`GlobalFoxTalk: Error translating word "${word}":`, error);
      }
    }

    return translations;
  }

  applyTranslationsToElement(element, translations) {
    let html = element.innerHTML;
    
    Object.entries(translations).forEach(([original, translation]) => {
      const regex = new RegExp(`\\b(${this.escapeRegExp(original)})\\b`, 'gi');
      html = html.replace(regex, (match) => {
        return `<span class="gt-word" data-original="${this.escapeHtml(match)}" title="${this.escapeHtml(match)}">${this.escapeHtml(translation)}</span>`;
      });
    });
    
    if (html !== element.innerHTML) {
      element.innerHTML = html;
    }
  }

  processNewNodes(nodes) {
    if (!this.state?.enabled || this.isProcessing) return;
    
    const significantNodes = nodes.filter(node => this.isSignificantTextBlock(node));
    if (significantNodes.length > 0) {
      setTimeout(() => this.processBatch(significantNodes), 500);
    }
  }

  restoreOriginalContent() {
    console.log('GlobalFoxTalk: Restoring original content');
    
    const translatedElements = document.querySelectorAll('.gt-word');
    translatedElements.forEach(element => {
      const original = element.getAttribute('data-original');
      if (original) {
        element.outerHTML = original;
      }
    });
    
    this.processedElements = new WeakSet();
    this.translationCache.clear();
  }

  scheduleRetry() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      setTimeout(() => {
        console.log(`GlobalFoxTalk: Retry attempt ${this.retryCount}`);
        this.initialize();
      }, 2000 * this.retryCount);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Initialize translator when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Translator());
} else {
  new Translator();
}