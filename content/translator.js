class Translator {
  constructor() {
    this.state = null;
    this.translationCache = new Map();
    this.pendingTranslations = new Set();
    this.debounceTimer = null;
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
      
      this.setupMessageListener();
      this.setupMutationObserver();
      this.setupContextMenuHandler();
      
      // Process page if extension is enabled
      if (this.state.enabled) {
        this.processPage();
      }
      
    } catch (error) {
      console.error('GlobalFoxTalk: Initialization failed:', error);
      this.scheduleRetry();
    }
  }

  setupMessageListener() {
    browser.runtime.onMessage.addListener((message) => {
      switch (message.type) {
        case 'STATE_UPDATED':
          this.handleStateUpdate(message.payload);
          break;
        case 'TRANSLATE_SELECTION':
          this.handleSelectionTranslation(message.payload.text);
          break;
      }
    });
  }

  handleStateUpdate(newState) {
    const wasEnabled = this.state?.enabled;
    this.state = newState;
    
    // If extension was just enabled, process the page
    if (!wasEnabled && newState.enabled) {
      this.processPage();
    }
    
    // If extension was disabled, restore original content
    if (wasEnabled && !newState.enabled) {
      this.restoreOriginalContent();
    }
    
    // Update CSS variables for styling
    this.updateStyling();
  }

  updateStyling() {
    if (!this.state) return;
    
    const root = document.documentElement;
    root.style.setProperty('--gt-highlight-color', this.state.highlightColor);
    root.style.setProperty('--gt-font-size', this.getFontSizeValue());
  }

  getFontSizeValue() {
    const sizes = {
      small: '0.9em',
      medium: '1em',
      large: '1.1em'
    };
    return sizes[this.state.fontSize] || '1em';
  }

  setupMutationObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.observer = new MutationObserver(mutations => {
      if (!this.state?.enabled) return;
      
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        const addedNodes = mutations
          .filter(m => m.type === 'childList')
          .flatMap(m => Array.from(m.addedNodes))
          .filter(node => node.nodeType === Node.ELEMENT_NODE)
          .filter(node => !node.classList?.contains('gt-word')); // Don't process our own elements
        
        if (addedNodes.length > 0) {
          this.processNewNodes(addedNodes);
        }
      }, 500);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  setupContextMenuHandler() {
    document.addEventListener('contextmenu', (e) => {
      const selection = window.getSelection().toString().trim();
      if (selection && this.state?.enabled) {
        // Store selection for context menu action
        this.lastSelection = {
          text: selection,
          element: e.target
        };
      }
    });
  }

  async handleSelectionTranslation(text) {
    if (!text || !this.state?.enabled) return;
    
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        payload: { text }
      });
      
      if (response.translation) {
        this.showTranslationPopup(text, response.translation);
      }
    } catch (error) {
      console.error('Selection translation failed:', error);
    }
  }

  showTranslationPopup(original, translation) {
    // Remove existing popup
    const existingPopup = document.getElementById('gt-translation-popup');
    if (existingPopup) {
      existingPopup.remove();
    }
    
    const popup = document.createElement('div');
    popup.id = 'gt-translation-popup';
    popup.className = 'gt-popup';
    popup.innerHTML = `
      <div class="gt-popup-content">
        <div class="gt-popup-header">
          <span class="gt-popup-title">Translation</span>
          <button class="gt-popup-close">&times;</button>
        </div>
        <div class="gt-popup-body">
          <div class="gt-original">${this.escapeHtml(original)}</div>
          <div class="gt-arrow">→</div>
          <div class="gt-translation">${this.escapeHtml(translation)}</div>
        </div>
        <div class="gt-popup-actions">
          <button class="gt-learn-btn">Mark as Learned</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Position popup
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
    
    // Event listeners
    popup.querySelector('.gt-popup-close').addEventListener('click', () => {
      popup.remove();
    });
    
    popup.querySelector('.gt-learn-btn').addEventListener('click', () => {
      this.markWordAsLearned(original, translation);
      popup.remove();
    });
    
    // Auto-hide after 10 seconds
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
      
      this.showNotification('Word learned!', 'success');
    } catch (error) {
      console.error('Failed to mark word as learned:', error);
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `gt-notification gt-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('gt-notification-show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('gt-notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  processNewNodes(nodes) {
    if (this.isProcessing) return;
    
    const textNodes = [];
    
    nodes.forEach(node => {
      if (this.isSignificantTextNode(node)) {
        textNodes.push(node);
      } else {
        // Find text nodes within the element
        const walker = document.createTreeWalker(
          node,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (textNode) => {
              return this.isValidTextNode(textNode) ? 
                NodeFilter.FILTER_ACCEPT : 
                NodeFilter.FILTER_REJECT;
            }
          }
        );
        
        let textNode;
        while (textNode = walker.nextNode()) {
          textNodes.push(textNode);
        }
      }
    });

    if (textNodes.length > 0) {
      this.translateTextNodes(textNodes);
    }
  }

  isSignificantTextNode(node) {
    return node.nodeType === Node.TEXT_NODE && 
           this.isValidTextNode(node);
  }

  isValidTextNode(textNode) {
    if (!textNode.textContent?.trim()) return false;
    
    const parent = textNode.parentElement;
    if (!parent) return false;
    
    // Skip if parent is already processed or should be skipped
    if (this.shouldSkipElement(parent)) return false;
    if (this.processedElements.has(parent)) return false;
    if (parent.classList?.contains('gt-word')) return false;
    
    // Check translation settings
    if (!this.state.translateHeaders && this.isHeaderElement(parent)) return false;
    if (!this.state.translateNav && this.isNavigationElement(parent)) return false;
    
    // Only process text nodes with meaningful content
    const text = textNode.textContent.trim();
    const wordCount = text.split(/\s+/).length;
    
    return wordCount >= 1 && wordCount <= 50 && text.length >= 3;
  }

  isHeaderElement(element) {
    return /^H[1-6]$/.test(element.tagName) || 
           element.closest('header') !== null ||
           element.classList.contains('header') ||
           element.classList.contains('title');
  }

  isNavigationElement(element) {
    return element.tagName === 'NAV' ||
           element.closest('nav') !== null ||
           element.classList.contains('nav') ||
           element.classList.contains('menu') ||
           element.getAttribute('role') === 'navigation';
  }

  shouldSkipElement(element) {
    if (!element) return true;
    
    const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'BUTTON'];
    const skipClasses = ['no-translate', 'notranslate', 'gt-popup', 'gt-notification'];
    
    return skipTags.includes(element.tagName) ||
           skipClasses.some(cls => element.classList?.contains(cls)) ||
           element.isContentEditable ||
           element.getAttribute('translate') === 'no' ||
           element.closest('[translate="no"]') !== null;
  }

  async translateTextNodes(textNodes) {
    if (!this.state?.enabled || this.isProcessing) return;
    
    this.isProcessing = true;
    const translationRate = this.getTranslationRate();
    
    try {
      for (const textNode of textNodes) {
        if (!this.state.enabled) break; // Check if disabled during processing
        
        const text = textNode.textContent.trim();
        const words = this.extractWords(text);
        
        const wordsToTranslate = words
          .filter(() => Math.random() < translationRate)
          .filter(word => !this.translationCache.has(word.toLowerCase()))
          .filter(word => !this.state.learnedWords[word.toLowerCase()])
          .slice(0, 3); // Limit to 3 words per text node

        if (wordsToTranslate.length === 0) {
          this.processedElements.add(textNode.parentElement);
          continue;
        }

        try {
          const translations = await this.batchTranslate(wordsToTranslate);
          
          wordsToTranslate.forEach((word, i) => {
            if (translations[i] && translations[i] !== word) {
              this.translationCache.set(word.toLowerCase(), translations[i]);
            }
          });

          this.updateTextNodeContent(textNode, wordsToTranslate);
          this.processedElements.add(textNode.parentElement);
          
          // Small delay to prevent overwhelming the page
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error('Text node translation error:', error);
          this.processedElements.add(textNode.parentElement); // Mark as processed to avoid retry
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  extractWords(text) {
    return text.match(/\b[a-zA-ZÀ-ÿ]+\b/g) || [];
  }

  async batchTranslate(words) {
    if (words.length === 0) return [];
    
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        payload: { text: words.join('\n') }
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      return response.translation.split('\n').map(t => t.trim());
    } catch (error) {
      console.error('Batch translation failed:', error);
      return [];
    }
  }

  updateTextNodeContent(textNode, wordsToTranslate) {
    try {
      const parent = textNode.parentElement;
      if (!parent) return;
      
      let text = textNode.textContent;
      
      // Create a document fragment to build the new content
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      wordsToTranslate.forEach(word => {
        const translation = this.translationCache.get(word.toLowerCase());
        if (!translation || translation === word) return;
        
        const regex = new RegExp(`\\b${this.escapeRegExp(word)}\\b`, 'i');
        const match = text.substring(lastIndex).match(regex);
        
        if (match) {
          const matchIndex = lastIndex + match.index;
          
          // Add text before the match
          if (matchIndex > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
          }
          
          // Create translated word element
          const span = document.createElement('span');
          span.className = 'gt-word';
          span.setAttribute('data-original', word);
          span.setAttribute('title', word);
          span.textContent = translation;
          fragment.appendChild(span);
          
          lastIndex = matchIndex + match[0].length;
        }
      });
      
      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      
      // Replace the text node with the fragment
      parent.replaceChild(fragment, textNode);
      
    } catch (error) {
      console.error('Content update failed:', error);
    }
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getTranslationRate() {
    const rates = {
      low: 0.1,
      medium: 0.25,
      high: 0.4
    };
    return rates[this.state?.translationRate] || 0.25;
  }

  processPage() {
    if (!this.state?.enabled || this.isProcessing) return;
    
    // Find all text nodes in the document
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (textNode) => {
          return this.isValidTextNode(textNode) ? 
            NodeFilter.FILTER_ACCEPT : 
            NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    const textNodes = [];
    let textNode;
    while (textNode = walker.nextNode()) {
      textNodes.push(textNode);
    }
    
    // Limit initial processing to prevent overwhelming
    const limitedTextNodes = textNodes.slice(0, 50);
    
    if (limitedTextNodes.length > 0) {
      this.translateTextNodes(limitedTextNodes);
    }
  }

  restoreOriginalContent() {
    const translatedElements = document.querySelectorAll('.gt-word');
    translatedElements.forEach(element => {
      const original = element.getAttribute('data-original');
      if (original) {
        const textNode = document.createTextNode(original);
        element.parentNode.replaceChild(textNode, element);
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
}

// Initialize translator when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Translator());
} else {
  new Translator();
}