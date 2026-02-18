const { test, expect } = require('@playwright/test');

test('Wrap Text button should toggle class and persist across reloads', async ({ page }) => {
  // Mock API Key
  await page.addInitScript(() => {
    if (!localStorage.getItem('googleSheetsApiKey')) {
        localStorage.setItem('googleSheetsApiKey', 'mock-key');
    }
  });

  // Mock Sheet Metadata - Updated URL pattern to match what might be called
  await page.route('**/spreadsheets/**?key=mock-key', async route => {
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

  // Mock Sheet Data - Updated URL pattern to include valueRenderOption
  await page.route('**/spreadsheets/**/values/**?key=mock-key&valueRenderOption=FORMULA', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        values: [
          ['Name', 'Description'],
          ['Item 1', 'A very long description that should wrap when the button is clicked.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Wait for sheet select to be populated
  const sheetSelect = page.locator('#sheetSelect');
  await expect(sheetSelect).not.toBeDisabled();

  // Select the sheet
  await sheetSelect.selectOption('Test Sheet');

  // Wait for results
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Locate the Wrap Text button
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible();

  // Initial state check
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);

  // Click to toggle on
  await wrapBtn.click();
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);

  // Check localStorage
  const storedValue = await page.evaluate(() => localStorage.getItem('acnh_wrap_text'));
  expect(storedValue).toBe('true');

  // Reload page
  await page.reload();

  // Wait for sheet select to be populated
  await expect(sheetSelect).not.toBeDisabled();

  // Wait for results (sheet selection persists)
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify persistence
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);
});
