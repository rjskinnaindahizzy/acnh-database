
const { test, expect } = require('@playwright/test');

test('Wrap Text toggle functionality', async ({ page }) => {
  // Mock API Key so the page loads properly
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
          ['Item 1', 'This is a very long description that should be wrapped when the toggle is active.']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select the sheet to show filters
  await page.selectOption('#sheetSelect', 'Wrap Test Sheet');

  // Wait for data to load
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Check if Wrap Text button exists (it won't initially)
  const wrapBtn = page.locator('#wrapTextBtn');

  // This expectation will fail initially, which is expected
  // await expect(wrapBtn).toBeVisible();

  // If button exists, click it and verify class on table
  await expect(wrapBtn).toBeVisible();
  await wrapBtn.click();
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');

  // Toggle back
  await wrapBtn.click();
  await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');

  // Verify persistence
  await wrapBtn.click(); // Enable it again
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');

  await page.reload();

  // Sheet needs to be reselected or it might be auto-selected by the app logic if localStorage 'acnh_last_sheet' is set
  // The app sets 'acnh_last_sheet' on change.
  // We need to wait for sheet loading
  await expect(page.locator('#sheetSelect')).not.toBeDisabled();

  // Wait for button to be visible again (it shows after sheet load)
  // Since we mocked data, we should expect it to load if the app auto-selects.
  // But let's check if we need to select it again.
  // The app logic:
  /*
        const lastSheet = localStorage.getItem('acnh_last_sheet');
        if (lastSheet && availableSheets.includes(lastSheet)) {
            sheetSelect.value = lastSheet;
            sheetSelect.dispatchEvent(new Event('change'));
        }
  */
  // So it should auto-select.

  await expect(page.locator('#resultsSection')).toBeVisible();
  await expect(wrapBtn).toBeVisible();
  await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
});
