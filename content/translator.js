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
    this.progressBar = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Check if site is excluded
      const excludeResponse = await browser.runtime.sendMessage({ 
        type: 'CHECK_SITE_EXCLUDED' 
      });
      
      if (excludeResponse.excluded) {
        console.log('WordWeave: Site excluded from translation');
        return;
      }
      
      this.state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
      
      if (!this.state) {
        console.error('WordWeave: Failed to get initial state');
        return;
      }
      
      console.log('WordWeave: Extension initialized, enabled:', this.state.enabled);
      
      this.setupMessageListener();
      this.setupMutationObserver();
      this.setupContextMenuHandler();
      this.createProgressBar();
      
      // Process page if extension is enabled
      if (this.state.enabled) {
        setTimeout(() => this.processPage(), 1000);
      }
      
    } catch (error) {
      console.error('WordWeave: Initialization failed:', error);
      this.scheduleRetry();
    }
  }

  createProgressBar() {
    // Remove existing progress bar if any
    const existingBar = document.querySelector('.gt-progress-container');
    if (existingBar) {
      existingBar.remove();
    }

    // Create progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'gt-progress-container';
    progressContainer.innerHTML = `
      <div class="gt-progress-bar">
        <div class="gt-progress-fill"></div>
      </div>
      <div class="gt-progress-text">WordWeave: Preparing...</div>
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
      progressText.textContent = `WordWeave: ${status}`;
    }
  }

  showProgress() {
    if (this.progressBar) {
      this.progressBar.classList.add('gt-progress-show');
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
      if (message.type === 'STATE_UPDATED') {
        this.state = message.payload;
        if (this.state.enabled) {
          this.processPage();
        } else {
          this.restoreOriginalContent();
          this.hideProgress();
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
      console.error('WordWeave: Error translating selection:', error);
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

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 10000);
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
    const skipClasses = ['no-translate', 'notranslate', 'gt-popup', 'gt-notification', 'gt-word', 'gt-progress-container'];

    // Skip interactive elements
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

  isTextContainer(element) {
    // Check if element contains meaningful text content
    if (!element.textContent?.trim()) return false;
    
    // Skip if already processed
    if (this.processedElements.has(element)) return false;
    
    // Skip if should be skipped
    if (this.shouldSkipElement(element)) return false;
    
    const text = element.textContent.trim();
    
    // Must have reasonable text length
    if (text.length < 10) return false;
    
    // Must contain actual words (not just numbers/symbols)
    const wordCount = (text.match(/\b[a-zA-ZÀ-ÿĀ-žА-я]{3,}\b/g) || []).length;
    if (wordCount < 2) return false;
    
    // Check if this element has direct text content (not just from children)
    const directText = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim())
      .join(' ')
      .trim();
    
    // If element has direct text content OR is a leaf element with text, it's processable
    return directText.length > 0 || (element.children.length === 0 && text.length > 0);
  }

  findTextContainers() {
    const containers = [];
    
    // Strategy 1: Find elements with direct text content
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (this.shouldSkipElement(node)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Accept elements that contain text
          if (this.isTextContainer(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      containers.push(node);
    }

    // Strategy 2: Also check common content containers
    const commonSelectors = [
      'p', 'div', 'span', 'article', 'section', 'main', 'aside',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'td', 'th', 'blockquote', 'figcaption',
      'a', 'strong', 'em', 'b', 'i', 'mark', 'small'
    ];

    commonSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (this.isTextContainer(element) && !containers.includes(element)) {
          containers.push(element);
        }
      });
    });

    // Remove nested elements (keep only the most specific containers)
    return containers.filter(container => {
      return !containers.some(other => 
        other !== container && other.contains(container) && 
        other.textContent.trim() === container.textContent.trim()
      );
    });
  }

  extractWordsFromElement(element) {
    const text = element.textContent.trim();
    if (!text) return [];

    // Extract words using improved regex - focus on actual words
    const words = text.match(/\b[a-zA-ZÀ-ÿĀ-žА-я]{3,15}\b/g) || [];
    
    // Filter out common words and already cached words
    const commonWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'what', 'when', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'
    ]);
    
    return words.filter(word => {
      const lowerWord = word.toLowerCase();
      return !commonWords.has(lowerWord) &&
             !this.translationCache.has(lowerWord) &&
             word.length >= 3 && 
             word.length <= 15 &&
             !/^\d+$/.test(word); // Not just numbers
    });
  }

  async processPage() {
    if (!this.state?.enabled || this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('WordWeave: Processing page for translation...');

    try {
      // Show progress bar
      this.showProgress();
      this.updateProgress(0, 100, 'Finding text containers...');

      // Find all text containers using improved strategy
      const containers = this.findTextContainers();
      
      console.log(`WordWeave: Found ${containers.length} text containers to process`);

      if (containers.length === 0) {
        console.log('WordWeave: No suitable text containers found');
        this.hideProgress();
        this.isProcessing = false;
        return;
      }

      // Sort containers by text length (process longer content first)
      containers.sort((a, b) => b.textContent.length - a.textContent.length);

      // Process containers in batches
      const batchSize = 5;
      const totalBatches = Math.ceil(Math.min(containers.length, 50) / batchSize);
      let processedBatches = 0;

      for (let i = 0; i < Math.min(containers.length, 50); i += batchSize) {
        const batch = containers.slice(i, i + batchSize);
        
        this.updateProgress(
          processedBatches, 
          totalBatches, 
          `Processing batch ${processedBatches + 1}/${totalBatches}...`
        );
        
        await this.processBatch(batch);
        processedBatches++;
        
        // Update progress
        this.updateProgress(processedBatches, totalBatches, 'Processing...');
        
        // Small delay between batches to avoid overwhelming the page
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Complete
      this.updateProgress(totalBatches, totalBatches, 'Translation complete!');
      
      // Hide progress bar after a short delay
      setTimeout(() => {
        this.hideProgress();
      }, 2000);

    } catch (error) {
      console.error('WordWeave: Error processing page:', error);
      this.hideProgress();
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
        
        // Select words to translate based on rate
        const shuffledWords = words.sort(() => Math.random() - 0.5);
        const maxWords = Math.max(1, Math.floor(words.length * rate));
        const wordsToTranslate = shuffledWords.slice(0, Math.min(maxWords, 8));

        console.log(`WordWeave: Translating ${wordsToTranslate.length} words from element:`, wordsToTranslate);

        if (wordsToTranslate.length === 0) continue;

        // Translate words
        const translations = await this.translateWords(wordsToTranslate);
        
        console.log('WordWeave: Got translations:', translations);
        
        // Apply translations to element
        if (Object.keys(translations).length > 0) {
          this.applyTranslationsToElement(element, translations);
          this.processedElements.add(element);
        }

      } catch (error) {
        console.error('WordWeave: Error processing element:', error);
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

        console.log(`WordWeave: Translating word: "${word}"`);

        const response = await browser.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          payload: {
            text: word,
            sourceLang: this.state.autoDetectLanguage ? null : this.state.sourceLanguage
          }
        });

        if (response && response.translation && response.translation !== word) {
          console.log(`WordWeave: Translation result: "${word}" -> "${response.translation}"`);
          translations[word] = response.translation;
          this.translationCache.set(word.toLowerCase(), response.translation);
        } else {
          console.log(`WordWeave: No translation for "${word}"`);
        }

      } catch (error) {
        console.error(`WordWeave: Error translating word "${word}":`, error);
      }
    }

    return translations;
  }

  applyTranslationsToElement(element, translations) {
    console.log('WordWeave: Applying translations to element:', translations);
    
    // Use TreeWalker to process only text nodes, avoiding HTML contamination
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip text nodes inside elements we want to avoid
          if (node.parentElement && this.shouldSkipElement(node.parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          // Only process text nodes with actual content
          if (node.textContent.trim().length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Process each text node
    textNodes.forEach(textNode => {
      let textContent = textNode.textContent;
      let hasChanges = false;
      const fragments = [];
      let lastIndex = 0;

      // Sort translations by length (longest first) to avoid partial matches
      const sortedTranslations = Object.entries(translations)
        .sort(([a], [b]) => b.length - a.length);

      // Find all word matches in this text node
      const allMatches = [];
      
      sortedTranslations.forEach(([original, translation]) => {
        const regex = new RegExp(`\\b(${this.escapeRegExp(original)})\\b`, 'gi');
        let match;
        
        while ((match = regex.exec(textContent)) !== null) {
          allMatches.push({
            index: match.index,
            length: match[1].length,
            original: match[1],
            translation: translation
          });
        }
      });

      if (allMatches.length === 0) return;

      // Sort matches by position
      allMatches.sort((a, b) => a.index - b.index);

      // Remove overlapping matches (keep first occurrence)
      const nonOverlapping = [];
      let lastEnd = 0;
      
      allMatches.forEach(match => {
        if (match.index >= lastEnd) {
          nonOverlapping.push(match);
          lastEnd = match.index + match.length;
        }
      });

      if (nonOverlapping.length === 0) return;

      // Build fragments
      lastIndex = 0;
      nonOverlapping.forEach(match => {
        // Add text before the match
        if (match.index > lastIndex) {
          fragments.push({
            type: 'text',
            content: textContent.substring(lastIndex, match.index)
          });
        }
        
        // Add the translated word
        fragments.push({
          type: 'translation',
          original: match.original,
          translation: match.translation
        });
        
        lastIndex = match.index + match.length;
      });

      // Add remaining text
      if (lastIndex < textContent.length) {
        fragments.push({
          type: 'text',
          content: textContent.substring(lastIndex)
        });
      }

      // Replace the text node with fragments
      if (fragments.length > 0) {
        const documentFragment = document.createDocumentFragment();
        
        fragments.forEach(fragment => {
          if (fragment.type === 'text') {
            if (fragment.content) {
              documentFragment.appendChild(document.createTextNode(fragment.content));
            }
          } else if (fragment.type === 'translation') {
            const span = document.createElement('span');
            span.className = 'gt-word';
            span.setAttribute('data-original', fragment.original);
            span.textContent = fragment.translation;
            
            // Apply custom styling
            span.style.setProperty('--gt-highlight-color', this.state.highlightColor || '#4a90e2');
            const fontSizes = { small: '0.9em', medium: '1em', large: '1.1em' };
            span.style.fontSize = fontSizes[this.state.fontSize] || '1em';
            
            documentFragment.appendChild(span);
          }
        });
        
        // Replace the original text node
        textNode.parentNode.replaceChild(documentFragment, textNode);
        console.log('WordWeave: Applied translations to text node');
      }
    });
  }

  processNewNodes(nodes) {
    if (!this.state?.enabled || this.isProcessing) return;
    
    const textContainers = nodes.filter(node => this.isTextContainer(node));
    if (textContainers.length > 0) {
      setTimeout(() => this.processBatch(textContainers), 500);
    }
  }

  restoreOriginalContent() {
    console.log('WordWeave: Restoring original content');
    
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
        console.log(`WordWeave: Retry attempt ${this.retryCount}`);
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