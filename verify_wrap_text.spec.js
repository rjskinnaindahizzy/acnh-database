
const { test, expect } = require('@playwright/test');

test('Wrap Text toggle should change cell styles and persist', async ({ page }) => {
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

  // Mock Sheet Data with long text
  const longText = 'This is a very long text that should be wrapped when the button is clicked. '.repeat(5);
  await page.route('**/spreadsheets/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/values/Wrap%20Test%20Sheet!A%3AZZ?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        values: [
          ['Name'], // Header
          [longText]
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Wrap Test Sheet');

  // Wait for results
  await expect(page.locator('#resultsSection')).toBeVisible();

  // 1. Verify button exists
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible();

  // 2. Verify initial state (Unwrapped)
  const cell = page.locator('#dataTable tbody tr:first-child td:first-child');
  await expect(cell).toBeVisible();

  // Check initial style (white-space should be 'nowrap')
  const initialStyle = await cell.evaluate((el) => window.getComputedStyle(el).whiteSpace);
  expect(initialStyle).toBe('nowrap');

  // 3. Click Wrap Text
  await wrapBtn.click();

  // 4. Verify style changed (white-space should be 'normal')
  const wrappedStyle = await cell.evaluate((el) => window.getComputedStyle(el).whiteSpace);
  expect(wrappedStyle).toBe('normal');

  // Verify button state (aria-pressed)
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');

  // 5. Reload and check persistence
  await page.reload();

  // Wait for results again
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify button is still pressed
  const wrapBtnAfterReload = page.locator('#wrapTextBtn');
  await expect(wrapBtnAfterReload).toBeVisible();
  await expect(wrapBtnAfterReload).toHaveAttribute('aria-pressed', 'true');

  // Verify style is still wrapped
  const cellAfterReload = page.locator('#dataTable tbody tr:first-child td:first-child');
  await expect(cellAfterReload).toBeVisible();
  const persistedStyle = await cellAfterReload.evaluate((el) => window.getComputedStyle(el).whiteSpace);
  expect(persistedStyle).toBe('normal');
});
