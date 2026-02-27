const { test, expect } = require('@playwright/test');

test('Wrap Text button should toggle text wrapping and persist preference', async ({ page }) => {
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
          ['Name', 'Description'],
          ['Item 1', 'A very long description that should be wrapped when the button is clicked.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select the sheet to load data
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  const wrapTextBtn = page.locator('#wrapTextBtn');
  const table = page.locator('#dataTable');

  // Verify button exists and is initially unpressed
  await expect(wrapTextBtn).toBeVisible();
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(table).not.toHaveClass(/wrap-text/);

  // Click the button to toggle wrapping
  await wrapTextBtn.click();

  // Verify class is added and aria-pressed is updated
  await expect(table).toHaveClass(/wrap-text/);
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');

  // Reload the page to verify persistence
  await page.reload();

  // Re-select sheet if necessary (or rely on persistence if implemented for sheet selection too)
  // The app persists last sheet, so it should auto-load or we might need to wait
  // We'll wait for the sheet select to have the value
  await expect(page.locator('#sheetSelect')).toHaveValue('Test Sheet');

  // Wait for data to load again
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify wrapping is still active
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);
  await expect(page.locator('#wrapTextBtn')).toHaveAttribute('aria-pressed', 'true');
});
