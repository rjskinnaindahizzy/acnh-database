import { test, expect } from '@playwright/test';

test('Wrap Text toggle functionality', async ({ page }) => {
  // Mock Google Sheets API responses
  await page.route('**/spreadsheets/*', async route => {
    const url = route.request().url();
    console.log('Request:', url);

    if (url.includes('/values/')) {
      console.log('Serving values mock');
      // Mock sheet data
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          values: [
            ['Name', 'Description'],
            ['Item 1', 'Short desc'],
            ['Item 2', 'A very long description that should be wrapped when the toggle is active to ensure readability for all users.']
          ]
        })
      });
    } else {
      console.log('Serving sheets mock');
      // Mock sheet list
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sheets: [
            { properties: { title: 'Test Sheet' } }
          ]
        })
      });
    }
  });

  // Inject API key to bypass setup
  await page.addInitScript(() => {
    localStorage.setItem('googleSheetsApiKey', 'dummy-key');
  });

  await page.goto('http://localhost:8000');

  // Wait for sheet selector to be populated
  await expect(page.locator('#sheetSelect option').nth(1)).toHaveText('Test Sheet');

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Check if button exists and is visible (filters should be shown)
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible({ timeout: 5000 });
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');

  // Check initial table class (even if hidden)
  const table = page.locator('#dataTable');
  await expect(table).not.toHaveClass(/wrap-text/);

  // Click button
  await wrapBtn.click();

  // Verify class toggled
  await expect(table).toHaveClass(/wrap-text/);
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');

  // Verify persistence
  await page.reload();

  // Wait for initialization
  await expect(page.locator('#sheetSelect')).toBeVisible();

  // Check if persistence applied (button might be hidden but class should be on table)
  // Table exists in HTML so class should be applied by initializeWrapText
  await expect(table).toHaveClass(/wrap-text/);

  // Select sheet again to see button
  await page.selectOption('#sheetSelect', 'Test Sheet');
  await expect(wrapBtn).toBeVisible();
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
});
