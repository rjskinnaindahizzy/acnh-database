
const { test, expect } = require('@playwright/test');

test('Wrap Text toggle should work and persist', async ({ page }) => {
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
          ['Item 1', 'A very long description that should probably be wrapped if the user chooses to do so.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select sheet to show controls
  await page.selectOption('#sheetSelect', 'Test Sheet');
  await expect(page.locator('#resultsSection')).toBeVisible();

  const wrapBtn = page.locator('#wrapTextBtn');
  const table = page.locator('#dataTable');

  // Verify initial state
  await expect(wrapBtn).toBeVisible();
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(table).not.toHaveClass(/wrap-text/);

  // Click Toggle
  await wrapBtn.click();

  // Verify Toggled State
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveClass(/wrap-text/);

  // Reload to test persistence
  await page.reload();

  // Wait for sheet to load (auto-selected)
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify Persisted State
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveClass(/wrap-text/);

  // Click again to untoggle
  await wrapBtn.click();
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(table).not.toHaveClass(/wrap-text/);
});
