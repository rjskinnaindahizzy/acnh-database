
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
          ['Name', 'Description'], // Header
          ['Item 1', 'This is a very long description that should be wrapped when the wrap text feature is enabled.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify Wrap Text button exists
  const wrapTextBtn = page.locator('#wrapTextBtn');
  await expect(wrapTextBtn).toBeVisible({ timeout: 2000 });

  // Verify initial state (not pressed, table not wrapped)
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);

  // Click the button
  await wrapTextBtn.click();

  // Verify new state (pressed, table wrapped)
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);

  // Verify localStorage
  const isWrapped = await page.evaluate(() => localStorage.getItem('acnh_wrap_text'));
  expect(isWrapped).toBe('true');

  // Reload page to test persistence
  await page.reload();

  // Wait for sheet selection (it should be persisted)
  await expect(page.locator('#sheetSelect')).toHaveValue('Test Sheet');

  // Wait for data load
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify persisted state
  await expect(page.locator('#wrapTextBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);

  // Click again to disable
  await page.locator('#wrapTextBtn').click();
  await expect(page.locator('#wrapTextBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);

  const isWrappedFinal = await page.evaluate(() => localStorage.getItem('acnh_wrap_text'));
  expect(isWrappedFinal).toBe('false');
});
