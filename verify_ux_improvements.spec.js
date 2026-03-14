
const { test, expect } = require('@playwright/test');

test.describe('UX Improvements', () => {
  test.beforeEach(async ({ page }) => {
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
            ['Item 1', 'A very long description that might be truncated'],
            ['Item 2', 'Short desc']
          ]
        })
      });
    });

    await page.goto('http://localhost:8000');
    // Wait for sheet select and select a sheet to load data
    await expect(page.locator('#sheetSelect')).not.toBeDisabled();
    await page.selectOption('#sheetSelect', 'Test Sheet');
    await expect(page.locator('#resultsSection')).toBeVisible();
  });

  test('Focus should return to search input after clicking "Clear Search & Filters"', async ({ page }) => {
    // 1. Search for something that yields no results
    await page.fill('#searchInput', 'NonExistentTerm');

    // 2. Wait for "No Results" empty state
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('#emptyStateTitle')).toContainText('No Items Found');

    // 3. Click the "Clear Search & Filters" button
    const clearBtn = page.locator('#clearSearchActionBtn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // 4. Verify focus is on search input
    await expect(page.locator('#searchInput')).toBeFocused();
  });

  test('Table cells should have informative tooltip with full content', async ({ page }) => {
    // 1. Get a cell with content
    const cell = page.locator('td').first();
    const content = 'Item 1'; // First cell of first row

    // 2. Check title attribute
    // Current behavior: 'Click to expand'
    // Desired behavior: 'Item 1 (Click to expand)'
    await expect(cell).toHaveAttribute('title', `${content} (Click to expand)`);
  });
});
