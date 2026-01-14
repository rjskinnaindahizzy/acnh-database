## 2024-05-22 - Column Toggle Accessibility
**Learning:** Interactive popovers (like column toggles) must manage focus and closing behavior to be accessible. Simply toggling `display: none` traps keyboard users and confuses screen readers.
**Action:** Always implement: 1) Focus management (in on open, return on close), 2) Escape key to close, 3) Click outside to close, 4) ARIA labels for icon-only buttons.

## 2026-01-08 - ARIA State Management
**Learning:** Toggle buttons must explicitly communicate their state via `aria-expanded`. Without this, screen reader users don't know if the connected panel is open or closed, even if focus moves correctly.
**Action:** Ensure all toggle interactions update `aria-expanded` on the trigger element in real-time.

## 2026-01-10 - Visual Keyboard Shortcuts
**Learning:** Embedding keyboard shortcuts in placeholder text (e.g., "Search (Press /)") is often missed by users and disappears when they type. A distinct visual element resembling a key (`<kbd>`) improves discoverability and adds a polished "power user" feel.
**Action:** Use absolute positioning to place `<kbd>` hints inside input wrappers, and hide them via CSS `:focus-within` or `:placeholder-shown` to avoid visual clutter during interaction.

## 2026-01-28 - Decoupling Actions from Pagination
**Learning:** Attaching action buttons (like "Export CSV") to pagination logic can accidentally hide them for small datasets (single page results). Users expect global actions to be available regardless of the result count.
**Action:** Ensure action buttons are rendered independently of pagination condition checks (e.g., `totalPages > 1`), or placed in a persistent toolbar.

## 2026-02-04 - Accessible Toasts
**Learning:** Dynamic notifications (toasts) are invisible to screen readers unless explicitly marked with `role="status"` (for updates) or `role="alert"` (for errors).
**Action:** Always append the appropriate ARIA role to toast elements upon creation.
