// content.js — Content script for Project Snapshot extension
// Implements SNAP-003: Interactive Element Selector — Hover Highlight
// Implements SNAP-004: Click to Select & Event Interception

console.log('[Project Snapshot] Content script loaded.');

// ─── State ────────────────────────────────────────────────────────────────────
let selectionActive = false;
let currentTarget = null;

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

// Exposed globally so SNAP-004 can attach a click handler on top
function onElementClick(e) {
  e.stopPropagation();
  e.preventDefault();
  // SNAP-004 extends this; base implementation just exits
  exitSelectionMode(false);
}

// ─── Mode lifecycle ───────────────────────────────────────────────────────────

function enterSelectionMode() {
  if (selectionActive) return;
  selectionActive = true;

  overlay  = createOverlay();
  tooltip  = createTooltip();
  banner   = createBanner();

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('keydown',   onKeyDown,   true);
  document.addEventListener('click',     onElementClick, true);

  console.log('[Project Snapshot] Selection mode ACTIVE.');
}

function exitSelectionMode(cancelled) {
  if (!selectionActive) return;
  selectionActive = false;

  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('keydown',   onKeyDown,   true);
  document.removeEventListener('click',     onElementClick, true);

  // Clean up all injected DOM elements
  [overlay, tooltip, banner].forEach(el => el && el.remove());
  overlay = null;
  tooltip = null;
  banner  = null;

  if (cancelled) {
    console.log('[Project Snapshot] Selection mode CANCELLED.');
  } else {
    console.log('[Project Snapshot] Element selected:', currentTarget);
  }
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENTER_SELECTION_MODE') {
    enterSelectionMode();
    sendResponse({ success: true });
  }
});
