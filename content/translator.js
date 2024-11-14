class Translator {
  constructor() {
    this.state = null;
    this.translationCache = new Map();
    this.pendingTranslations = new Set();
    this.debounceTimer = null;
    this.initialize();
  }

  async initialize() {
    this.state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    this.setupMutationObserver();
    this.processPage();
  }

  setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        const addedNodes = mutations
          .filter(m => m.type === 'childList')
          .flatMap(m => Array.from(m.addedNodes));
        
        if (addedNodes.length > 0) {
          this.processNewNodes(addedNodes);
        }
      }, 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processNewNodes(nodes) {
    const textBlocks = nodes
      .filter(node => this.isSignificantTextBlock(node))
      .map(node => this.extractTextContent(node));

    if (textBlocks.length > 0) {
      this.translateTextBlocks(textBlocks);
    }
  }

  isSignificantTextBlock(node) {
    if (!node.textContent?.trim()) return false;
    if (this.shouldSkipElement(node)) return false;

    // Only translate significant text blocks (paragraphs, headings, etc.)
    const significantTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'DIV'];
    return significantTags.includes(node.tagName) && 
           node.textContent.trim().split(/\s+/).length > 3;
  }

  shouldSkipElement(element) {
    const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT'];
    return skipTags.includes(element?.tagName) ||
           element?.classList?.contains('no-translate') ||
           element?.isContentEditable;
  }

  extractTextContent(node) {
    return {
      node,
      text: node.textContent.trim(),
      words: node.textContent.trim().split(/\s+/)
    };
  }

  async translateTextBlocks(blocks) {
    if (!this.state.enabled) return;

    const translationRate = this.getTranslationRate();
    for (const block of blocks) {
      const wordsToTranslate = block.words
        .filter(() => Math.random() < translationRate)
        .filter(word => !this.translationCache.has(word));

      if (wordsToTranslate.length === 0) continue;

      try {
        const translation = await this.batchTranslate(wordsToTranslate);
        wordsToTranslate.forEach((word, i) => {
          this.translationCache.set(word, translation[i]);
        });

        this.updateBlockContent(block);
      } catch (error) {
        console.error('Translation error:', error);
      }
    }
  }

  async batchTranslate(words) {
    const response = await browser.runtime.sendMessage({
      type: 'TRANSLATE_TEXT',
      payload: { text: words.join('\n') }
    });
    return response.translation.split('\n');
  }

  updateBlockContent(block) {
    const { node, words } = block;
    const translatedContent = words.map(word => {
      const translation = this.translationCache.get(word);
      return translation ? 
        `<span class="gt-word" data-original="${word}">${translation}</span>` :
        word;
    }).join(' ');

    if (node.innerHTML !== translatedContent) {
      node.innerHTML = translatedContent;
    }
  }

  getTranslationRate() {
    const rates = {
      low: 0.15,
      medium: 0.3,
      high: 0.5
    };
    return rates[this.state.translationRate] || 0.3;
  }

  processPage() {
    const textBlocks = Array.from(document.body.getElementsByTagName('*'))
      .filter(node => this.isSignificantTextBlock(node))
      .map(node => this.extractTextContent(node));

    this.translateTextBlocks(textBlocks);
  }
}

// Initialize translator
new Translator();
