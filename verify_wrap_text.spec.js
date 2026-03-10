const { test, expect } = require('@playwright/test');

test('Wrap Text button toggles class and aria-pressed state', async ({ page }) => {
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
          ['Name', 'Type', 'Description'], // Header
          ['Item 1', 'Furniture', 'This is a very long description that might get truncated.'],
          ['Item 2', 'Clothing', 'Another long description string here.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Wait for initial load
  await expect(page.locator('#sheetSelect')).not.toBeDisabled();

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify wrap text button exists
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible();

  const dataTable = page.locator('#dataTable');

  // Initial state check
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(dataTable).not.toHaveClass(/wrap-text/);

  // Click the wrap text button
  await wrapBtn.click();

  // Verify active state
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(dataTable).toHaveClass(/wrap-text/);

  // Reload page to test persistence
  await page.reload();
  await expect(page.locator('#sheetSelect')).not.toBeDisabled();
  await page.selectOption('#sheetSelect', 'Test Sheet');
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify state persisted
  const wrapBtnReload = page.locator('#wrapTextBtn');
  const dataTableReload = page.locator('#dataTable');

  await expect(wrapBtnReload).toHaveAttribute('aria-pressed', 'true');
  await expect(dataTableReload).toHaveClass(/wrap-text/);

  // Click again to turn off
  await wrapBtnReload.click();
  await expect(wrapBtnReload).toHaveAttribute('aria-pressed', 'false');
  await expect(dataTableReload).not.toHaveClass(/wrap-text/);
});
