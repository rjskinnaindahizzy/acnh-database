
import { test, expect } from '@playwright/test';

test('Wrap Text Toggle works as expected', async ({ page }) => {
  // 1. Go to the page
  await page.goto('http://localhost:8000');

  // Mock the sheet loading
  // Use a more specific regex to ensure we catch the requests
  await page.route(/sheets\.googleapis\.com\/v4\/spreadsheets\/.*\/values\/.*/, async route => {
      console.log('Intercepted values request:', route.request().url());
      const json = {
          values: [
              ['Name', 'Description'],
              ['Item 1', 'This is a very long description that should be wrapped when the toggle is active.'],
              ['Item 2', 'Short desc']
          ]
      };
      await route.fulfill({ json });
  });

  await page.route(/sheets\.googleapis\.com\/v4\/spreadsheets\/[^\/]+(\?.*)?$/, async route => {
      console.log('Intercepted sheets metadata request:', route.request().url());
      const json = {
          sheets: [
              { properties: { title: 'Sheet1' } }
          ]
      };
      await route.fulfill({ json });
  });

  // Reload to apply mocks
  await page.reload();

  const apiKeyInput = page.locator('#apiKeyInput');
  if (await apiKeyInput.isVisible()) {
      await apiKeyInput.fill('dummy-key');
      await page.click('#saveApiKeyBtn');
  }

  // Wait for sheet select to be enabled
  const sheetSelect = page.locator('#sheetSelect');
  await expect(sheetSelect).toBeEnabled();

  // Select a sheet
  await sheetSelect.selectOption({ index: 1 }); // Select first available sheet

  // Check for error state if results don't show up
  try {
      await expect(page.locator('#resultsSection')).toBeVisible({ timeout: 3000 });
  } catch (e) {
      const emptyState = page.locator('#emptyState');
      if (await emptyState.isVisible()) {
          const msg = await page.locator('#emptyStateMessage').textContent();
          console.log('Empty State Message:', msg);
          const title = await page.locator('#emptyStateTitle').textContent();
          console.log('Empty State Title:', title);
      }
      throw e;
  }

  // 3. Verify the Wrap Text button exists
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible();

  // Verify initial state
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  const table = page.locator('#dataTable');
  await expect(table).not.toHaveClass(/wrap-text/);

  // 4. Click the button
  await wrapBtn.click();

  // Verify active state
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveClass(/wrap-text/);

  // 5. Reload page to verify persistence
  await page.reload();

  // Wait for sheet to be selected
  // We need to wait for the app to initialize and select the sheet
  // The app uses localStorage 'acnh_last_sheet', so it should auto-select.
  // We need to ensure mocks are still active (they are per test).

  // It might take a moment for the auto-select to trigger data load
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify state persisted
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveClass(/wrap-text/);

  // 6. Click again to toggle off
  await wrapBtn.click();
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(table).not.toHaveClass(/wrap-text/);
});
