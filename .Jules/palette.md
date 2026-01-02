## 2024-05-22 - Toast Notifications
**Learning:** Users often miss inline status messages that disappear or are located away from their focal point. Toast notifications provide a consistent, noticeable, yet non-intrusive way to provide feedback for actions like saving settings or errors.
**Action:** Implement a reusable `showToast` function for all future feedback interactions.

## 2026-01-02 - Keyboard Accessible Tables
**Learning:** Sortable table headers that are only clickable exclude keyboard users and screen reader users. Adding `tabindex="0"`, `aria-sort`, and keyboard event listeners (Enter/Space) makes data exploration accessible to everyone.
**Action:** Ensure all interactive table headers include keyboard support and proper ARIA attributes.
