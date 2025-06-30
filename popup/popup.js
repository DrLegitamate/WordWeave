document.addEventListener('DOMContentLoaded', async () => {
  let state = null;
  let stats = null;
  
  try {
    // Load current state and stats
    state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
    stats = await browser.runtime.sendMessage({ type: 'GET_STATS' });
    
    if (!state) {
      throw new Error('Failed to load extension state');
    }
    
    initializeUI(state, stats);
    setupEventListeners();
    updateStatus('Ready');
    
  } catch (error) {
    console.error('Popup initialization failed:', error);
    updateStatus('Error loading extension');
  }
});

function initializeUI(state, stats) {
  // Initialize toggle
  document.getElementById('enableToggle').checked = state.enabled;
  
  // Initialize settings
  document.getElementById('sourceLanguage').value = state.autoDetectLanguage ? 'auto' : (state.sourceLanguage || 'en');
  document.getElementById('targetLanguage').value = state.targetLanguage;
  document.getElementById('translationRate').value = state.translationRate;
  document.getElementById('dailyGoal').value = state.dailyGoal || 10;
  
  // Update stats
  if (stats) {
    document.getElementById('wordsToday').textContent = stats.wordsLearnedToday;
    document.getElementById('totalWords').textContent = stats.totalWordsLearned;
    document.getElementById('streak').textContent = stats.streak;
    
    // Update progress
    const progress = Math.min((stats.wordsLearnedToday / stats.dailyGoal) * 100, 100);
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `${stats.wordsLearnedToday}/${stats.dailyGoal}`;
  }
  
  // Update UI state based on enabled status
  updateUIState(state.enabled);
}

function setupEventListeners() {
  // Enable/disable toggle
  document.getElementById('enableToggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await updateState({ enabled });
    updateUIState(enabled);
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
  
  // Daily goal changes
  document.getElementById('dailyGoal').addEventListener('change', async (e) => {
    const dailyGoal = parseInt(e.target.value);
    await updateState({ dailyGoal });
    
    // Refresh stats to update progress bar
    const stats = await browser.runtime.sendMessage({ type: 'GET_STATS' });
    const progress = Math.min((stats.wordsLearnedToday / dailyGoal) * 100, 100);
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `${stats.wordsLearnedToday}/${dailyGoal}`;
    
    updateStatus('Daily goal updated');
  });
  
  // Action buttons
  document.getElementById('openOptions').addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
  });
  
  document.getElementById('resetProgress').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all learning progress? This cannot be undone.')) {
      await updateState({ 
        learnedWords: {}, 
        wordsLearnedToday: 0,
        lastResetDate: new Date().toDateString()
      });
      
      // Refresh UI
      document.getElementById('wordsToday').textContent = '0';
      document.getElementById('totalWords').textContent = '0';
      document.getElementById('streak').textContent = '0';
      document.getElementById('progressFill').style.width = '0%';
      document.getElementById('progressText').textContent = '0/' + document.getElementById('dailyGoal').value;
      
      updateStatus('Progress reset');
    }
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

function updateUIState(enabled) {
  const container = document.querySelector('.popup-container');
  if (enabled) {
    container.classList.remove('disabled');
  } else {
    container.classList.add('disabled');
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

// Auto-refresh stats every 30 seconds when popup is open
setInterval(async () => {
  try {
    const stats = await browser.runtime.sendMessage({ type: 'GET_STATS' });
    if (stats) {
      document.getElementById('wordsToday').textContent = stats.wordsLearnedToday;
      document.getElementById('totalWords').textContent = stats.totalWordsLearned;
      document.getElementById('streak').textContent = stats.streak;
      
      const dailyGoal = parseInt(document.getElementById('dailyGoal').value);
      const progress = Math.min((stats.wordsLearnedToday / dailyGoal) * 100, 100);
      document.getElementById('progressFill').style.width = `${progress}%`;
      document.getElementById('progressText').textContent = `${stats.wordsLearnedToday}/${dailyGoal}`;
    }
  } catch (error) {
    // Silently fail - popup might be closing
  }
}, 30000);