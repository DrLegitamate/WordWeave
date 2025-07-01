// content/translator.js

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
      }\n      
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
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STATE_UPDATED') {
        this.state = message.state;
        if (this.state.enabled) {
          this.processPage();
        } else {
          this.restoreOriginalContent();
        }
      } else if (message.type === 'NEW_WORD_LEARNED') {
        // Invalidate cache for affected word if necessary, or just rely on new state fetch
      }
      sendResponse({ status: 'ok' });
    });
  }

  setupMutationObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.observer = new MutationObserver(mutations => {
      if (this.isProcessing) return;

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
      subtree: true,
      attributes: false, // No need to observe attributes for text content
      characterData: false // Not observing text changes directly, relying on element structure
    });
  }

  setupContextMenuHandler() {
    // Listen for messages from background script about context menu clicks
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'CONTEXT_TRANSLATE_SELECTION') {
        const selectedText = window.getSelection().toString().trim();
        if (selectedText) {
          this.translateSelection(selectedText);
        }
      }
    });
  }

  // --- Core Translation Logic ---

  async translateTextBlocks(textBlocks) {
    this.isProcessing = true;
    for (const block of textBlocks) {
      try {
        const wordsToTranslate = block.words.filter(word => !this.translationCache.has(word.toLowerCase()));
        
        if (wordsToTranslate.length > 0) {
          const translationPromises = wordsToTranslate.map(word => 
            browser.runtime.sendMessage({ 
              type: 'TRANSLATE_TEXT', 
              text: word, 
              sourceLang: this.state.autoDetectLanguage ? 'auto' : this.state.sourceLanguage, 
              targetLang: this.state.targetLanguage,
              service: this.state.translationService
            }).then(response => {
              if (response && response.translation) {
                this.translationCache.set(word.toLowerCase(), response.translation);
                // Inform background script about learned word (if applicable)
                browser.runtime.sendMessage({ type: 'ADD_LEARNED_WORD', word: word, translation: response.translation });
              }
            })
          );
          await Promise.all(translationPromises);
        }
        
        // Update content *after* translations are in cache
        if (block.words.some(word => this.translationCache.has(word.toLowerCase()))) {
          this.updateBlockContent(block);
        }
      } catch (error) {
        console.error('GlobalFoxTalk: Error translating block:', error);
      }
    }
    this.isProcessing = false;
  }

  async translateSelection(text) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        text: text,
        sourceLang: this.state.autoDetectLanguage ? 'auto' : this.state.sourceLanguage, 
        targetLang: this.state.targetLanguage,
        service: this.state.translationService
      });

      if (response && response.translation) {
        alert(`Translation of "${text}":\n\n${response.translation}`);
      } else {
        alert('Could not translate selected text.');
      }
    } catch (error) {
      console.error('GlobalFoxTalk: Error translating selection:', error);
      alert('Error translating text. Please try again.');
    }
  }

  // Helper to escape HTML for attribute values
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper to escape regex special characters
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }

  shouldSkipElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return true; // Ensure it's an element node
    
    // List of tags to always skip processing
    const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'NOSCRIPT'];
    // List of classes indicating no translation should occur
    const skipClasses = ['no-translate', 'notranslate', 'gt-popup', 'gt-notification', 'gt-word']; // Add gt-word to skip already translated spans

    // --- NEW LOGIC ---
    // If an element is a <button> or a descendant of a <button> or an element with role="button", skip it.
    // This prevents issues with aria-label and other attributes of interactive elements.
    if (element.closest('button, [role="button"]') !== null) {
        return true;
    }
    // --- END NEW LOGIC ---

    // Check if the element's tag is in the skip list
    if (skipTags.includes(element.tagName)) {
      return true;
    }

    // Check if the element has any skip classes
    if (skipClasses.some(cls => element.classList?.contains(cls))) {
      return true;
    }

    // Check if the element is content editable
    if (element.isContentEditable) {
      return true;
    }

    // Check if the element or any of its ancestors have translate="no" attribute
    if (element.getAttribute('translate') === 'no' || element.closest('[translate="no"]') !== null) {
      return true;
    }

    return false;
  }

  isSignificantTextBlock(node) {
    // Only process element nodes
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    // Skip elements based on the shouldSkipElement rules
    if (this.shouldSkipElement(node)) return false;

    // Check if it has actual text content and is not just whitespace
    if (!node.textContent?.trim()) return false;

    // Avoid processing elements that are too small or too large to be meaningful text blocks,
    // or elements that are likely just icons/empty containers but have textContent due to children.
    const textLength = node.textContent.trim().length;
    if (textLength < 5 || textLength > 1000) { // Adjust bounds as needed
        // Consider if the element only contains one very short child or is purely decorative
        if (node.children.length === 0 && textLength < 10) return false;
    }

    return true;
  }

  extractTextContent(node) {
    const wordsToProcess = [];
    // Only extract words from direct text nodes within the element that aren't skipped
    const text = node.textContent.trim();
    if (text.length > 0) {
      // Regex to find words (letters, including accented and Cyrillic)
      const words = text.match(/\b[a-zA-ZÀ-ÿĀ-žА-я]+\b/g) || [];
      const validWords = words.filter(word =>
        word.length > 1 && // Words must be at least 2 characters long
        word.length < 20 && // Words should not be excessively long (e.g., concatenated strings)
        /^[a-zA-ZÀ-ÿĀ-žА-я]+$/.test(word) && // Ensure it's purely alphabetic
        !this.state.learnedWords[word.toLowerCase()] // Only process words not yet learned
      );

      if (validWords.length > 0) {
        // Return words that need translation. The actual text node manipulation happens in updateBlockContent.
        return { node, words: validWords };
      }
    }
    return { node, words: [] }; // Return an empty array if no valid words
  }

  // --- REWRITTEN updateBlockContent METHOD ---
  updateBlockContent(block) {
    const { node, words } = block;

    // Use a TreeWalker to find all *actual text nodes* within the block's element.
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      null, // No filter function needed; SHOW_TEXT already filters for text nodes
      false
    );

    let textNode;
    const nodesToProcess = [];

    // Collect text nodes first to avoid issues with walker invalidation during DOM modification
    while ((textNode = walker.nextNode())) {
      // Ensure this text node's parent is not one we want to skip.
      // This leverages the shouldSkipElement logic on the text node's parent.
      if (!this.shouldSkipElement(textNode.parentElement)) {
        nodesToProcess.push(textNode);
      }
    }

    nodesToProcess.forEach(textNode => {
      let originalTextValue = textNode.nodeValue;
      let newTextValueWithPlaceholders = originalTextValue; // This will hold the text with placeholders
      let changed = false;

      words.forEach(word => {
        const translation = this.translationCache.get(word.toLowerCase());
        if (translation && translation !== word) {
          // Only match the word within the text content
          // Using a non-capturing group for the word itself if needed for back-reference
          const regex = new RegExp(`\\b(${this.escapeRegExp(word)})\\b`, 'gi');
          
          if (newTextValueWithPlaceholders.match(regex)) {
            // Replace the word in the *text content* with unique placeholders.
            // These placeholders will then be used to reconstruct the DOM with spans.
            // This prevents the regex from accidentally matching within HTML attributes
            // or causing recursive issues within its own output.
            newTextValueWithPlaceholders = newTextValueWithPlaceholders.replace(regex, (match) => {
              // Store the matched original word and its translation within the placeholder.
              // We use escapeHtml here to ensure any special characters in the word or translation
              // don't break the placeholder splitting.
              return `@@@GT_WORD_START@@@${this.escapeHtml(match)}@@@GT_WORD_END@@@${this.escapeHtml(translation)}`;
            });
            changed = true;
          }
        }
      });

      if (changed) {
        // Now, convert the newTextValueWithPlaceholders into actual DOM nodes.
        const fragment = document.createDocumentFragment();
        // Split by the placeholder pattern. (.*?) captures the original word, and the next part is the translation.
        const parts = newTextValueWithPlaceholders.split(/@@@GT_WORD_START@@@(.*?)@@@GT_WORD_END@@@/g); 

        for (let i = 0; i < parts.length; i++) {
          if (i % 2 === 0) { // Even parts are regular text (before/between/after placeholders)
            if (parts[i]) {
              fragment.appendChild(document.createTextNode(parts[i]));
            }
          } else { // Odd parts are the original word captured by the regex (part of the placeholder)
            const originalWordFromPlaceholder = parts[i];
            const translatedWordFromPlaceholder = parts[i + 1]; // The actual translation is the next part in the split array

            const span = document.createElement('span');
            span.className = 'gt-word';
            span.setAttribute('data-original', originalWordFromPlaceholder); // Set original word
            // IMPORTANT: Omit the 'title' attribute here to prevent recursion and "spamming" issues
            span.textContent = translatedWordFromPlaceholder; // Set translated word as text content

            fragment.appendChild(span);
            i++; // Increment i again to skip the translation part, which we just consumed
          }
        }
        
        // Replace the original text node with the new fragment containing text nodes and spans
        if (fragment.hasChildNodes()) {
            textNode.parentNode.replaceChild(fragment, textNode);
            // console.log(`GlobalFoxTalk: Updated content in text node`); // Uncomment for debugging
        }
      }
    });
  }
  // --- END REWRITTEN updateBlockContent METHOD ---

  processPage() {
    if (!this.state.enabled) return;
    this.isProcessing = true;
    console.log('GlobalFoxTalk: Processing page for translation...');

    // Get all relevant elements that might contain text
    const allElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, a, strong, em, b, i');
    
    // Filter elements: significant text blocks, not already processed, limit to 50 for initial pass
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
    this.isProcessing = false;
  }

  processNewNodes(nodes) {
    if (!this.state.enabled) return;
    this.isProcessing = true;
    console.log(`GlobalFoxTalk: Processing ${nodes.length} new nodes...`);

    const textBlocks = nodes
      .filter(node => this.isSignificantTextBlock(node))
      .filter(node => !this.processedElements.has(node))
      .map(node => this.extractTextContent(node))
      .filter(block => block.words.length > 0);
    
    if (textBlocks.length > 0) {
      this.translateTextBlocks(textBlocks);
    }
    this.isProcessing = false;
  }

  restoreOriginalContent() {
    console.log('GlobalFoxTalk: Restoring original content');
    
    const translatedElements = document.querySelectorAll('.gt-word');
    translatedElements.forEach(element => {
      const original = element.getAttribute('data-original');
      if (original) {
        // Use textContent directly for simple text restoration, or if the original
        // might contain complex HTML, you might need a more sophisticated approach.
        // For words, textContent should be fine.
        element.outerHTML = original; // This assumes original does not contain HTML tags that need to be parsed
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
      }, 2000 * this.retryCount);\n    }\n  }\n}\n\n// Initialize translator when DOM is ready\nif (document.readyState === 'loading') {\n  document.addEventListener('DOMContentLoaded', () => new Translator());\n} else {\n  new Translator();\n}