
const { test, expect } = require('@playwright/test');

test('Wrap Text button should toggle class and persist preference', async ({ page }) => {
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

  // Wait for initial load
  const sheetSelect = page.locator('#sheetSelect');
  await expect(sheetSelect).not.toBeDisabled();

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Check if Wrap Text button is visible
  const wrapTextBtn = page.locator('#wrapTextBtn');
  await expect(wrapTextBtn).toBeVisible();

  // Initial state: not pressed, table doesn't have class
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'false');
  const dataTable = page.locator('#dataTable');
  await expect(dataTable).not.toHaveClass(/wrap-text/);

  // Click the button
  await wrapTextBtn.click();

  // New state: pressed, table has class
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(dataTable).toHaveClass(/wrap-text/);

  // Verify persistence
  await page.reload();

  // Wait for sheet select (auto-selected logic might run or we select again)
  await expect(sheetSelect).not.toBeDisabled();
  // It should auto-load the last sheet, so wait for results
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Check if Wrap Text button is still visible and state is restored
  await expect(wrapTextBtn).toBeVisible();
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(dataTable).toHaveClass(/wrap-text/);
});
