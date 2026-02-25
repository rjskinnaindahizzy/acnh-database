
const { test, expect } = require('@playwright/test');

test('Wrap text button should toggle text wrapping and persist', async ({ page }) => {
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
          ['Item 1', 'Very long description that should wrap when the button is clicked']
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

  // Verify button exists
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible();

  // Verify default state (not pressed, no wrap class)
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);

  // Click wrap button
  await wrapBtn.click();

  // Verify toggled state (pressed, wrap class)
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);

  // Verify persistence
  await page.reload();

  // Wait for sheet select to be populated (auto-selected)
  await expect(sheetSelect).not.toBeDisabled();
  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify persistent state
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);

  // Click again to unwrap
  await wrapBtn.click();
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);
});
