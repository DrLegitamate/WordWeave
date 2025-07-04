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
    updateStatus('Ready');
    
  } catch (error) {
    console.error('Popup initialization failed:', error);
    updateStatus('Error loading extension');
  }
});

function initializeUI(state) {
  // Initialize toggle
  document.getElementById('enableToggle').checked = state.enabled;
  
  // Initialize settings
  document.getElementById('sourceLanguage').value = state.autoDetectLanguage ? 'auto' : (state.sourceLanguage || 'en');
  document.getElementById('targetLanguage').value = state.targetLanguage;
  document.getElementById('translationRate').value = state.translationRate;
  
  // Update settings section based on enabled status
  updateSettingsState(state.enabled);
}

function setupEventListeners() {
  // Enable/disable toggle
  document.getElementById('enableToggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await updateState({ enabled });
    updateSettingsState(enabled);
    updateStatus(enabled ? 'Extension enabled' : 'Extension disabled');
  });
  
  // Source language changes
  document.getElementById('sourceLanguage').addEventListener('change', async (e) => {
    const value = e.target.value;
    if (value === 'auto') {
      await updateState({ 
        autoDetectLanguage: true,
        sourceLanguage: 'en' // fallback
      });
      updateStatus('Auto-detection enabled');
    } else {
      await updateState({ 
        autoDetectLanguage: false,
        sourceLanguage: value 
      });
      updateStatus('Source language updated');
    }
  });
  
  // Target language changes
  document.getElementById('targetLanguage').addEventListener('change', async (e) => {
    await updateState({ targetLanguage: e.target.value });
    updateStatus('Target language updated');
  });
  
  // Translation rate changes
  document.getElementById('translationRate').addEventListener('change', async (e) => {
    await updateState({ translationRate: e.target.value });
    updateStatus('Translation rate updated');
  });
  
  // Action buttons
  document.getElementById('openOptions').addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
  });
}

async function updateState(changes) {
  try {
    updateStatus('Saving...');
    await browser.runtime.sendMessage({
      type: 'UPDATE_STATE',
      payload: changes
    });
  } catch (error) {
    console.error('Failed to update state:', error);
    updateStatus('Save failed');
  }
}

function updateSettingsState(enabled) {
  const settingsSection = document.querySelector('.settings-section');
  if (enabled) {
    settingsSection.classList.remove('settings-disabled');
  } else {
    settingsSection.classList.add('settings-disabled');
  }
}

function updateStatus(message) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  
  // Clear status after 3 seconds
  setTimeout(() => {
    if (statusElement.textContent === message) {
      statusElement.textContent = 'Ready';
    }
  }, 3000);
}