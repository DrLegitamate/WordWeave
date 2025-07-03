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
    
    console.log('WordWeave: Translator constructor called');
    this.initialize();
  }

  async initialize() {
    try {
      console.log('WordWeave: Starting initialization...');
      
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
      
      console.log('WordWeave: Extension initialized, state:', this.state);
      
      this.setupMessageListener();
      this.setupMutationObserver();
      this.setupContextMenuHandler();
      this.createProgressBar();
      
      // Process page if extension is enabled
      if (this.state.enabled) {
        console.log('WordWeave: Extension is enabled, starting page processing...');
        setTimeout(() => this.processPage(), 1000);
      } else {
        console.log('WordWeave: Extension is disabled');
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
      <div class="gt-progress-text">WordWeave: Ready</div>
    `;

    document.body.appendChild(progressContainer);
    this.progressBar = progressContainer;
    console.log('WordWeave: Progress bar created');
  }

  updateProgress(current, total, status = 'Translating...') {
    if (!this.progressBar) return;

    const progressFill = this.progressBar.querySelector('.gt-progress-fill');
    const progressText = this.progressBar.querySelector('.gt-progress-text');
    
    if (progressFill && progressText) {
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `WordWeave: ${status} (${percentage}%)`;
      console.log(`WordWeave: Progress ${percentage}% - ${status}`);
    }
  }

  showProgress() {
    if (this.progressBar) {
      this.progressBar.classList.add('gt-progress-show');
      this.progressBar.style.display = 'flex';
      console.log('WordWeave: Progress bar shown');
    }
  }

  hideProgress() {
    if (this.progressBar) {
      this.progressBar.classList.remove('gt-progress-show');
      setTimeout(() => {
        if (this.progressBar && !this.progressBar.classList.contains('gt-progress-show')) {
          this.progressBar.style.display = 'none';
        }
      }, 2000);
      console.log('WordWeave: Progress bar hidden');
    }
  }

  setupMessageListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('WordWeave: Received message:', message.type);
      
      if (message.type === 'STATE_UPDATED') {
        this.state = message.payload;
        console.log('WordWeave: State updated:', this.state);
        
        if (this.state.enabled) {
          console.log('WordWeave: Extension enabled, processing page...');
          this.processPage();
        } else {
          console.log('WordWeave: Extension disabled, restoring content...');
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
        console.log('WordWeave: New nodes detected:', newNodes.length);
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
      console.log('WordWeave: Translating selection:', text);
      
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
    if (text.length < 5) return false;
    
    // Must contain actual words (not just numbers/symbols)
    const wordCount = (text.match(/\b[a-zA-ZÀ-ÿĀ-žА-я]{2,}\b/g) || []).length;
    if (wordCount < 1) return false;
    
    return true;
  }

  findTextContainers() {
    console.log('WordWeave: Finding text containers...');
    
    const containers = [];
    
    // Find all text-containing elements
    const allElements = document.querySelectorAll('*');
    console.log(`WordWeave: Checking ${allElements.length} elements`);
    
    allElements.forEach(element => {
      if (this.isTextContainer(element)) {
        // Check if this element has children with text - if so, skip it to avoid duplicates
        const hasTextChildren = Array.from(element.children).some(child => 
          this.isTextContainer(child)
        );
        
        if (!hasTextChildren) {
          containers.push(element);
        }
      }
    });

    console.log(`WordWeave: Found ${containers.length} text containers`);
    
    // Log some examples
    containers.slice(0, 5).forEach((container, index) => {
      console.log(`WordWeave: Container ${index + 1}:`, container.tagName, container.textContent.substring(0, 100));
    });

    return containers;
  }

  extractWordsFromElement(element) {
    const text = element.textContent.trim();
    if (!text) return [];

    console.log('WordWeave: Extracting words from text:', text.substring(0, 100));

    // Extract words using improved regex
    const words = text.match(/\b[a-zA-ZÀ-ÿĀ-žА-я]{2,15}\b/g) || [];
    
    console.log('WordWeave: Found words:', words.slice(0, 10));
    
    // Filter out very common English words and already cached words
    const commonWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 
      'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 
      'did', 'she', 'use', 'way', 'what', 'when', 'with', 'have', 'this', 
      'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 
      'some', 'time', 'very', 'come', 'here', 'just', 'like', 'long', 'make', 
      'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were', 'is', 
      'it', 'be', 'to', 'of', 'as', 'at', 'by', 'he', 'in', 'on', 'we', 'an', 
      'do', 'if', 'me', 'my', 'no', 'so', 'up', 'am', 'go', 'or'
    ]);
    
    const filteredWords = words.filter(word => {
      const lowerWord = word.toLowerCase();
      return !commonWords.has(lowerWord) &&
             !this.translationCache.has(lowerWord) &&
             word.length >= 2 && 
             word.length <= 15 &&
             !/^\d+$/.test(word); // Not just numbers
    });
    
    console.log('WordWeave: Filtered words:', filteredWords);
    return filteredWords;
  }

  async processPage() {
    if (!this.state?.enabled || this.isProcessing) {
      console.log('WordWeave: Cannot process page - disabled or already processing');
      return;
    }
    
    this.isProcessing = true;
    console.log('WordWeave: Starting page processing...');

    try {
      // Show progress bar
      this.showProgress();
      this.updateProgress(0, 100, 'Finding text...');

      // Find all text containers
      const containers = this.findTextContainers();
      
      console.log(`WordWeave: Found ${containers.length} text containers to process`);

      if (containers.length === 0) {
        console.log('WordWeave: No suitable text containers found');
        this.updateProgress(100, 100, 'No text found');
        setTimeout(() => this.hideProgress(), 2000);
        this.isProcessing = false;
        return;
      }

      // Sort containers by text length (process longer content first)
      containers.sort((a, b) => b.textContent.length - a.textContent.length);

      // Process containers in batches
      const maxContainers = Math.min(containers.length, 20); // Limit for performance
      const batchSize = 3;
      const totalBatches = Math.ceil(maxContainers / batchSize);
      let processedBatches = 0;

      console.log(`WordWeave: Processing ${maxContainers} containers in ${totalBatches} batches`);

      for (let i = 0; i < maxContainers; i += batchSize) {
        const batch = containers.slice(i, i + batchSize);
        
        this.updateProgress(
          processedBatches, 
          totalBatches, 
          `Processing batch ${processedBatches + 1}/${totalBatches}`
        );
        
        await this.processBatch(batch);
        processedBatches++;
        
        // Update progress
        this.updateProgress(processedBatches, totalBatches, 'Processing...');
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Complete
      this.updateProgress(totalBatches, totalBatches, 'Translation complete!');
      
      // Hide progress bar after a short delay
      setTimeout(() => {
        this.hideProgress();
      }, 3000);

    } catch (error) {
      console.error('WordWeave: Error processing page:', error);
      this.updateProgress(0, 100, 'Error occurred');
      setTimeout(() => this.hideProgress(), 2000);
    } finally {
      this.isProcessing = false;
    }
  }

  async processBatch(elements) {
    console.log(`WordWeave: Processing batch of ${elements.length} elements`);
    
    for (const element of elements) {
      try {
        const words = this.extractWordsFromElement(element);
        if (words.length === 0) {
          console.log('WordWeave: No words to translate in element');
          continue;
        }

        // Apply translation rate filter
        const rateMultipliers = { low: 0.1, medium: 0.25, high: 0.4 };
        const rate = rateMultipliers[this.state.translationRate] || 0.25;
        
        // Select words to translate based on rate
        const shuffledWords = words.sort(() => Math.random() - 0.5);
        const maxWords = Math.max(1, Math.floor(words.length * rate));
        const wordsToTranslate = shuffledWords.slice(0, Math.min(maxWords, 5)); // Limit to 5 words per element

        console.log(`WordWeave: Translating ${wordsToTranslate.length} words from element:`, wordsToTranslate);

        if (wordsToTranslate.length === 0) continue;

        // Translate words
        const translations = await this.translateWords(wordsToTranslate);
        
        console.log('WordWeave: Got translations:', translations);
        
        // Apply translations to element
        if (Object.keys(translations).length > 0) {
          this.applyTranslationsToElement(element, translations);
          this.processedElements.add(element);
          console.log('WordWeave: Applied translations to element');
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
          console.log(`WordWeave: Using cached translation for "${word}"`);
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

        // Small delay between translations to avoid overwhelming the service
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`WordWeave: Error translating word "${word}":`, error);
      }
    }

    return translations;
  }

  applyTranslationsToElement(element, translations) {
    console.log('WordWeave: Applying translations to element:', translations);
    
    // Get all text nodes in the element
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

    console.log(`WordWeave: Found ${textNodes.length} text nodes to process`);

    // Process each text node
    textNodes.forEach((textNode, index) => {
      let textContent = textNode.textContent;
      let hasChanges = false;

      console.log(`WordWeave: Processing text node ${index + 1}: "${textContent.substring(0, 50)}..."`);

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

      if (allMatches.length === 0) {
        console.log('WordWeave: No matches found in text node');
        return;
      }

      console.log(`WordWeave: Found ${allMatches.length} matches in text node`);

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

      if (nonOverlapping.length === 0) {
        console.log('WordWeave: No non-overlapping matches');
        return;
      }

      console.log(`WordWeave: Processing ${nonOverlapping.length} non-overlapping matches`);

      // Build fragments
      const fragments = [];
      let lastIndex = 0;
      
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
            hasChanges = true;
          }
        });
        
        // Replace the original text node
        textNode.parentNode.replaceChild(documentFragment, textNode);
        console.log('WordWeave: Successfully applied translations to text node');
      }
    });
  }

  processNewNodes(nodes) {
    if (!this.state?.enabled || this.isProcessing) return;
    
    const textContainers = nodes.filter(node => this.isTextContainer(node));
    if (textContainers.length > 0) {
      console.log(`WordWeave: Processing ${textContainers.length} new nodes`);
      setTimeout(() => this.processBatch(textContainers), 500);
    }
  }

  restoreOriginalContent() {
    console.log('WordWeave: Restoring original content');
    
    const translatedElements = document.querySelectorAll('.gt-word');
    console.log(`WordWeave: Found ${translatedElements.length} translated elements to restore`);
    
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
console.log('WordWeave: Content script loaded');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('WordWeave: DOM loaded, initializing translator');
    new Translator();
  });
} else {
  console.log('WordWeave: DOM already loaded, initializing translator immediately');
  new Translator();
}