let currentState = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load current state
    currentState = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    
    if (!currentState) {
      throw new Error('Failed to load extension state');
    }
    
    initializeUI();
    setupEventListeners();
    updateSaveStatus('Settings loaded');
    
  } catch (error) {
    console.error('Options page initialization failed:', error);
    updateSaveStatus('Error loading settings', 'error');
  }
});

function initializeUI() {
  // Translation settings
  document.getElementById('sourceLanguageOptions').value = currentState.autoDetectLanguage ? 'auto' : (currentState.sourceLanguage || 'en');
  document.getElementById('targetLanguageOptions').value = currentState.targetLanguage ?? 'es';
  document.getElementById('translationRateOptions').value = currentState.translationRate ?? 'moderate';
  document.getElementById('translationStrategyOptions').value = currentState.translationStrategy ?? 'balanced';
  document.getElementById('translateHeaders').checked = currentState.translateHeaders ?? true;
  document.getElementById('translateNav').checked = currentState.translateNav ?? true;
  document.getElementById('showTooltips').checked = currentState.showTooltips ?? true;
  document.getElementById('translationService').value = currentState.translationService ?? 'libretranslate';
  
  // Appearance settings
  document.getElementById('highlightColor').value = currentState.highlightColor ?? '#4a90e2';
  document.getElementById('highlightColorText').value = currentState.highlightColor ?? '#4a90e2';
  document.getElementById('fontSize').value = currentState.fontSize ?? 'medium';
  
  // Sites settings
  const excludedSites = currentState.excludedSites || [];
  document.getElementById('excludedSites').value = excludedSites.join('\n');
  
  // Update preview
  updatePreview();
}

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const section = e.target.dataset.section;
      switchSection(section);
    });
  });
  
  // Source language changes
  document.getElementById('sourceLanguageOptions').addEventListener('change', (e) => {
    const value = e.target.value;
    if (value === 'auto') {
      updateState({ 
        autoDetectLanguage: true,
        sourceLanguage: 'en' // fallback
      });
    } else {
      updateState({ 
        autoDetectLanguage: false,
        sourceLanguage: value 
      });
    }
  });
  
  // Target language changes
  document.getElementById('targetLanguageOptions').addEventListener('change', (e) => {
    updateState({ targetLanguage: e.target.value });
  });

  // Translation rate changes
  document.getElementById('translationRateOptions').addEventListener('change', (e) => {
    updateState({ translationRate: e.target.value });
  });

  // Translation strategy changes
  document.getElementById('translationStrategyOptions').addEventListener('change', (e) => {
    updateState({ translationStrategy: e.target.value });
  });
  
  // Color picker synchronization
  document.getElementById('highlightColor').addEventListener('input', (e) => {
    document.getElementById('highlightColorText').value = e.target.value;
    updatePreview();
  });
  
  document.getElementById('highlightColorText').addEventListener('input', (e) => {
    const color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      document.getElementById('highlightColor').value = color;
      updatePreview();
    }
  });
  
  // Font size preview update
  document.getElementById('fontSize').addEventListener('change', updatePreview);
  
  // Site management
  document.getElementById('addCurrentSite').addEventListener('click', addCurrentSite);
  
  // Reset operations
  document.getElementById('resetAllSettings').addEventListener('click', resetAllSettings);
  
  // Save operations
  document.getElementById('saveOptions').addEventListener('click', saveAllOptions);
  document.getElementById('resetToDefaults').addEventListener('click', resetToDefaults);
  
  // Auto-save on change for most settings
  const autoSaveElements = [
    'translateHeaders', 'translateNav', 'showTooltips', 
    'translationService'
  ];
  
  autoSaveElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', debounce(autoSave, 1000));
    }
  });
}

function switchSection(sectionName) {
  // Update navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
  
  // Update content
  document.querySelectorAll('.option-section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(`${sectionName}-section`).classList.add('active');
}

function updatePreview() {
  const color = document.getElementById('highlightColor').value;
  const fontSize = document.getElementById('fontSize').value;
  
  const previewWord = document.querySelector('.preview-word');
  if (previewWord) {
    previewWord.style.color = color;
    previewWord.style.borderBottomColor = color;
    
    const fontSizes = { small: '0.9em', medium: '1em', large: '1.1em' };
    previewWord.style.fontSize = fontSizes[fontSize] || '1em';
  }
  
  // Update CSS custom properties
  document.documentElement.style.setProperty('--gt-highlight-color', color);
}

async function autoSave() {
  const updates = gatherFormData();
  await updateState(updates);
  updateSaveStatus('Auto-saved');
}

async function saveAllOptions() {
  try {
    updateSaveStatus('Saving...', 'loading');
    
    const updates = gatherFormData();
    await updateState(updates);
    
    updateSaveStatus('All settings saved!', 'success');
  } catch (error) {
    console.error('Save failed:', error);
    updateSaveStatus('Save failed', 'error');
  }
}

function gatherFormData() {
  const sourceLanguageValue = document.getElementById('sourceLanguageOptions').value;
  
  return {
    autoDetectLanguage: sourceLanguageValue === 'auto',
    sourceLanguage: sourceLanguageValue === 'auto' ? 'en' : sourceLanguageValue,
    targetLanguage: document.getElementById('targetLanguageOptions').value,
    translationRate: document.getElementById('translationRateOptions').value,
    translationStrategy: document.getElementById('translationStrategyOptions').value,
    translateHeaders: document.getElementById('translateHeaders').checked,
    translateNav: document.getElementById('translateNav').checked,
    showTooltips: document.getElementById('showTooltips').checked,
    translationService: document.getElementById('translationService').value,
    highlightColor: document.getElementById('highlightColor').value,
    fontSize: document.getElementById('fontSize').value,
    excludedSites: document.getElementById('excludedSites').value
      .split('\n')
      .map(site => site.trim())
      .filter(site => site.length > 0)
  };
}

async function updateState(changes) {
  await browser.runtime.sendMessage({
    type: 'UPDATE_STATE',
    payload: changes
  });
  
  // Update local state
  currentState = { ...currentState, ...changes };
}

async function addCurrentSite() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      
      const currentSites = document.getElementById('excludedSites').value;
      const sites = currentSites ? currentSites + '\n' + domain : domain;
      
      document.getElementById('excludedSites').value = sites;
      updateSaveStatus(`Added ${domain} to excluded sites`, 'success');
    }
  } catch (error) {
    updateSaveStatus('Failed to add current site', 'error');
  }
}

async function resetAllSettings() {
  if (!confirm('Are you sure you want to reset ALL settings to defaults? This action cannot be undone.')) {
    return;
  }
  
  try {
    const defaults = {
      enabled: false,
      translationRate: 'moderate',
      translationStrategy: 'balanced',
      targetLanguage: 'es',
      sourceLanguage: 'en',
      autoDetectLanguage: true,
      translateHeaders: true,
      translateNav: true,
      showTooltips: true,
      highlightColor: '#4a90e2',
      fontSize: 'medium',
      translationService: 'libretranslate',
      excludedSites: []
    };
    
    await updateState(defaults);
    
    // Reload page to show default values
    location.reload();
    
  } catch (error) {
    updateSaveStatus('Reset failed', 'error');
  }
}

async function resetToDefaults() {
  if (!confirm('Reset all settings to defaults?')) {
    return;
  }
  
  try {
    const defaults = {
      translationRate: 'moderate',
      translationStrategy: 'balanced',
      targetLanguage: 'es',
      sourceLanguage: 'en',
      autoDetectLanguage: true,
      translateHeaders: true,
      translateNav: true,
      showTooltips: true,
      highlightColor: '#4a90e2',
      fontSize: 'medium',
      translationService: 'libretranslate',
      excludedSites: []
    };
    
    await updateState(defaults);
    
    // Update UI
    initializeUI();
    updateSaveStatus('Settings reset to defaults', 'success');
    
  } catch (error) {
    updateSaveStatus('Reset failed', 'error');
  }
}

function updateSaveStatus(message, type = 'success') {
  const statusElement = document.getElementById('saveStatus');
  statusElement.textContent = message;
  statusElement.className = `save-status ${type}`;
  
  if (type !== 'loading') {
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'save-status';
    }, 3000);
  }
}

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}