
const { test, expect } = require('@playwright/test');

test('Clear Search & Filters button should restore focus to search input', async ({ page }) => {
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
          ['Name', 'Type'], // Header
          ['Item 1', 'Furniture'],
          ['Item 2', 'Clothing']
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

  // Perform a search that yields no results
  await page.fill('#searchInput', 'NonExistentItem');

  // Wait for "No Results" state
  const clearBtn = page.locator('#clearSearchActionBtn');
  await expect(clearBtn).toBeVisible();

  // Click the "Clear Search & Filters" button
  await clearBtn.click();

  // Check if search input is cleared
  await expect(page.locator('#searchInput')).toHaveValue('');

  // Verify focus is restored to search input
  await expect(page.locator('#searchInput')).toBeFocused();
});
