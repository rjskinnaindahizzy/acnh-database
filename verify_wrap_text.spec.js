
const { test, expect } = require('@playwright/test');

test('Text wrapping toggle should work and persist', async ({ page }) => {
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
          ['Item 1', 'This is a very long description that should be wrapped when the toggle is active.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select the sheet
  const sheetSelect = page.locator('#sheetSelect');
  await expect(sheetSelect).not.toBeDisabled();
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Locate the wrap text button
  const wrapTextBtn = page.locator('#wrapTextBtn');
  await expect(wrapTextBtn).toBeVisible();

  // Initial state: not pressed, no wrap class
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);

  // Click to toggle ON
  await wrapTextBtn.click();

  // Verify state: pressed, wrap class added
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);

  // Verify persistence
  await page.reload();

  // Wait for sheet to load (auto-selected from persistence test logic, but we might need to wait)
  // Re-select if needed or just wait. The app auto-loads last sheet.
  await expect(sheetSelect).not.toBeDisabled();
  // Wait for data table to be present
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Check if button state is restored
  const reloadedBtn = page.locator('#wrapTextBtn');
  await expect(reloadedBtn).toBeVisible();
  await expect(reloadedBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);

  // Click to toggle OFF
  await reloadedBtn.click();
  await expect(reloadedBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);
});
