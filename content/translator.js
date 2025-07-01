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
      
      console.log('GlobalFoxTalk: Extension initialized, enabled:', this.state.enabled);
      
      this.setupMessageListener();
      this.setupMutationObserver();
      this.setupContextMenuHandler();
      
      // Process page if extension is enabled
      if (this.state.enabled) {
        // Wait a bit for page to fully load
        setTimeout(() => this.processPage(), 1000);
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
    
    console.log('GlobalFoxTalk: State updated, enabled:', newState.enabled);
    
    // If extension was just enabled, process the page
    if (!wasEnabled && newState.enabled) {
      setTimeout(() => this.processPage(), 500);
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
      }, 1000);
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
    
    const textBlocks = nodes
      .filter(node => this.isSignificantTextBlock(node))
      .filter(node => !this.processedElements.has(node))
      .map(node => this.extractTextContent(node));

    if (textBlocks.length > 0) {
      this.translateTextBlocks(textBlocks);
    }
  }

  isSignificantTextBlock(node) {
    if (!node || !node.textContent?.trim()) return false;
    if (this.shouldSkipElement(node)) return false;
    if (node.classList?.contains('gt-word')) return false;

    // Check translation settings
    if (!this.state.translateHeaders && this.isHeaderElement(node)) return false;
    if (!this.state.translateNav && this.isNavigationElement(node)) return false;

    // Accept more content types for better body text coverage
    const significantTags = ['P', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'A', 'STRONG', 'EM', 'B', 'I'];
    const text = node.textContent.trim();
    const wordCount = text.split(/\s+/).length;
    
    // More lenient criteria - accept shorter text blocks too
    return significantTags.includes(node.tagName) && 
           text.length >= 10 && 
           wordCount >= 2 && 
           wordCount <= 200;
  }

  isHeaderElement(element) {
    return /^H[1-6]$/.test(element.tagName) || 
           element.closest('header') !== null ||
           element.classList.contains('header') ||
           element.classList.contains('title') ||
           element.classList.contains('headline');
  }

  isNavigationElement(element) {
    return element.tagName === 'NAV' ||
           element.closest('nav') !== null ||
           element.classList.contains('nav') ||
           element.classList.contains('menu') ||
           element.classList.contains('navigation') ||
           element.getAttribute('role') === 'navigation';
  }

  shouldSkipElement(element) {
  if (!element) return true;
  
  const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'BUTTON', 'NOSCRIPT'];
  const skipClasses = ['no-translate', 'notranslate', 'gt-popup', 'gt-notification'];
  
  if (element.closest('button, [role="button"]') !== null) {
      return true;
  }

  return skipTags.includes(element.tagName) ||
         skipClasses.some(cls => element.classList?.contains(cls)) ||
         element.isContentEditable ||
         element.getAttribute('translate') === 'no' ||
         element.closest('[translate="no"]') !== null;
  }

  extractTextContent(node) {
    const text = node.textContent.trim();
    const words = text.match(/\b[a-zA-ZÀ-ÿĀ-žА-я]+\b/g) || [];
    
    // Filter words that are meaningful and not already learned
    const validWords = words.filter(word => 
      word.length > 2 && 
      word.length < 20 &&
      /^[a-zA-ZÀ-ÿĀ-žА-я]+$/.test(word) && 
      !this.state.learnedWords[word.toLowerCase()]
    );
    
    return {
      node,
      text,
      words: validWords
    };
  }

  async translateTextBlocks(blocks) {
    if (!this.state?.enabled || this.isProcessing) return;
    
    this.isProcessing = true;
    const translationRate = this.getTranslationRate();
    
    console.log(`GlobalFoxTalk: Processing ${blocks.length} text blocks`);
    
    try {
      for (const block of blocks) {
        if (!this.state.enabled) break; // Check if disabled during processing
        
        const wordsToTranslate = block.words
          .filter(() => Math.random() < translationRate)
          .filter(word => !this.translationCache.has(word.toLowerCase()))
          .slice(0, 3); // Limit to 3 words per block to avoid overwhelming

        if (wordsToTranslate.length === 0) {
          this.processedElements.add(block.node);
          continue;
        }

        try {
          const translations = await this.batchTranslate(wordsToTranslate);
          
          wordsToTranslate.forEach((word, i) => {
            if (translations[i] && translations[i] !== word) {
              this.translationCache.set(word.toLowerCase(), translations[i]);
            }
          });

          this.updateBlockContent(block);
          this.processedElements.add(block.node);
          
          // Small delay to prevent overwhelming the page
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error('Block translation error:', error);
          this.processedElements.add(block.node); // Mark as processed to avoid retry
        }
      }
    } finally {
      this.isProcessing = false;
      console.log('GlobalFoxTalk: Finished processing text blocks');
    }
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

updateBlockContent(block) {
  const { node, words } = block;
  
  try {
    const originalHTML = node.innerHTML;
    let updatedHTML = originalHTML;
    
    words.forEach(word => {
      const translation = this.translationCache.get(word.toLowerCase());
      if (translation && translation !== word) {
        const regex = new RegExp(`\\b${this.escapeRegExp(word)}\\b`, 'gi');
        
        // MODIFIED LINE: Removed 'title="${this.escapeHtml(word)}"'
        const replacement = `<span class="gt-word" data-original="${this.escapeHtml(word)}">${this.escapeHtml(translation)}</span>`;
        updatedHTML = updatedHTML.replace(regex, replacement);
      }
    });
    
    if (updatedHTML !== originalHTML) {
      node.innerHTML = updatedHTML;
      console.log(`GlobalFoxTalk: Updated content in ${node.tagName}`);
    }
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
      low: 0.15,
      medium: 0.3,
      high: 0.5
    };
    return rates[this.state?.translationRate] || 0.3;
  }

  processPage() {
    if (!this.state?.enabled || this.isProcessing) return;
    
    console.log('GlobalFoxTalk: Starting page processing...');
    
    // Simple approach: find all text-containing elements
    const allElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, a, strong, em, b, i');
    
    const textBlocks = Array.from(allElements)
      .filter(node => this.isSignificantTextBlock(node))
      .filter(node => !this.processedElements.has(node))
      .map(node => this.extractTextContent(node))
      .filter(block => block.words.length > 0)
      .slice(0, 50); // Limit initial processing to first 50 blocks

    console.log(`GlobalFoxTalk: Found ${textBlocks.length} text blocks to process`);

    if (textBlocks.length > 0) {
      this.translateTextBlocks(textBlocks);
    } else {
      console.log('GlobalFoxTalk: No suitable text blocks found for translation');
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
}

// Initialize translator when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Translator());
} else {
  new Translator();
}