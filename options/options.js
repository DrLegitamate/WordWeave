let currentState = null;
let currentStats = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load current state and stats
    currentState = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    currentStats = await browser.runtime.sendMessage({ type: 'GET_STATS' });
    
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
  document.getElementById('translateHeaders').checked = currentState.translateHeaders ?? true;
  document.getElementById('translateNav').checked = currentState.translateNav ?? true;
  document.getElementById('showTooltips').checked = currentState.showTooltips ?? true;
  document.getElementById('translationService').value = currentState.translationService ?? 'libretranslate';
  document.getElementById('autoDetectLanguage').checked = currentState.autoDetectLanguage ?? true;
  
  // Appearance settings
  document.getElementById('highlightColor').value = currentState.highlightColor ?? '#4a90e2';
  document.getElementById('highlightColorText').value = currentState.highlightColor ?? '#4a90e2';
  document.getElementById('fontSize').value = currentState.fontSize ?? 'medium';
  
  // Learning settings
  document.getElementById('dailyGoalOptions').value = currentState.dailyGoal ?? 10;
  
  // Sites settings
  const excludedSites = currentState.excludedSites || [];
  document.getElementById('excludedSites').value = excludedSites.join('\n');
  
  // Update stats
  if (currentStats) {
    document.getElementById('totalLearnedStat').textContent = currentStats.totalWordsLearned;
    document.getElementById('currentStreakStat').textContent = currentStats.streak;
    document.getElementById('todayLearnedStat').textContent = currentStats.wordsLearnedToday;
  }
  
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
  
  // File operations
  document.getElementById('vocabImport').addEventListener('change', handleVocabImport);
  document.getElementById('exportVocab').addEventListener('click', exportVocab);
  
  // Site management
  document.getElementById('addCurrentSite').addEventListener('click', addCurrentSite);
  
  // Reset operations
  document.getElementById('resetLearningProgress').addEventListener('click', resetLearningProgress);
  document.getElementById('resetAllSettings').addEventListener('click', resetAllSettings);
  
  // Save operations
  document.getElementById('saveOptions').addEventListener('click', saveAllOptions);
  document.getElementById('resetToDefaults').addEventListener('click', resetToDefaults);
  
  // Auto-save on change for most settings
  const autoSaveElements = [
    'translateHeaders', 'translateNav', 'showTooltips', 
    'translationService', 'autoDetectLanguage', 'dailyGoalOptions'
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
  return {
    translateHeaders: document.getElementById('translateHeaders').checked,
    translateNav: document.getElementById('translateNav').checked,
    showTooltips: document.getElementById('showTooltips').checked,
    translationService: document.getElementById('translationService').value,
    autoDetectLanguage: document.getElementById('autoDetectLanguage').checked,
    highlightColor: document.getElementById('highlightColor').value,
    fontSize: document.getElementById('fontSize').value,
    dailyGoal: parseInt(document.getElementById('dailyGoalOptions').value),
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

async function handleVocabImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    updateSaveStatus('Importing vocabulary...', 'loading');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let vocab = {};
        
        if (file.name.endsWith('.json')) {
          vocab = JSON.parse(e.target.result);
        } else if (file.name.endsWith('.csv')) {
          const lines = e.target.result.split('\n');
          for (const line of lines) {
            const [original, translation] = line.split(',').map(s => s.trim());
            if (original && translation) {
              vocab[original] = translation;
            }
          }
        }
        
        await updateState({ customVocab: vocab });
        updateSaveStatus(`Imported ${Object.keys(vocab).length} vocabulary entries`, 'success');
        
      } catch (error) {
        updateSaveStatus('Import failed: Invalid file format', 'error');
      }
    };
    
    reader.readAsText(file);
    
  } catch (error) {
    updateSaveStatus('Import failed', 'error');
  }
}

async function exportVocab() {
  try {
    const learnedWords = currentState.learnedWords || {};
    const customVocab = currentState.customVocab || {};
    
    const exportData = {
      learnedWords,
      customVocab,
      exportDate: new Date().toISOString(),
      totalWords: Object.keys(learnedWords).length
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `globalfoxtalk-vocabulary-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    updateSaveStatus('Vocabulary exported successfully', 'success');
    
  } catch (error) {
    updateSaveStatus('Export failed', 'error');
  }
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

async function resetLearningProgress() {
  if (!confirm('Are you sure you want to reset all learning progress? This will delete all learned words and statistics. This action cannot be undone.')) {
    return;
  }
  
  try {
    await updateState({
      learnedWords: {},
      wordsLearnedToday: 0,
      lastResetDate: new Date().toDateString()
    });
    
    // Update UI
    document.getElementById('totalLearnedStat').textContent = '0';
    document.getElementById('currentStreakStat').textContent = '0';
    document.getElementById('todayLearnedStat').textContent = '0';
    
    updateSaveStatus('Learning progress reset', 'success');
    
  } catch (error) {
    updateSaveStatus('Reset failed', 'error');
  }
}

async function resetAllSettings() {
  if (!confirm('Are you sure you want to reset ALL settings to defaults? This will also reset your learning progress. This action cannot be undone.')) {
    return;
  }
  
  try {
    const defaults = {
      enabled: false,
      translationRate: 'medium',
      targetLanguage: 'es',
      translateHeaders: true,
      translateNav: true,
      showTooltips: true,
      highlightColor: '#4a90e2',
      fontSize: 'medium',
      customVocab: {},
      learnedWords: {},
      translationService: 'libretranslate',
      autoDetectLanguage: true,
      excludedSites: [],
      dailyGoal: 10,
      wordsLearnedToday: 0,
      lastResetDate: new Date().toDateString()
    };
    
    await updateState(defaults);
    
    // Reload page to show default values
    location.reload();
    
  } catch (error) {
    updateSaveStatus('Reset failed', 'error');
  }
}

async function resetToDefaults() {
  if (!confirm('Reset all settings to defaults? (This will not affect your learned vocabulary)')) {
    return;
  }
  
  try {
    const defaults = {
      translationRate: 'medium',
      targetLanguage: 'es',
      translateHeaders: true,
      translateNav: true,
      showTooltips: true,
      highlightColor: '#4a90e2',
      fontSize: 'medium',
      translationService: 'libretranslate',
      autoDetectLanguage: true,
      excludedSites: [],
      dailyGoal: 10
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

// Auto-refresh stats every 30 seconds
setInterval(async () => {
  try {
    currentStats = await browser.runtime.sendMessage({ type: 'GET_STATS' });
    if (currentStats) {
      document.getElementById('totalLearnedStat').textContent = currentStats.totalWordsLearned;
      document.getElementById('currentStreakStat').textContent = currentStats.streak;
      document.getElementById('todayLearnedStat').textContent = currentStats.wordsLearnedToday;
    }
  } catch (error) {
    // Silently fail
  }
}, 30000);