## 1. Executive Summary
**Project Snapshot** is a Chrome extension designed to bypass web-based print restrictions. Many modern platforms (e.g., resume builders like BeamJobs) use CSS media queries and JavaScript to disable standard browser printing or hide content during the print process. This extension allows users to select a specific DOM element and capture it exactly as rendered on-screen, exporting the result to a high-fidelity PDF. The PDF should be editable.

## 2. Problem Statement
Users encounter "Print Protection" on specialized web tools. For instance, resume builders often return a blank or white page when the user attempts to print (`Cmd+P`) or "Save as PDF" via the browser, effectively forcing paid downloads even when the content is clearly visible on the screen.

## 3. Goals & Objectives
* **WYSIWYG Fidelity:** Ensure the PDF output is an exact visual replica of the selected screen element.
* **Restriction Neutralization:** Successfully capture elements protected by `@media print { display: none; }` or `user-select: none`.
* **User Empowerment:** Provide a simple, point-and-click interface to extract data that is visually accessible but programmatically restricted.

## 4. Functional Requirements

### 4.1. The Selection Engine
* **Interactive Selector:** When activated, the extension enters a "selection mode" where hovering over page elements highlights them with a blue semi-transparent overlay.
* **DOM Traversal:** Users can select nested containers to isolate specific parts of a page (like a single resume container).
* **Event Interception:** While in selection mode, clicks are intercepted to prevent navigating away or triggering page buttons.

### 4.2. The Rendering Engine (Core Logic)
* **Visual Snapshot:** Use a library to read current computed styles and render the element to a canvas. 
* **Bypass Mechanism:** Because the rendering happens via DOM-to-Canvas translation, it ignores CSS rules intended only for the print medium.
* **Resolution Control:** Support a 2x scale to ensure text in the resulting PDF is crisp and professional.

### 4.3. PDF Export
* **Format:** Convert the generated canvas into a standard PDF.
* **Scaling:** Automatically scale the image to fit A4 page dimensions.
* **Download:** Trigger a browser download with a default filename (e.g., `snapshot_export.pdf`).

## 5. Technical Specifications
* **Platform:** Chrome Extension Manifest V3.
* **Primary Permissions:** `scripting`, `activeTab`.
* **Dependencies:** `html2canvas.js` for rendering, `jspdf.js` for document generation.
* **Cross-Origin Handling:** Enable `useCORS` settings to handle images or assets hosted on external CDNs.

## 6. User Flow
1.  **Activate:** User clicks the extension icon in the toolbar.
2.  **Select:** User hovers over the resume/element and clicks.
3.  **Process:** The extension processes the DOM and generates the PDF in the background.
4.  **Complete:** The browser prompts the user to save the PDF.

## 7. Success Metrics
* **Capture Accuracy:** The PDF layout matches the on-screen element layout 100%.
* **Print-Bypass:** 100% success rate on known "print-blocked" sites where standard browser printing fails.

## 8. Risk Assessment
* **Very Large Elements:** Elements spanning multiple screen heights may require high memory. 
* **Dynamic Overlays:** Sticky headers or floating "Chat with us" bubbles might be captured if they overlap the selection. *Future Mitigation: Add a "Hide Element" tool before capturing.*