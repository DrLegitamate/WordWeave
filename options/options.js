// options/options.js

document.addEventListener('DOMContentLoaded', async () => {
  let state = null;

  try {
    // Load current state from background script
    state = await browser.runtime.sendMessage({ type: 'GET_STATE' });

    if (!state) {
      throw new Error('Failed to load extension state');
    }

    populateForm(state);
    setupEventListeners();
    updatePreview(state); // Pass state for initial preview
    updateStatus('Settings loaded.', true);

  } catch (error) {
    console.error('Options page initialization failed:', error);
    updateStatus('Error loading settings: ' + (error.message || 'Unknown error'), false);
  }
});

function populateForm(state) {
  // --- Helper Functions ---
  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = Boolean(value);
      } else {
        element.value = value !== undefined ? value : '';
      }
    }
  };

  const setTextareaValue = (id, arrayValue) => {
    const element = document.getElementById(id);
    if (element && Array.isArray(arrayValue)) {
      element.value = arrayValue.join('\n');
    }
  };
  // --- End Helper Functions ---

  // Populate fields using their IDs from options.html
  setValue('sourceLanguageOptions', state.sourceLanguage || 'auto');
  setValue('targetLanguageOptions', state.targetLanguage || 'es');
  setValue('translationRateOptions', state.translationRate || 'moderate');
  setValue('translateHeaders', state.translateHeaders !== false); // Default true
  setValue('translateNav', state.translateNav !== false); // Default true
  setValue('showTooltips', state.showTooltips !== false); // Default true
  setValue('translationService', state.translationService || 'libretranslate');
  setValue('highlightColor', state.highlightColor || '#6366f1');
  setValue('highlightColorText', state.highlightColor || '#6366f1'); // Sync text input
  setValue('fontSize', state.fontSize || 'medium');
  setTextareaValue('excludedSites', state.excludedSites || []);

  // Trigger initial preview update based on loaded values
  updatePreview(state);
}

function setupEventListeners() {
  // --- Navigation ---
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetSection = button.getAttribute('data-section');
      showSection(targetSection);
      // Update active button state
      navButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });

  // --- Form Interactions ---
  // Sync color picker and text input
  const colorPicker = document.getElementById('highlightColor');
  const colorTextInput = document.getElementById('highlightColorText');
  if (colorPicker && colorTextInput) {
    colorPicker.addEventListener('input', () => {
      colorTextInput.value = colorPicker.value;
      updatePreview(); // Update preview on change
    });
    colorTextInput.addEventListener('change', () => {
      const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(colorTextInput.value);
      if (isValidHex) {
        colorPicker.value = colorTextInput.value;
        updatePreview(); // Update preview on valid change
      } else {
        updateStatus('Invalid hex color format (e.g., #FF0000)', false);
        // Revert to last known good value from state or picker
        // This is a bit tricky without global state here, but color picker usually holds valid value
        // We'll just not update the picker if text is invalid for now.
        // A more robust solution might store the last valid value.
      }
    });
  }

  // Update preview when font size or highlight color changes
  const fontSizeSelect = document.getElementById('fontSize');
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', updatePreview);
  }
  // Color picker event is already handled above

  // --- Actions ---
  const saveButton = document.getElementById('saveOptions');
  if (saveButton) {
    saveButton.addEventListener('click', handleSave);
  }

  const resetButton = document.getElementById('resetToDefaults');
  if (resetButton) {
    resetButton.addEventListener('click', handleReset);
  }

  const addCurrentSiteButton = document.getElementById('addCurrentSite');
  if (addCurrentSiteButton) {
    addCurrentSiteButton.addEventListener('click', handleAddCurrentSite);
  }
}

function showSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.option-section').forEach(section => {
    section.classList.remove('active');
  });
  // Show the target section
  const targetSection = document.getElementById(`${sectionName}-section`);
  if (targetSection) {
    targetSection.classList.add('active');
  }
}

// Centralized preview update function
function updatePreview(state = null) {
  // If state is not passed, try to get values from the form
  const highlightColor = state?.highlightColor || document.getElementById('highlightColor')?.value || '#6366f1';
  const fontSize = state?.fontSize || document.getElementById('fontSize')?.value || 'medium';

  // Define font size mapping
  const fontSizeMap = {
    'small': '90%',
    'medium': '100%',
    'large': '110%'
  };
  const cssFontSize = fontSizeMap[fontSize] || fontSizeMap['medium'];

  // Update the preview words using CSS variables or direct styles
  const previewWords = document.querySelectorAll('.gt-word.preview-word');
  previewWords.forEach(word => {
    // Use CSS variables for dynamic updates
    word.style.setProperty('--preview-highlight-color', highlightColor);
    word.style.setProperty('--preview-font-size', cssFontSize);
    // Ensure base styles are applied if not in CSS
    word.style.backgroundColor = `var(--preview-highlight-color, ${highlightColor})`;
    word.style.fontSize = `var(--preview-font-size, ${cssFontSize})`;
  });
}


async function handleSave() {
  updateStatus('Saving...', true);

  try {
    // --- Collect Data ---
    const newSettings = {};

    // Simple Inputs & Selects
    newSettings.sourceLanguage = document.getElementById('sourceLanguageOptions')?.value || 'auto';
    newSettings.targetLanguage = document.getElementById('targetLanguageOptions')?.value || 'es';
    newSettings.translationRate = document.getElementById('translationRateOptions')?.value || 'moderate';
    newSettings.translationService = document.getElementById('translationService')?.value || 'libretranslate';
    newSettings.highlightColor = document.getElementById('highlightColor')?.value || '#6366f1';
    newSettings.fontSize = document.getElementById('fontSize')?.value || 'medium';

    // Checkboxes
    newSettings.translateHeaders = document.getElementById('translateHeaders')?.checked ?? true;
    newSettings.translateNav = document.getElementById('translateNav')?.checked ?? true;
    newSettings.showTooltips = document.getElementById('showTooltips')?.checked ?? true;

    // Textarea (Excluded Sites)
    const excludedSitesTextarea = document.getElementById('excludedSites');
    if (excludedSitesTextarea) {
      // Split by newlines, filter out empty lines, trim whitespace
      newSettings.excludedSites = excludedSitesTextarea.value
        .split('\n')
        .map(site => site.trim())
        .filter(site => site.length > 0);
    } else {
      newSettings.excludedSites = [];
    }

    console.log('Saving settings:', newSettings);

    // --- Send to Background ---
    const response = await browser.runtime.sendMessage({
      type: 'UPDATE_STATE',
      payload: newSettings
    });

    if (response && response.success) {
      updateStatus('Settings saved successfully!', true);
      // Briefly show success, then clear
      setTimeout(() => updateStatus('', true), 3000);
    } else {
      throw new Error('Background script did not acknowledge save');
    }

  } catch (error) {
    console.error('Save error:', error);
    updateStatus('Failed to save settings: ' + (error.message || 'Unknown error'), false);
  }
}

async function handleReset() {
  if (!confirm('Are you sure you want to reset all settings to their default values?')) {
    return;
  }

  updateStatus('Resetting...', true);
  try {
    // Define default state (should ideally match background.js defaults)
    const defaultSettings = {
      enabled: false,
      translationRate: 'moderate',
      targetLanguage: 'es',
      sourceLanguage: 'en',
      translateHeaders: true,
      translateNav: true,
      showTooltips: true,
      highlightColor: '#6366f1', // Updated default to match options.html
      fontSize: 'medium',
      translationService: 'libretranslate',
      autoDetectLanguage: true,
      excludedSites: []
    };

    const response = await browser.runtime.sendMessage({
      type: 'UPDATE_STATE',
      payload: defaultSettings
    });

    if (response && response.success) {
      // Re-populate the form with defaults
      populateForm(defaultSettings);
      updatePreview(defaultSettings); // Update preview with defaults
      updateStatus('Settings reset to defaults.', true);
      // Switch to the first tab (Translation) after reset
      showSection('translation');
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelector('.nav-btn[data-section="translation"]').classList.add('active');
    } else {
      throw new Error('Background script did not acknowledge reset');
    }
  } catch (error) {
    console.error('Reset error:', error);
    updateStatus('Failed to reset settings: ' + (error.message || 'Unknown error'), false);
  }
}

async function handleAddCurrentSite() {
    try {
        // Query the currently active tab
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].url) {
            const currentUrl = new URL(tabs[0].url);
            const currentDomain = currentUrl.hostname;

            const excludedSitesTextarea = document.getElementById('excludedSites');
            if (excludedSitesTextarea) {
                let currentSites = excludedSitesTextarea.value
                    .split('\n')
                    .map(site => site.trim())
                    .filter(site => site.length > 0);

                if (!currentSites.includes(currentDomain)) {
                    currentSites.push(currentDomain);
                    // Join with newlines and ensure trailing newline for UX
                    excludedSitesTextarea.value = currentSites.join('\n') + (currentSites.length > 0 ? '\n' : '');
                    updateStatus(`Added ${currentDomain} to the exclusion list.`, true);
                } else {
                     updateStatus(`${currentDomain} is already in the list.`, false);
                }
            } else {
                 throw new Error('Excluded sites textarea not found.');
            }
        } else {
             throw new Error('Could not determine the current site.');
        }
    } catch (error) {
        console.error("Add current site error:", error);
        updateStatus('Could not add current site: ' + (error.message || 'Unknown error'), false);
    }
}


function updateStatus(message, isSuccess = true) {
  const statusElement = document.getElementById('saveStatus');
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.className = 'save-status'; // Reset classes
  if (message) {
    statusElement.classList.add(isSuccess ? 'success' : 'error');
  }
}
