
const { test, expect } = require('@playwright/test');

test('Export button should be visible and functional even for small datasets', async ({ page }) => {
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

  // Mock Sheet Data (Small dataset < 50 rows)
  await page.route('**/spreadsheets/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/values/Test%20Sheet!A%3AZZ?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        values: [
          ['Name', 'Type', 'Price'], // Header
          ['Item 1', 'Furniture', '100'],
          ['Item 2', 'Clothing', '200'],
          ['Item 3', 'Tool', '500']
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

  // Check if Export button exists and is visible
  const exportBtn = page.locator('.export-btn');
  await expect(exportBtn).toBeVisible({ timeout: 2000 });
  await expect(exportBtn).toHaveText('📥 Export CSV');

  // Verify click functionality and toast
  // We need to handle the download to prevent the test from stalling/failing on download prompt
  const downloadPromise = page.waitForEvent('download');

  await exportBtn.click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('acnh_Test_Sheet');

  // Verify toast appears
  const toast = page.locator('.toast.success');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Exported 3 items successfully');
});
