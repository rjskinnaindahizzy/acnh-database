
const { test, expect } = require('@playwright/test');

test('Wrap Text button should toggle text wrapping', async ({ page }) => {
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
          { properties: { title: 'Wrap Test Sheet' } }
        ]
      })
    });
  });

  // Mock Sheet Data
  await page.route('**/spreadsheets/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/values/Wrap%20Test%20Sheet!A%3AZZ?**', async route => {
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
  await expect(page.locator('#sheetSelect')).not.toBeDisabled();

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Wrap Test Sheet');

  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Check if Wrap Text button exists
  const wrapTextBtn = page.locator('#wrapTextBtn');
  await expect(wrapTextBtn).toBeVisible();
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'false');

  // Verify initial state (no wrap)
  const table = page.locator('#dataTable');
  await expect(table).not.toHaveClass(/wrap-text/);

  // Click the button
  await wrapTextBtn.click();

  // Verify new state (wrap enabled)
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveClass(/wrap-text/);

  // Reload the page
  await page.reload();

  // Wait for sheet select to be populated (re-mocked data will load)
  await expect(page.locator('#sheetSelect')).not.toBeDisabled();
  // Select sheet again to see the table
  await page.selectOption('#sheetSelect', 'Wrap Test Sheet');
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify state persists
  const reloadedWrapBtn = page.locator('#wrapTextBtn');
  const reloadedTable = page.locator('#dataTable');

  await expect(reloadedWrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(reloadedTable).toHaveClass(/wrap-text/);
});
