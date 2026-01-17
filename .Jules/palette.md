## 2026-01-15 - [API Key Toggle Visibility]
**Learning:** Users hesitate to paste sensitive keys into fields they can't verify visually. A simple "Show/Hide" toggle builds trust and reduces errors.
**Action:** Always include a visibility toggle for password/API key fields, using accessible ARIA labels to indicate state changes.

## 2026-01-20 - [Back to Top Focus Management]
**Learning:** When using a "Back to Top" button, visual scrolling isn't enough for keyboard users. Focus must be programmatically moved to the top content (e.g., search input) to ensure logical navigation flow.
**Action:** Always couple `window.scrollTo(0,0)` with `element.focus()` on the target container or primary input.
