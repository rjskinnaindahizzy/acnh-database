const { test, expect } = require('@playwright/test');

test('Pagination should scroll to top of results', async ({ page }) => {
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

  // Generate 100 rows of data to ensure 2 full pages of 50
  const rows = [['Name', 'Value']];
  for (let i = 1; i <= 100; i++) {
    rows.push([`Item ${i}`, `Value ${i}`]);
  }

  // Mock Sheet Data
  await page.route('**/spreadsheets/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/values/Test%20Sheet!A%3AZZ?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        values: rows
      })
    });
  });

  // Load the page
  await page.goto('http://localhost:8000');

  // Select the sheet
  await page.selectOption('#sheetSelect', 'Test Sheet');

  // Wait for results
  await expect(page.locator('#resultsSection')).toBeVisible();

  // Verify pagination exists
  const nextBtn = page.getByLabel('Go to next page');
  await expect(nextBtn).toBeVisible();

  // Scroll to bottom of Page 1
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // Wait a bit
  await page.waitForTimeout(500);

  // Get current scroll position (should be high)
  const scrollBefore = await page.evaluate(() => window.scrollY);
  console.log('Scroll before:', scrollBefore);

  expect(scrollBefore).toBeGreaterThan(500);

  // Take screenshot before
  try {
      await page.screenshot({ path: '/home/jules/verification/pagination_before_next.png' });
  } catch (e) {
      await page.screenshot({ path: 'pagination_before_next.png' });
  }

  // Click Next to go to Page 2 (which is also long)
  await nextBtn.click();

  // Wait for scroll animation/behavior
  await page.waitForTimeout(2000);

  // Get scroll position after
  const scrollAfter = await page.evaluate(() => window.scrollY);
  console.log('Scroll after:', scrollAfter);

  try {
      await page.screenshot({ path: '/home/jules/verification/pagination_after_next.png' });
  } catch (e) {
       await page.screenshot({ path: 'pagination_after_next.png' });
  }

  // With 100 items (50 per page), both pages are long.
  // The browser should maintain scroll position if we don't force it up.
  // So scrollAfter should be high (close to scrollBefore).
  // If we fix it, scrollAfter should be low (< 500).

  expect(scrollAfter).toBeLessThan(500);
});
