
## 2024-05-22 - Column Toggle Accessibility
**Learning:** Interactive popovers (like column toggles) must manage focus and closing behavior to be accessible. Simply toggling `display: none` traps keyboard users and confuses screen readers.
**Action:** Always implement: 1) Focus management (in on open, return on close), 2) Escape key to close, 3) Click outside to close, 4) ARIA labels for icon-only buttons.
