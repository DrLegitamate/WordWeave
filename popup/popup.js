document.addEventListener('DOMContentLoaded', async () => {
  const state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
  
  // Initialize UI with current state
  document.getElementById('enableToggle').checked = state.enabled;
  document.getElementById('targetLanguage').value = state.targetLanguage;
  document.getElementById('translationRate').value = state.translationRate;
  
  // Event Listeners
  document.getElementById('enableToggle').addEventListener('change', e => {
    updateState({ enabled: e.target.checked });
  });
  
  document.getElementById('targetLanguage').addEventListener('change', e => {
    updateState({ targetLanguage: e.target.value });
  });
  
  document.getElementById('translationRate').addEventListener('change', e => {
    updateState({ translationRate: e.target.value });
  });
});

async function updateState(changes) {
  await browser.runtime.sendMessage({
    type: 'UPDATE_STATE',
    payload: changes
  });
}