class Translator {
  constructor() {
    this.state = null;
    this.initialize();
  }

  async initialize() {
    this.state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    this.setupMutationObserver();
    this.processPage();
  }

  setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          this.processNewNodes(mutation.addedNodes);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processNewNodes(nodes) {
    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        this.processTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        this.processElement(node);
      }
    });
  }

  processElement(element) {
    if (this.shouldSkipElement(element)) return;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      this.processTextNode(node);
    }
  }

  shouldSkipElement(element) {
    const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE'];
    return skipTags.includes(element.tagName) ||
           element.classList.contains('no-translate');
  }

  async processTextNode(node) {
    if (!this.state.enabled) return;
    if (!node.textContent.trim()) return;

    const translationRate = this.getTranslationRate();
    const words = node.textContent.split(/\b/);
    const translatedWords = await Promise.all(
      words.map(async word => {
        if (Math.random() > translationRate) return word;
        
        const translation = await this.translateWord(word);
        return this.wrapTranslatedWord(word, translation);
      })
    );

    const span = document.createElement('span');
    span.innerHTML = translatedWords.join('');
    node.replaceWith(span);
  }

  getTranslationRate() {
    const rates = {
      low: 0.2,
      medium: 0.5,
      high: 0.8
    };
    return rates[this.state.translationRate] || 0.5;
  }

  async translateWord(word) {
    if (!word.trim()) return word;
    
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        payload: { text: word }
      });
      return response.translation || word;
    } catch (error) {
      console.error('Translation error:', error);
      return word;
    }
  }

  wrapTranslatedWord(original, translation) {
    return `<span class="translated-word" data-original="${original}">
              ${translation}
            </span>`;
  }

  processPage() {
    this.processElement(document.body);
  }
}

// Initialize translator
new Translator();