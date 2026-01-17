## 2026-01-15 - [API Key Toggle Visibility]
**Learning:** Users hesitate to paste sensitive keys into fields they can't verify visually. A simple "Show/Hide" toggle builds trust and reduces errors.
**Action:** Always include a visibility toggle for password/API key fields, using accessible ARIA labels to indicate state changes.

## 2026-01-16 - [Pagination Focus Management]
**Learning:** Re-rendering pagination controls destroys the focused element, sending keyboard focus back to `body`. This breaks the navigation flow for keyboard users.
**Action:** When re-rendering interactive controls like pagination, manually restore focus to the equivalent new element (or a logical fallback like 'Previous' if 'Next' becomes disabled).
