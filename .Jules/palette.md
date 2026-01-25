## 2026-01-15 - [API Key Toggle Visibility]
**Learning:** Users hesitate to paste sensitive keys into fields they can't verify visually. A simple "Show/Hide" toggle builds trust and reduces errors.
**Action:** Always include a visibility toggle for password/API key fields, using accessible ARIA labels to indicate state changes.

## 2026-01-16 - [Pagination Focus Management]
**Learning:** Re-rendering pagination controls destroys the focused element, sending keyboard focus back to `body`. This breaks the navigation flow for keyboard users.
**Action:** When re-rendering interactive controls like pagination, manually restore focus to the equivalent new element (or a logical fallback like 'Previous' if 'Next' becomes disabled).

## 2026-01-19 - [Button Feedback for Sync Actions]
**Learning:** Even synchronous actions (like client-side CSV export) benefit from "Success" states to confirm user intent and provide closure.
**Action:** Use temporary state changes (icon + text) on buttons to indicate success, then revert, to give clear feedback without blocking interaction.

## 2026-01-20 - [Empty State Context]
**Learning:** Generic "No Results" or "No Sheet Selected" messages leave users guessing. Explicitly stating *what* was searched for (e.g., "No matches for 'xyz'") helps users spot typos and confirms the system worked.
**Action:** Always include the search term and active filters in empty state messages, and provide a direct "Clear Filters" action to recover.

## 2026-01-21 - [Semantic Hygiene for Icons]
**Learning:** Decorative icons in text content (like arrows in buttons) are announced by screen readers (e.g., "Left Arrow Previous"), adding noise.
**Action:** Use `aria-hidden="true"` on decorative icon elements and rely on text or `aria-label` for the semantic meaning.

## 2026-01-22 - [Skip Navigation for Data Apps]
**Learning:** In Single Page Apps with persistent top-level configuration (like API keys and search), keyboard users are forced to tab through utility fields on every page load just to reach the content.
**Action:** Implement a "Skip to Content" link that targets the main data container, especially when the header contains form inputs.
