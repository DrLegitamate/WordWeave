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
  document.getElementById('targetLanguage').value = state.targetLanguage;
  document.getElementById('translationRate').value = state.translationRate;
  document.getElementById('translationStrategy').value = state.translationStrategy || 'balanced';
  
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
  
  // Target language changes
  document.getElementById('targetLanguage').addEventListener('change', async (e) => {
    await updateState({ targetLanguage: e.target.value });
    updateStatus('Target language updated');
  });
  
  // Translation rate changes
  document.getElementById('translationRate').addEventListener('change', async (e) => {
    await updateState({ translationRate: e.target.value });
    updateStatus('Translation intensity updated');
  });

  // Translation strategy changes
  document.getElementById('translationStrategy').addEventListener('change', async (e) => {
    await updateState({ translationStrategy: e.target.value });
    updateStatus('Translation strategy updated');
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