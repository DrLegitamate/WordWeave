document.addEventListener('DOMContentLoaded', async () => {
  let state = null;
  
  try {
    // Load current state
    state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    
    if (!state) {
      throw new Error('Failed to load extension state');
    }
    
    initializeUI(state);
    setupEventListeners();
    updateStatus(state.enabled ? 'Ready to translate' : 'Extension disabled');
    
  } catch (error) {
    console.error('Popup initialization failed:', error);
    updateStatus('Error loading extension', false);
  }
});

function initializeUI(state) {
  // Initialize toggle
  document.getElementById('enableToggle').checked = state.enabled;
  
  // Initialize settings
  document.getElementById('targetLanguage').value = state.targetLanguage;
  document.getElementById('translationRate').value = state.translationRate;
  
  // Update status indicator
  updateStatusIndicator(state.enabled);
  
  // Update intensity indicator
  updateIntensityIndicator(state.translationRate);
}

function setupEventListeners() {
  // Enable/disable toggle
  document.getElementById('enableToggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await updateState({ enabled });
    updateStatus(enabled ? 'Extension enabled' : 'Extension disabled', enabled);
    updateStatusIndicator(enabled);
    
    // Add haptic feedback simulation
    if (enabled) {
      showBriefAnimation();
    }
  });
  
  // Target language changes
  document.getElementById('targetLanguage').addEventListener('change', async (e) => {
    await updateState({ targetLanguage: e.target.value });
    updateStatus('Target language updated', true);
    showBriefAnimation();
  });
  
  // Translation rate changes
  document.getElementById('translationRate').addEventListener('change', async (e) => {
    const rate = e.target.value;
    await updateState({ translationRate: rate });
    updateStatus('Learning intensity updated', true);
    updateIntensityIndicator(rate);
    showBriefAnimation();
  });
  
  // Quick actions
  document.getElementById('translatePage').addEventListener('click', async () => {
    updateStatus('Translating page...', true);
    // Send message to content script to force translation
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await browser.tabs.sendMessage(tabs[0].id, { type: 'FORCE_TRANSLATE' });
        updateStatus('Page translated!', true);
      }
    } catch (error) {
      updateStatus('Translation failed', false);
    }
  });
  
  document.getElementById('clearTranslations').addEventListener('click', async () => {
    updateStatus('Clearing translations...', true);
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await browser.tabs.sendMessage(tabs[0].id, { type: 'CLEAR_TRANSLATIONS' });
        updateStatus('Page reset!', true);
      }
    } catch (error) {
      updateStatus('Reset failed', false);
    }
  });
  
  // Action buttons
  document.getElementById('openOptions').addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
  });
  
  // Help link
  document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: 'https://github.com/DrLegitamate/WordWeave#readme' });
    window.close();
  });
}

async function updateState(changes) {
  try {
    await browser.runtime.sendMessage({
      type: 'UPDATE_STATE',
      payload: changes
    });
  } catch (error) {
    console.error('Failed to update state:', error);
    updateStatus('Save failed', false);
  }
}

function updateStatus(message, success = true) {
  const statusText = document.getElementById('statusText');
  statusText.textContent = message;
  
  // Clear status after 3 seconds for temporary messages
  if (message.includes('updated') || message.includes('enabled') || message.includes('disabled') || message.includes('failed')) {
    setTimeout(() => {
      const currentState = document.getElementById('enableToggle').checked;
      statusText.textContent = currentState ? 'Ready to translate' : 'Extension disabled';
    }, 3000);
  }
}

function updateStatusIndicator(enabled) {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  if (enabled) {
    indicator.classList.add('active');
    statusText.textContent = 'Ready to translate';
  } else {
    indicator.classList.remove('active');
    statusText.textContent = 'Extension disabled';
  }
}

function updateIntensityIndicator(rate) {
  const dots = document.querySelectorAll('.intensity-dot');
  const label = document.getElementById('intensityLabel');
  
  const intensityMap = {
    minimal: { dots: 1, label: 'Very light learning' },
    light: { dots: 2, label: 'Light learning pace' },
    moderate: { dots: 3, label: 'Moderate learning pace' },
    medium: { dots: 4, label: 'Active learning pace' },
    heavy: { dots: 4, label: 'Intensive learning' },
    intensive: { dots: 5, label: 'Maximum intensity' }
  };
  
  const config = intensityMap[rate] || intensityMap.moderate;
  
  // Update dots
  dots.forEach((dot, index) => {
    if (index < config.dots) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
  
  // Update label
  label.textContent = config.label;
}

function showBriefAnimation() {
  const container = document.querySelector('.popup-container');
  container.style.transform = 'scale(1.02)';
  setTimeout(() => {
    container.style.transform = 'scale(1)';
  }, 150);
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'SELECT') {
    e.target.blur();
  }
  
  // Ctrl/Cmd + Enter to toggle extension
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const toggle = document.getElementById('enableToggle');
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event('change'));
  }
});