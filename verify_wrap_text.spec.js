const { test, expect } = require('@playwright/test');

test('Wrap text button should toggle text wrapping and persist state', async ({ page }) => {
  // Mock API Key
  await page.addInitScript(() => {
    localStorage.setItem('googleSheetsApiKey', 'mock-key');
    window.DEFAULT_API_KEY = 'mock-key';
  });

  // Mock Sheet Metadata
  await page.route('**/spreadsheets/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4?key=mock-key', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sheets: [
          { properties: { title: 'Test Sheet' } }
        ]
      })
    });
  });

  // Mock Sheet Data
  await page.route('**/spreadsheets/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/values/Test%20Sheet!A%3AZZ?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        values: [
          ['Name', 'Description'], // Header
          ['Item 1', 'This is a very long description that should be wrapped when the button is clicked.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Wait for sheet select to be enabled
  const sheetSelect = page.locator('#sheetSelect');
  await expect(sheetSelect).not.toBeDisabled();

  // Select the sheet to load data and show controls
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  // 1. Check if Wrap Text button exists and is visible
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible();

  // 2. Verify initial state (should be off by default)
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  const table = page.locator('#dataTable');
  await expect(table).not.toHaveClass(/wrap-text/);

  // 3. Click the button to toggle ON
  await wrapBtn.click();

  // 4. Verify ON state
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveClass(/wrap-text/);

  // 5. Reload page to verify persistence
  await page.reload();

  // Wait for data to reload (since we mocked persistence of sheet selection, it should auto-load)
  // But wait, our mock for API key is via addInitScript, which persists.
  // The app's `loadApiKeyFromStorage` reads localStorage.
  // The sheet selection persistence is also in localStorage.

  // We need to re-mock the routes after reload? No, page.route persists for the context?
  // Playwright page.route handlers are per-page. Reloading keeps the same page object?
  // Usually yes, but let's be safe. Wait, page.route is per page, reload refreshes the context?
  // "Routes are matched for each request issued by the page."

  // Wait for sheet to be selected again (persistence logic in app)
  await expect(sheetSelect).toHaveValue('Test Sheet');
  await expect(page.locator('#resultsSection')).toBeVisible();

  // 6. Verify state is restored
  // We need to re-locate elements after reload
  const wrapBtnReloaded = page.locator('#wrapTextBtn');
  const tableReloaded = page.locator('#dataTable');

  await expect(wrapBtnReloaded).toBeVisible();
  await expect(wrapBtnReloaded).toHaveAttribute('aria-pressed', 'true');
  await expect(tableReloaded).toHaveClass(/wrap-text/);

  // 7. Click to toggle OFF
  await wrapBtnReloaded.click();
  await expect(wrapBtnReloaded).toHaveAttribute('aria-pressed', 'false');
  await expect(tableReloaded).not.toHaveClass(/wrap-text/);
});
