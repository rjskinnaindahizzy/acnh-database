# Palette's Journal

## 2024-05-22 - Toast Notifications
**Learning:** Users often miss inline status messages that disappear or are located away from their focal point. Toast notifications provide a consistent, noticeable, yet non-intrusive way to provide feedback for actions like saving settings or errors.
**Action:** Implement a reusable `showToast` function for all future feedback interactions.

## 2024-05-22 - Keyboard Sorting
**Learning:** When sorting a table re-renders the DOM, keyboard focus is often lost, confusing screen reader users and keyboard navigators.
**Action:** When implementing sort functionality that rebuilds the DOM, always manually restore focus to the interactive header element that triggered the sort.
