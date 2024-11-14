document.addEventListener('DOMContentLoaded', async () => {
  const state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
  
  // Load current settings
  document.getElementById('translateHeaders').checked = state.translateHeaders ?? true;
  document.getElementById('translateNav').checked = state.translateNav ?? true;
  document.getElementById('showTooltips').checked = state.showTooltips ?? true;
  document.getElementById('highlightColor').value = state.highlightColor ?? '#4a90e2';
  document.getElementById('fontSize').value = state.fontSize ?? 'medium';
  
  // Event Listeners
  document.getElementById('saveOptions').addEventListener('click', saveOptions);
  document.getElementById('resetOptions').addEventListener('click', resetOptions);
  document.getElementById('vocabImport').addEventListener('change', handleVocabImport);
  document.getElementById('exportVocab').addEventListener('click', exportVocab);
});

async function saveOptions() {
  const updates = {
    translateHeaders: document.getElementById('translateHeaders').checked,
    translateNav: document.getElementById('translateNav').checked,
    showTooltips: document.getElementById('showTooltips').checked,
    highlightColor: document.getElementById('highlightColor').value,
    fontSize: document.getElementById('fontSize').value
  };
  
  await browser.runtime.sendMessage({
    type: 'UPDATE_STATE',
    payload: updates
  });
  
  // Show save confirmation
  const button = document.getElementById('saveOptions');
  const originalText = button.textContent;
  button.textContent = 'Saved!';
  button.disabled = true;
  
  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
  }, 2000);
}

async function resetOptions() {
  const defaults = {
    translateHeaders: true,
    translateNav: true,
    showTooltips: true,
    highlightColor: '#4a90e2',
    fontSize: 'medium'
  };
  
  await browser.runtime.sendMessage({
    type: 'UPDATE_STATE',
    payload: defaults
  });
  
  // Reload page to show default values
  location.reload();
}

async function handleVocabImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let vocab;
      if (file.name.endsWith('.json')) {
        vocab = JSON.parse(e.target.result);
      } else if (file.name.endsWith('.csv')) {
        vocab = {};
        const lines = e.target.result.split('\n');
        for (const line of lines) {
          const [original, translation] = line.split(',').map(s => s.trim());
          if (original && translation) {
            vocab[original] = translation;
          }
        }
      }
      
      await browser.runtime.sendMessage({
        type: 'UPDATE_STATE',
        payload: { customVocab: vocab }
      });
      
      alert('Vocabulary imported successfully!');
    } catch (error) {
      alert('Error importing vocabulary: ' + error.message);
    }
  };
  
  if (file.name.endsWith('.json')) {
    reader.readAsText(file);
  } else if (file.name.endsWith('.csv')) {
    reader.readAsText(file);
  } else {
    alert('Please upload a .json or .csv file');
  }
}

async function exportVocab() {
  const state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
  const vocab = state.customVocab;
  
  const blob = new Blob([JSON.stringify(vocab, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vocabulary.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}