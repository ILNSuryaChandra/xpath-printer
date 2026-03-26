// content.js — Content script for Project Snapshot extension
// Implements SNAP-003: Interactive Element Selector — Hover Highlight
// Implements SNAP-004: Click to Select & Event Interception
// Implements SNAP-005: Rendering Engine — DOM-to-Canvas via html2canvas

console.log('[Project Snapshot] Content script loaded.');

// ─── State ────────────────────────────────────────────────────────────────────
let selectionActive = false;
let currentTarget = null;
let selectedElement = null;  // SNAP-004: Persisted target for the rendering pipeline
let renderedCanvas = null;   // SNAP-005: Canvas output from html2canvas

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

// ─── SNAP-005: Rendering pipeline ────────────────────────────────────────────

function createProcessingOverlay() {
  const container = document.createElement('div');
  container.id = 'snapshot-processing';
  container.style.cssText = [
    'position:fixed',
    'top:0', 'left:0', 'right:0', 'bottom:0',
    'z-index:2147483647',
    'background:rgba(0,0,0,0.55)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'flex-direction:column',
    'gap:16px',
    'backdrop-filter:blur(4px)',
  ].join(';');

  // Spinner
  const spinner = document.createElement('div');
  spinner.style.cssText = [
    'width:48px', 'height:48px',
    'border:4px solid rgba(255,255,255,0.2)',
    'border-top-color:#3b82f6',
    'border-radius:50%',
    'animation:snapshot-spin 0.8s linear infinite',
  ].join(';');

  // keyframes
  const style = document.createElement('style');
  style.textContent = '@keyframes snapshot-spin{to{transform:rotate(360deg)}}';
  container.appendChild(style);

  // Label
  const label = document.createElement('div');
  label.textContent = 'Rendering element…';
  label.style.cssText = [
    'color:#f9fafb',
    'font:500 15px/1.4 "Inter",system-ui,sans-serif',
    'text-shadow:0 1px 4px rgba(0,0,0,0.5)',
  ].join(';');

  container.appendChild(spinner);
  container.appendChild(label);
  document.documentElement.appendChild(container);
  return container;
}

function removeProcessingOverlay() {
  const el = document.getElementById('snapshot-processing');
  if (el) el.remove();
}

function showToast(msg, isError) {
  const toast = document.createElement('div');
  toast.id = 'snapshot-toast';
  toast.textContent = msg;
  toast.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:2147483647',
    `background:${isError ? 'rgba(220,38,38,0.92)' : 'rgba(22,163,74,0.92)'}`,
    'color:#fff',
    'font:500 13px/1.4 "Inter",system-ui,sans-serif',
    'padding:10px 24px',
    'border-radius:8px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.4)',
    'pointer-events:none',
    'transition:opacity 0.4s',
    'opacity:1',
  ].join(';');
  document.documentElement.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 2800);
  setTimeout(() => { toast.remove(); }, 3400);
}

/**
 * Temporarily disable @media print rules so html2canvas sees the screen styles.
 * Returns a restore function.
 */
function neutralizePrintStyles() {
  const disabled = [];
  for (const sheet of document.styleSheets) {
    try {
      for (let i = 0; i < sheet.cssRules.length; i++) {
        const rule = sheet.cssRules[i];
        if (rule instanceof CSSMediaRule && /\bprint\b/.test(rule.conditionText)) {
          // Disable by changing conditionText is not possible via CSSOM,
          // so we delete the rule and store it for restoration.
          disabled.push({ sheet, index: i, text: rule.cssText });
        }
      }
    } catch (_) {
      // Cross-origin stylesheets throw — skip silently
    }
  }
  // Delete in reverse order to preserve indices
  for (let j = disabled.length - 1; j >= 0; j--) {
    disabled[j].sheet.deleteRule(disabled[j].index);
  }
  return function restore() {
    // Re-insert in original order
    for (const entry of disabled) {
      try {
        entry.sheet.insertRule(entry.text, Math.min(entry.index, entry.sheet.cssRules.length));
      } catch (_) { /* ignore */ }
    }
  };
}

async function renderSelectedElement() {
  if (!selectedElement) {
    console.warn('[Project Snapshot] No element selected for rendering.');
    return;
  }

  const processingEl = createProcessingOverlay();

  try {
    // Ensure html2canvas is available (injected by background.js)
    if (typeof html2canvas !== 'function') {
      throw new Error('html2canvas library is not available. Please reload the extension.');
    }

    console.log('[Project Snapshot] Starting html2canvas render…', buildLabel(selectedElement));

    // Neutralize @media print rules before rendering
    const restorePrintStyles = neutralizePrintStyles();

    try {
      renderedCanvas = await html2canvas(selectedElement, {
        scale: 2,               // High-DPI output (retina quality)
        useCORS: true,          // Handle cross-origin images
        allowTaint: false,      // Don't taint the canvas with non-CORS images
        removeContainer: true,  // Clean up temporary clone container
        logging: false,         // Suppress html2canvas console noise
        backgroundColor: null,  // Preserve transparency if element has it
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
    } finally {
      // Always restore print styles, even if html2canvas throws
      restorePrintStyles();
    }

    console.log(
      '[Project Snapshot] Canvas rendered:',
      renderedCanvas.width, 'x', renderedCanvas.height,
      `(${(renderedCanvas.width / 2)}x${(renderedCanvas.height / 2)} CSS px)`
    );

    removeProcessingOverlay();
    showToast('✅ Element captured! Generating PDF…', false);

    // TODO (SNAP-006): Pass renderedCanvas to the PDF export pipeline
    console.log('[Project Snapshot] Canvas ready for PDF export. Size:',
      renderedCanvas.width, 'x', renderedCanvas.height);

  } catch (err) {
    console.error('[Project Snapshot] Rendering error:', err);
    removeProcessingOverlay();
    showToast(`❌ Capture failed: ${err.message}`, true);
    renderedCanvas = null;
  }
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
    // SNAP-005: Trigger the rendering pipeline
    renderSelectedElement();
  }
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENTER_SELECTION_MODE') {
    enterSelectionMode();
    sendResponse({ success: true });
  }
});
