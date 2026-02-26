
const { test, expect } = require('@playwright/test');

test('Text wrapping functionality', async ({ page }) => {
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

  // Mock Sheet Data with long text in Name column
  await page.route(/.*spreadsheets\/.*\/values\/Test%20Sheet!A%3AZZ.*/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        values: [
          ['Name'], // Header
          ['This is a very long name that should be truncated by default but wrapped when the toggle is active. It goes on and on and on...'],
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Wait for results
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Wait for at least one row in the table body
  await expect(page.locator('#tableBody tr')).toHaveCount(1);

  // Check default state (truncated)
  const cell = page.locator('#tableBody tr td').first(); // The Name cell
  await expect(cell).toBeVisible();

  // Log the text content to confirm we have the right cell
  const text = await cell.textContent();
  console.log('Cell text:', text);

  await expect(cell).toHaveCSS('white-space', 'nowrap');
  await expect(cell).toHaveCSS('overflow', 'hidden');
  await expect(cell).toHaveCSS('text-overflow', 'ellipsis');

  // Find and click the Wrap Text button (this is expected to fail currently)
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible({ timeout: 2000 });

  await wrapBtn.click();

  // Verify wrapped state
  await expect(cell).toHaveCSS('white-space', 'normal');

  // Verify toggle off
  await wrapBtn.click();
  await expect(cell).toHaveCSS('white-space', 'nowrap');
});
