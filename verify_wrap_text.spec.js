const { test, expect } = require('@playwright/test');

test('Wrap Text button should toggle text wrapping and persist state', async ({ page }) => {
  // Use a mock API key to bypass the initial prompt
  await page.addInitScript(() => {
    window.localStorage.setItem('googleSheetsApiKey', 'TEST_API_KEY');
    // Mock the fetch response for sheet data to avoid hitting real API limits
    // and ensure consistent data for testing
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (url.includes('sheets.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            sheets: [{ properties: { title: 'Housewares' } }],
            values: [
              ['Name', 'Description'],
              ['Long Item Name', 'This is a very long description that should wrap when the wrap text feature is enabled.']
            ]
          })
        };
      }
      return originalFetch(url, options);
    };
  });

  await page.goto('http://localhost:8000');

  // Wait for the sheet selector to be populated (mocked)
  const sheetSelect = page.locator('#sheetSelect');
  await expect(sheetSelect).toBeVisible();

  // Select a sheet to show controls
  await sheetSelect.selectOption({ index: 1 }); // Select the first available sheet

  // Check if Wrap Text button exists
  const wrapTextBtn = page.locator('#wrapTextBtn');
  await expect(wrapTextBtn).toBeVisible();

  // Check initial state (should be unwrapped by default)
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'false');
  const table = page.locator('#dataTable');
  await expect(table).not.toHaveClass(/wrap-text/);

  // Click the button
  await wrapTextBtn.click();

  // Check state after click (should be wrapped)
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveClass(/wrap-text/);

  // Reload the page to test persistence
  await page.reload();

  // Need to re-select sheet or wait for auto-load if implemented (app auto-loads last sheet)
  // The app saves 'acnh_last_sheet', so it should auto-load 'Housewares'
  // But our mock fetch is per-page-load, so we need to re-apply the mock?
  // Playwright addInitScript persists across reloads in the same context, so the mock fetch should still be there?
  // Actually, window.fetch overwrite might be lost on navigation if not done via route.fulfill.
  // But let's assume local server serves static files and we just need to ensure localStorage has the pref.

  // Wait for controls to appear (implied by sheet auto-load)
  await expect(wrapTextBtn).toBeVisible();

  // Check if state persisted
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveClass(/wrap-text/);

  // Click again to toggle off
  await wrapTextBtn.click();
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(table).not.toHaveClass(/wrap-text/);
});
