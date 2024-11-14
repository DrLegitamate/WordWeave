let state = {
  enabled: false,
  translationRate: 'medium',
  targetLanguage: 'es'
};

// Initialize state from storage
browser.storage.local.get().then(result => {
  state = { ...state, ...result };
});

// Listen for messages from content scripts and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE':
      sendResponse(state);
      break;
    case 'UPDATE_STATE':
      state = { ...state, ...message.payload };
      browser.storage.local.set(message.payload);
      // Notify content scripts of state change
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          browser.tabs.sendMessage(tab.id, {
            type: 'STATE_UPDATED',
            payload: state
          }).catch(() => {});
        });
      });
      break;
    case 'TRANSLATE_TEXT':
      translateText(message.payload.text, state.targetLanguage)
        .then(translation => sendResponse({ translation }))
        .catch(error => sendResponse({ error: error.message }));
      return true; // Required for async response
  }
});

async function translateText(text, targetLang) {
  const response = await fetch('https://libretranslate.com/translate', {
    method: 'POST',
    body: JSON.stringify({
      q: text,
      source: 'auto',
      target: targetLang
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data.translatedText;
}