// content.js — Content script for Project Snapshot extension
// Placeholder for SNAP-003/004/005/006 (selection mode, rendering, export).
// Listens for the ENTER_SELECTION_MODE message from the background worker.

console.log('[Project Snapshot] Content script loaded.');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENTER_SELECTION_MODE') {
    console.log('[Project Snapshot] Selection mode message received.');
    // Full implementation in SNAP-003 and beyond.
    sendResponse({ success: true });
  }
});
