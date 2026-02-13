
const { test, expect } = require('@playwright/test');

test('Wrap Text button should be visible and functional', async ({ page }) => {
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
          { properties: { title: 'Housewares' } }
        ]
      })
    });
  });

  // Mock Sheet Data
  // Use Housewares sheet to get more columns in default preset (specifically 'Tag')
  await page.route(/.*\/values\/.*Housewares.*/, async route => {
    console.log('Intercepted sheet data request: ' + route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        values: [
          ['Name', 'Tag'], // Headers
          ['Item 1', 'This is a very long description that should be wrapped when the button is clicked.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Housewares');

  // Wait for results to be visible
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Check if Wrap Text button exists and is visible
  const wrapTextBtn = page.locator('#wrapTextBtn');
  await expect(wrapTextBtn).toBeVisible();
  await expect(wrapTextBtn).toHaveText(/Wrap Text/);
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'false');

  // Verify initial state (nowrap)
  // The second column (Tag) contains the long text.
  const cell = page.locator('#dataTable td').nth(1);
  await expect(cell).toBeVisible();
  // Ensure it's the correct cell
  await expect(cell).toHaveText(/very long description/);

  await expect(cell).toHaveCSS('white-space', 'nowrap');

  // Click the button
  await wrapTextBtn.click();

  // Verify updated state
  await expect(wrapTextBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);
  await expect(cell).toHaveCSS('white-space', 'normal');

  // Verify persistence
  await page.reload();

  // Wait for sheet to load (it might take a moment due to mock)
  await expect(page.locator('#sheetSelect')).toHaveValue('Housewares');

  // Wait for results again
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Check if wrap text preference is restored
  await expect(page.locator('#wrapTextBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);
  await expect(page.locator('#dataTable td').nth(1)).toHaveCSS('white-space', 'normal');
});
