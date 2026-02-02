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

## 2026-01-22 - [Async Button Feedback States]
**Learning:** Async actions (like Refresh) need a dedicated "Success" state to confirm completion, but placing this logic in a `finally` block causes false positives on error.
**Action:** Use a success flag to conditionalize the "Success" animation in the `finally` block, ensuring users only see green checks when the action actually succeeds.
## 2026-01-22 - [State Persistence]
**Learning:** Users appreciate when the application remembers their context (like selected sheet) after a reload. It reduces friction and makes the app feel smarter.
**Action:** Use `localStorage` to persist transient user state (filters, selections) where appropriate, always validating the restored value against current available options.

## 2026-01-27 - [Skip Link Implementation]
**Learning:** Adding a "Skip to Content" link requires ensuring the target container is programmatically focusable using `tabindex="-1"`. Without this, the browser scrolls but focus remains on the link, forcing the user to tab through everything again.
**Action:** Always wrap main content in a `<main id="main-content" tabindex="-1">` container when implementing skip links.

## 2026-02-12 - [Focus Restoration on Destructive Actions]
**Learning:** When an interactive element (like a "Clear Search" button) is removed from the DOM upon activation, keyboard focus is lost to the body, disrupting the user's flow.
**Action:** Always programmaticallly move focus to a logical "next step" element (e.g., the search input) immediately after the triggering element is removed.
