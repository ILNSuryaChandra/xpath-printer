// content.js — Content script for Project Snapshot extension
// Implements SNAP-003: Interactive Element Selector — Hover Highlight
// Implements SNAP-004: Click to Select & Event Interception

console.log('[Project Snapshot] Content script loaded.');

// ─── State ────────────────────────────────────────────────────────────────────
let selectionActive = false;
let currentTarget = null;
let selectedElement = null;  // SNAP-004: Persisted target for the rendering pipeline

// ─── Injected DOM elements ────────────────────────────────────────────────────
let overlay = null;      // blue semi-transparent highlight box
let tooltip = null;      // tag/class label near the cursor
let banner = null;       // top-of-page instruction toast

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLabel(el) {
  let label = el.tagName.toLowerCase();
  if (el.id) label += `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).slice(0, 3).join('.');
    if (classes) label += `.${classes}`;
  }
  return label;
}

function positionOverlay(el) {
  const rect = el.getBoundingClientRect();
  overlay.style.top    = `${rect.top    + window.scrollY}px`;
  overlay.style.left   = `${rect.left   + window.scrollX}px`;
  overlay.style.width  = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.display = 'block';
}

function positionTooltip(el, mouseX, mouseY) {
  tooltip.textContent = buildLabel(el);
  // Keep tooltip just below and to the right of the cursor
  const tx = mouseX + window.scrollX + 12;
  const ty = mouseY + window.scrollY + 16;
  tooltip.style.left = `${tx}px`;
  tooltip.style.top  = `${ty}px`;
  tooltip.style.display = 'block';
}

// ─── Injected elements creation ───────────────────────────────────────────────

function createOverlay() {
  const el = document.createElement('div');
  el.id = 'snapshot-overlay';
  el.style.cssText = [
    'position:absolute',
    'pointer-events:none',
    'z-index:2147483646',
    'display:none',
    'box-sizing:border-box',
    'outline:2px solid rgba(59,130,246,0.85)',
    'background:rgba(59,130,246,0.15)',
    'border-radius:3px',
    'transition:top 60ms,left 60ms,width 60ms,height 60ms',
  ].join(';');
  document.documentElement.appendChild(el);
  return el;
}

function createTooltip() {
  const el = document.createElement('div');
  el.id = 'snapshot-tooltip';
  el.style.cssText = [
    'position:absolute',
    'pointer-events:none',
    'z-index:2147483647',
    'display:none',
    'background:rgba(17,24,39,0.92)',
    'color:#93c5fd',
    'font:500 11px/1 "SF Mono",ui-monospace,monospace',
    'padding:4px 8px',
    'border-radius:4px',
    'white-space:nowrap',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
    'letter-spacing:0.02em',
  ].join(';');
  document.documentElement.appendChild(el);
  return el;
}

function createBanner() {
  const el = document.createElement('div');
  el.id = 'snapshot-banner';
  el.textContent = '📸  Click any element to capture it.  Press ESC to cancel.';
  el.style.cssText = [
    'position:fixed',
    'top:12px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:2147483647',
    'background:rgba(17,24,39,0.94)',
    'color:#f9fafb',
    'font:500 13px/1.4 "Inter",system-ui,sans-serif',
    'padding:10px 20px',
    'border-radius:8px',
    'box-shadow:0 4px 24px rgba(0,0,0,0.45)',
    'pointer-events:none',
    'white-space:nowrap',
    'border:1px solid rgba(59,130,246,0.4)',
  ].join(';');
  document.documentElement.appendChild(el);
  return el;
}

// ─── Event handlers ───────────────────────────────────────────────────────────

function onMouseMove(e) {
  // Ignore our own injected elements
  if (e.target === overlay || e.target === tooltip || e.target === banner) return;
  currentTarget = e.target;
  positionOverlay(currentTarget);
  positionTooltip(currentTarget, e.clientX, e.clientY);
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    exitSelectionMode(true);
  }
}

// SNAP-004: Click to Select — intercept and store the selected element
function onElementClick(e) {
  if (!selectionActive) return;

  // Intercept the click so it doesn't trigger page navigation / buttons
  e.stopPropagation();
  e.stopImmediatePropagation();
  e.preventDefault();

  // Ignore clicks on our own injected elements (shouldn't happen due to pointer-events:none, but just in case)
  if (e.target === overlay || e.target === tooltip || e.target === banner) return;

  // Store the element that was under the cursor when the user clicked
  selectedElement = currentTarget || e.target;
  console.log('[Project Snapshot] Element selected:', buildLabel(selectedElement), selectedElement);

  // Exit selection mode — overlays are removed, but selectedElement is kept
  exitSelectionMode(false);
}

// SNAP-004: Also intercept mousedown, mouseup, and pointerdown during selection mode
// to prevent unintended interactions (e.g., drag-select, button effects, link activation)
function onSuppressEvent(e) {
  if (!selectionActive) return;
  e.stopPropagation();
  e.stopImmediatePropagation();
  e.preventDefault();
}

// ─── Mode lifecycle ───────────────────────────────────────────────────────────

function enterSelectionMode() {
  if (selectionActive) return;
  selectionActive = true;
  selectedElement = null; // Reset any previous selection

  overlay  = createOverlay();
  tooltip  = createTooltip();
  banner   = createBanner();

  // Capture phase (3rd arg true) — fire before page handlers
  document.addEventListener('mousemove',   onMouseMove,     true);
  document.addEventListener('keydown',     onKeyDown,       true);
  document.addEventListener('click',       onElementClick,  true);

  // SNAP-004: Suppress additional events to prevent unintended page interactions
  document.addEventListener('mousedown',   onSuppressEvent, true);
  document.addEventListener('mouseup',     onSuppressEvent, true);
  document.addEventListener('pointerdown', onSuppressEvent, true);
  document.addEventListener('pointerup',   onSuppressEvent, true);
  document.addEventListener('auxclick',    onSuppressEvent, true); // middle clicks, etc.
  document.addEventListener('contextmenu', onSuppressEvent, true); // right-click menu
  document.addEventListener('dblclick',    onSuppressEvent, true); // double clicks

  console.log('[Project Snapshot] Selection mode ACTIVE.');
}

function exitSelectionMode(cancelled) {
  if (!selectionActive) return;
  selectionActive = false;

  // Remove all event listeners
  document.removeEventListener('mousemove',   onMouseMove,     true);
  document.removeEventListener('keydown',     onKeyDown,       true);
  document.removeEventListener('click',       onElementClick,  true);
  document.removeEventListener('mousedown',   onSuppressEvent, true);
  document.removeEventListener('mouseup',     onSuppressEvent, true);
  document.removeEventListener('pointerdown', onSuppressEvent, true);
  document.removeEventListener('pointerup',   onSuppressEvent, true);
  document.removeEventListener('auxclick',    onSuppressEvent, true);
  document.removeEventListener('contextmenu', onSuppressEvent, true);
  document.removeEventListener('dblclick',    onSuppressEvent, true);

  // Clean up all injected DOM elements
  [overlay, tooltip, banner].forEach(el => el && el.remove());
  overlay = null;
  tooltip = null;
  banner  = null;
  currentTarget = null;

  if (cancelled) {
    selectedElement = null; // Clear on cancel — no element was intentionally selected
    console.log('[Project Snapshot] Selection mode CANCELLED.');
  } else {
    console.log('[Project Snapshot] Selection mode COMPLETE — element stored:', selectedElement);
    // TODO (SNAP-005): Trigger the rendering pipeline with selectedElement
  }
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENTER_SELECTION_MODE') {
    enterSelectionMode();
    sendResponse({ success: true });
  }
});
