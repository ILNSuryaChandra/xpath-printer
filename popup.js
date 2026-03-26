// popup.js — Handles the popup UI interactions for Project Snapshot

const captureBtn = document.getElementById('capture-btn');
const btnLabel = captureBtn.querySelector('.btn-label');

captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  btnLabel.textContent = 'Activating…';

  try {
    // Get the currently active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      showError('No active tab found.');
      return;
    }

    // Send activation message to the background service worker
    const response = await chrome.runtime.sendMessage({
      type: 'ACTIVATE_SELECTION',
      tabId: tab.id,
    });

    if (response && response.success) {
      captureBtn.classList.add('active');
      btnLabel.textContent = 'Selection Mode Active';
      captureBtn.disabled = false;

      // Auto-close popup after a short delay so user can interact with page
      setTimeout(() => window.close(), 800);
    } else {
      showError('Failed to activate. Try reloading the page.');
    }
  } catch (err) {
    console.error('[Project Snapshot] Popup error:', err);
    showError('An error occurred. Please try again.');
  }
});

function showError(msg) {
  captureBtn.disabled = false;
  btnLabel.textContent = 'Capture Element';
  captureBtn.classList.remove('active');

  const hint = document.querySelector('.hint');
  hint.style.color = '#f87171';
  hint.textContent = msg;

  setTimeout(() => {
    hint.style.color = '';
    hint.innerHTML = 'Press <kbd>ESC</kbd> to cancel selection mode.';
  }, 3000);
}
