
const { test, expect } = require('@playwright/test');

test('Selected sheet should persist across page reloads', async ({ page }) => {
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
          { properties: { title: 'Persistence Test Sheet' } },
          { properties: { title: 'Another Sheet' } }
        ]
      })
    });
  });

  // Mock Sheet Data
  await page.route('**/spreadsheets/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/values/Persistence%20Test%20Sheet!A%3AZZ?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        values: [
          ['Name', 'Type'], // Header
          ['Item 1', 'Furniture']
        ]
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Wait for initial load
  const sheetSelect = page.locator('#sheetSelect');
  await expect(sheetSelect).not.toBeDisabled();

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Persistence Test Sheet');

  // Wait for results to be visible (implies data loaded)
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Reload the page
  await page.reload();

  // Wait for sheet select to be populated and (hopefully) auto-selected
  // We need to wait for the "Loading..." state to disappear
  await expect(sheetSelect).not.toBeDisabled();

  // Check if the value is restored
  await expect(sheetSelect).toHaveValue('Persistence Test Sheet');

  // Verify that results section is visible again (meaning change event fired and data loaded)
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify "No Sheet Selected" empty state is NOT visible
  await expect(page.locator('.empty-state.noSheet')).not.toBeVisible();
});
