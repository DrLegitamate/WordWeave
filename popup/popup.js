// popup/popup.js

document.addEventListener('DOMContentLoaded', async () => {
  let state = null;
  let currentTab = null;
  
  try {
    // Load current state
    state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    if (!state) {
      throw new Error('Failed to load extension state');
    }

    // Get current tab for site exclusion
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        currentTab = tabs[0];
    }
    
    initializeUI(state);
    setupEventListeners();
    updateStatus(state.enabled ? 'Ready to translate' : 'Extension disabled');
    
  } catch (error) {
    console.error('Popup initialization failed:', error);
    updateStatus('Error loading extension', false);
    // Disable controls if state can't be loaded
    document.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
  }
});

function initializeUI(state) {
  // Initialize toggle
  const enableToggle = document.getElementById('enableToggle');
  if (enableToggle) enableToggle.checked = state.enabled;
  
  // Initialize settings
  const targetLanguageSelect = document.getElementById('targetLanguage');
  const translationRateSelect = document.getElementById('translationRate');
  
  if (targetLanguageSelect) targetLanguageSelect.value = state.targetLanguage || 'es';
  if (translationRateSelect) translationRateSelect.value = state.translationRate || 'moderate';
  
  // Update status indicator
  updateStatusIndicator(state.enabled);
  
  // Update intensity indicator
  updateIntensityIndicator(state.translationRate || 'moderate');
}

function setupEventListeners() {
  const enableToggle = document.getElementById('enableToggle');
  const targetLanguageSelect = document.getElementById('targetLanguage');
  const translationRateSelect = document.getElementById('translationRate');
  const translatePageBtn = document.getElementById('translatePage');
  const clearTranslationsBtn = document.getElementById('clearTranslations');
  const excludeSiteBtn = document.getElementById('excludeSite');
  const openOptionsBtn = document.getElementById('openOptions');
  const helpLink = document.getElementById('helpLink');

  // Enable/disable toggle
  if (enableToggle) {
    enableToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await updateState({ enabled });
      updateStatus(enabled ? 'Extension enabled' : 'Extension disabled', enabled);
      updateStatusIndicator(enabled);
      
      // Add haptic feedback simulation
      if (enabled) {
        showBriefAnimation();
      }
    });
  }
  
  // Target language changes
  if (targetLanguageSelect) {
    targetLanguageSelect.addEventListener('change', async (e) => {
      showActionLoading(targetLanguageSelect);
      await updateState({ targetLanguage: e.target.value });
      updateStatus('Target language updated', true);
      showBriefAnimation();
      hideActionLoading(targetLanguageSelect);
    });
  }
  
  // Translation rate changes
  if (translationRateSelect) {
    translationRateSelect.addEventListener('change', async (e) => {
      const rate = e.target.value;
      showActionLoading(translationRateSelect);
      await updateState({ translationRate: rate });
      updateStatus('Learning intensity updated', true);
      updateIntensityIndicator(rate);
      showBriefAnimation();
      hideActionLoading(translationRateSelect);
    });
  }
  
  // Quick actions
  if (translatePageBtn) {
    translatePageBtn.addEventListener('click', async () => {
      updateStatus('Translating page...', true);
      showActionLoading(translatePageBtn);
      // Send message to content script to force translation
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          await browser.tabs.sendMessage(tabs[0].id, { type: 'FORCE_TRANSLATE' });
          updateStatus('Page translated!', true);
        }
      } catch (error) {
        console.error("Translate page error:", error);
        updateStatus('Translation failed', false);
      } finally {
        hideActionLoading(translatePageBtn);
      }
    });
  }

  if (clearTranslationsBtn) {
    clearTranslationsBtn.addEventListener('click', async () => {
      updateStatus('Clearing translations...', true);
      showActionLoading(clearTranslationsBtn);
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          await browser.tabs.sendMessage(tabs[0].id, { type: 'CLEAR_TRANSLATIONS' });
          updateStatus('Page reset!', true);
        }
      } catch (error) {
        console.error("Clear translations error:", error);
        updateStatus('Reset failed', false);
      } finally {
        hideActionLoading(clearTranslationsBtn);
      }
    });
  }

  if (excludeSiteBtn) {
    excludeSiteBtn.addEventListener('click', async () => {
        if (!currentTab || !currentTab.url) {
            updateStatus('Cannot exclude site', false);
            return;
        }
        try {
            const url = new URL(currentTab.url);
            const hostname = url.hostname;
            
            // Get current state to update excluded sites
            const currentState = await browser.runtime.sendMessage({ type: 'GET_STATE' });
            let excludedSites = currentState.excludedSites || [];
            
            if (!excludedSites.includes(hostname)) {
                excludedSites.push(hostname);
                await updateState({ excludedSites });
                updateStatus(`Excluded ${hostname}`, true);
                // Optionally disable extension for this site immediately
                // await updateState({ enabled: false }); 
                // updateStatusIndicator(false);
                // document.getElementById('enableToggle').checked = false;
            } else {
                 updateStatus(`Already excluded`, true);
            }
            showBriefAnimation();
        } catch (error) {
            console.error("Exclude site error:", error);
            updateStatus('Exclude failed', false);
        }
    });
  }
  
  // Action buttons
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
       showActionLoading(openOptionsBtn);
       browser.runtime.openOptionsPage();
       // Don't close immediately, let the loading feedback show
       setTimeout(() => window.close(), 300); 
    });
  }
  
  // Help link
  if (helpLink) {
    helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      browser.tabs.create({ url: 'https://github.com/DrLegitamate/WordWeave#readme' });
      window.close();
    });
  }
}

async function updateState(changes) {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'UPDATE_STATE',
      payload: changes
    });
    if (!response || !response.success) {
        throw new Error('State update not acknowledged by background script');
    }
    return response;
  } catch (error) {
    console.error('Failed to update state:', error);
    updateStatus('Save failed: ' + (error.message || 'Unknown error'), false);
    throw error; // Re-throw to let caller handle if needed
  }
}

function updateStatus(message, isSuccess = true) {
  const statusText = document.getElementById('statusText');
  if (!statusText) return;

  statusText.textContent = message;
  statusText.classList.remove('loading');
  statusText.style.color = isSuccess ? 'var(--text-secondary)' : 'var(--error-color)';
  
  // Clear status after 3 seconds for temporary success messages
  if (isSuccess && (message.includes('updated') || message.includes('enabled') || message.includes('disabled') || message.includes('translated') || message.includes('reset') || message.includes('Excluded'))) {
    setTimeout(() => {
      const currentState = document.getElementById('enableToggle')?.checked;
      if (currentState !== undefined) {
         statusText.textContent = currentState ? 'Ready to translate' : 'Extension disabled';
         statusText.style.color = 'var(--text-secondary)';
      }
    }, 3000);
  }
}

function updateStatusIndicator(enabled) {
  const indicator = document.getElementById('statusIndicator');
  if (!indicator) return;

  if (enabled) {
    indicator.classList.add('active');
  } else {
    indicator.classList.remove('active');
  }
}

function updateIntensityIndicator(rate) {
  const dots = document.querySelectorAll('.intensity-dot');
  const label = document.getElementById('intensityLabel');
  
  if (dots.length === 0 || !label) return; // Safety check if elements not found

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
  if (container) {
    container.style.transform = 'scale(1.01)';
    setTimeout(() => {
      container.style.transform = 'scale(1)';
    }, 150);
  }
}

function showActionLoading(element) {
    if (element) {
        element.classList.add('loading');
        element.disabled = true;
        // For buttons, change text or add spinner
        if (element.classList.contains('primary-btn') || element.classList.contains('quick-action')) {
            const originalHTML = element.innerHTML;
            element.setAttribute('data-original-html', originalHTML);
            element.innerHTML = '<span class="loading-spinner"></span> Processing...';
        }
        // For selects, disable and maybe change appearance
    }
}

function hideActionLoading(element) {
    if (element) {
        element.classList.remove('loading');
        element.disabled = false;
        // Restore original content for buttons
        if (element.classList.contains('primary-btn') || element.classList.contains('quick-action')) {
            const originalHTML = element.getAttribute('data-original-html');
            if (originalHTML) {
                element.innerHTML = originalHTML;
                element.removeAttribute('data-original-html');
            }
        }
    }
}


// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'SELECT') {
    e.target.blur();
  }
  
  // Ctrl/Cmd + Enter to toggle extension
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const toggle = document.getElementById('enableToggle');
    if (toggle && !toggle.disabled) {
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
    }
  }
});

// Add a simple spinner for loading states
const style = document.createElement('style');
style.textContent = `
  .loading-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s ease-in-out infinite;
    margin-right: 5px;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .loading {
    opacity: 0.7;
    cursor: not-allowed;
  }
  select.loading {
    background-image: none; /* Hide dropdown arrow when loading */
  }
`;
document.head.appendChild(style);
