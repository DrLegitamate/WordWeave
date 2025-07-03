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

    console.log('WordWeave: Translator constructor called');
    this.initialize();
  }

  async initialize() {
    try {
      console.log('WordWeave: Starting initialization...');

      // Check if the background script is ready
      try {
        await browser.runtime.sendMessage({ type: 'PING' });
      } catch (error) {
        console.error('WordWeave: Background script not ready. Retrying...', error);
        this.scheduleRetry();
        return;
      }

      // Check if site is excluded
      const excludeResponse = await browser.runtime.sendMessage({
        type: 'CHECK_SITE_EXCLUDED'
      });

      if (excludeResponse?.excluded) {
        console.log('WordWeave: Site excluded from translation.');
        return;
      }

      this.state = await browser.runtime.sendMessage({ type: 'GET_STATE' });

      if (!this.state) {
        console.error('WordWeave: Failed to get initial state from background script.');
        return;
      }

      console.log('WordWeave: Extension initialized with state:', this.state);

      this.setupMessageListener();
      this.createProgressBar();
      this.setupMutationObserver();

      if (this.state.enabled) {
        console.log('WordWeave: Extension is enabled, starting page processing...');
        // A slight delay allows modern web apps to finish rendering
        setTimeout(() => this.processPage(), 1000);
      } else {
        console.log('WordWeave: Extension is disabled.');
      }
    } catch (error) {
      console.error('WordWeave: Critical initialization failed:', error);
      this.scheduleRetry();
    }
  }

  createProgressBar() {
    // Remove existing progress bar if any
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
      }, 500); // Match CSS transition duration
    }
  }

  setupMessageListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Use a switch statement for clarity
      switch (message.type) {
        case 'STATE_UPDATED':
          this.onStateUpdated(message.payload);
          break;
        case 'TRANSLATE_SELECTION':
          this.translateSelection(message.payload.text);
          break;
      }
      // Respond to acknowledge receipt
      sendResponse({ status: 'ok' });
      return true; // Indicates an asynchronous response
    });
  }

  onStateUpdated(newState) {
    console.log('WordWeave: State updated:', newState);
    const wasEnabled = this.state.enabled;
    this.state = newState;

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

      const newNodes = mutations.flatMap(mutation =>
        Array.from(mutation.addedNodes).filter(node =>
          node.nodeType === Node.ELEMENT_NODE && !this.shouldSkipElement(node)
        )
      );

      if (newNodes.length > 0) {
        this.processNewNodes(newNodes);
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
    // Clean up previous popups
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

    // Auto-remove after some time
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

    // Skip elements that are typically interactive or non-translatable
    if (element.closest('a, button, [role="button"], [role="navigation"], [role="menu"]')) {
      // But allow translation if it's a block element with significant text
      if (element.matches('p, div, span') && element.textContent.length > 50) {
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  findTextContainers() {
    console.log('WordWeave: Finding text containers...');
    const containers = [];
    const seenElements = new WeakSet();

    // More targeted query than '*'
    const query = 'p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, article, section';
    const elements = document.querySelectorAll(query);

    elements.forEach(element => {
        if (seenElements.has(element) || this.shouldSkipElement(element)) {
            return;
        }

        // Check if the element contains meaningful text and is a "leaf" node in terms of text content
        const hasText = element.textContent.trim().length > 15;
        const hasChildTextContainers = Array.from(element.children).some(child => child.matches(query) && child.textContent.trim().length > 15);

        if (hasText && !hasChildTextContainers) {
            containers.push(element);
            // Mark all parents as seen to avoid redundant processing
            let parent = element.parentElement;
            while(parent) {
                seenElements.add(parent);
                parent = parent.parentElement;
            }
        }
    });

    console.log(`WordWeave: Found ${containers.length} potential text containers.`);
    return containers;
}


  extractWordsFromElement(element) {
    const text = element.textContent || "";
    // Regex to find words, including those with some diacritics
    const words = text.match(/\b[a-zA-Z\u00C0-\u017F]{3,15}\b/g) || [];
    
    if (words.length === 0) return [];
    
    // Use a Set for efficient filtering of unique, lowercase words
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    
    const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'was', 'one', 'our', 'has', 'his', 'its', 'new', 'now', 'see', 'two', 'who', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know', 'been', 'good', 'some', 'time', 'very', 'like', 'make', 'were', 'is', 'it', 'be', 'to', 'of', 'as', 'at', 'by', 'in', 'on', 'we']);

    return [...uniqueWords].filter(word => 
      !commonWords.has(word) && 
      !this.translationCache.has(word)
    );
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
        this.updateProgress(100, 100, 'No new text found.');
        setTimeout(() => this.hideProgress(), 2000);
        return;
      }

      const rateMultipliers = { low: 0.1, medium: 0.25, high: 0.4 };
      const translationRate = rateMultipliers[this.state.translationRate] || 0.25;

      for (let i = 0; i < containers.length; i++) {
        const element = containers[i];
        this.updateProgress(i, containers.length, `Processing text blocks...`);
        
        const words = this.extractWordsFromElement(element);
        if (words.length === 0) continue;

        const wordsToTranslate = words
          .sort(() => 0.5 - Math.random()) // Shuffle
          .slice(0, Math.max(1, Math.floor(words.length * translationRate)));
          
        if (wordsToTranslate.length === 0) continue;

        const translations = await this.translateWords(wordsToTranslate);
        if (Object.keys(translations).length > 0) {
          this.applyTranslationsToElement(element, translations);
          this.processedElements.add(element);
        }
      }

      this.updateProgress(100, 100, 'Translation complete!');
      setTimeout(() => this.hideProgress(), 2000);
    } catch (error) {
      console.error('WordWeave: Error processing page:', error);
      this.updateProgress(100, 100, 'An error occurred.');
      setTimeout(() => this.hideProgress(), 3000);
    } finally {
      // CRITICAL: Ensure isProcessing is always reset
      this.isProcessing = false;
    }
  }
  
  async translateWords(words) {
    const translations = {};
    const wordsToFetch = words.filter(word => !this.translationCache.has(word.toLowerCase()));

    if (wordsToFetch.length === 0) {
        words.forEach(word => {
            translations[word] = this.translationCache.get(word.toLowerCase());
        });
        return translations;
    }

    try {
        const response = await browser.runtime.sendMessage({
            type: 'TRANSLATE_TEXT_BATCH', // Assuming background script can handle batches
            payload: { texts: wordsToFetch }
        });

        if (response && response.translations) {
            response.translations.forEach((translatedText, i) => {
                const originalWord = wordsToFetch[i];
                if (translatedText && translatedText.toLowerCase() !== originalWord.toLowerCase()) {
                    translations[originalWord] = translatedText;
                    this.translationCache.set(originalWord.toLowerCase(), translatedText);
                }
            });
        }
    } catch (error) {
        console.error('WordWeave: Error translating batch of words:', error);
    }

    return translations;
  }


  applyTranslationsToElement(element, translations) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
        // Only consider nodes with actual text content that are not inside skipped elements
        if (walker.currentNode.textContent.trim() && !this.shouldSkipElement(walker.currentNode.parentElement)) {
            textNodes.push(walker.currentNode);
        }
    }

    if (textNodes.length === 0) return;

    const sortedOriginals = Object.keys(translations).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(${sortedOriginals.map(this.escapeRegExp).join('|')})\\b`, 'gi');

    textNodes.forEach(textNode => {
        const textContent = textNode.textContent;
        const parent = textNode.parentNode;

        // Defensive check: ensure parent exists and we can modify it
        if (!parent || this.processedElements.has(parent)) {
            return;
        }

        const matches = [...textContent.matchAll(regex)];
        if (matches.length === 0) return;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        matches.forEach(match => {
            const originalWord = match[0];
            const translatedWord = translations[originalWord.toLowerCase()] || translations[originalWord];
            
            if (!translatedWord) return;

            // Add text before the match
            fragment.appendChild(document.createTextNode(textContent.substring(lastIndex, match.index)));

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
        fragment.appendChild(document.createTextNode(textContent.substring(lastIndex)));

        // Safely replace the node
        try {
            parent.replaceChild(fragment, textNode);
        } catch(e) {
            console.error("WordWeave: Failed to replace text node. The DOM may have been changed by another script.", e);
        }
    });
}

  processNewNodes(nodes) {
    if (!this.state?.enabled || this.isProcessing) return;
    
    const textContainers = nodes.filter(node => 
        !this.processedElements.has(node) && this.findTextContainers([node]).length > 0
    );

    if (textContainers.length > 0) {
      console.log(`WordWeave: Processing ${textContainers.length} new dynamic nodes.`);
      // Debounce processing to handle rapid DOM changes gracefully
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.processPage(), 500);
    }
  }

  restoreOriginalContent() {
    console.log('WordWeave: Restoring original content...');
    const translatedElements = document.querySelectorAll('.gt-word');
    
    translatedElements.forEach(element => {
      const original = element.getAttribute('data-original');
      if (original && element.parentNode) {
          // Replace the span with a simple text node
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
    // Check if the script has already run
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