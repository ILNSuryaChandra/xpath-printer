// background.js — Service Worker for Project Snapshot (Manifest V3)
// Handles messages from the popup and coordinates with the content script.

console.log('[Project Snapshot] Background service worker started.');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Project Snapshot] Extension installed/updated.');
});

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVATE_SELECTION') {
    const tabId = message.tabId;

    // Inject the html2canvas and jsPDF libraries into the page, then signal content script
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ['libs/html2canvas.min.js', 'libs/jspdf.umd.min.js'],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('[Project Snapshot] Script injection error:', chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        // Tell content script to enter selection mode
        chrome.tabs.sendMessage(tabId, { type: 'ENTER_SELECTION_MODE' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[Project Snapshot] Content script message error:', chrome.runtime.lastError.message);
          }
          sendResponse({ success: true });
        });
      }
    );

    return true; // Keep message channel open for async response
  }
});
