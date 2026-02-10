const { test, expect } = require('@playwright/test');

test.describe('Wrap Text Feature', () => {
    test.beforeEach(async ({ page }) => {
        // Mock the spreadsheet API response for sheet list
        await page.route(/spreadsheets\/.*\/values\/.*Title.*/, async route => route.continue());

        // Mock the sheet list (metadata)
        await page.route(/spreadsheets\/[^\/]+\?key=/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    sheets: [
                        { properties: { title: 'TestSheet' } }
                    ]
                })
            });
        });

        // Mock the sheet data values
        await page.route(/spreadsheets\/.*\/values\/.*TestSheet.*A.*ZZ.*/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    values: [
                        ['Name', 'Description', 'Sheet'],
                        ['Long Item', 'This is a very long description that should be wrapped when the toggle is active.', 'TestSheet']
                    ]
                })
            });
        });

        // Set API key to bypass prompt
        await page.addInitScript(() => {
            localStorage.setItem('googleSheetsApiKey', 'dummy-key');
        });

        await page.goto('http://localhost:8000');

        // clear storage for clean state
        await page.evaluate(() => localStorage.removeItem('acnh_wrap_text'));
    });

    test('should allow toggling text wrap', async ({ page }) => {
        // Verify button is initially hidden (or not present if not added yet)
        const wrapBtn = page.locator('#wrapTextBtn');

        // Note: Before implementation, this test will fail because button doesn't exist.
        // After implementation, it should be hidden initially.
        // We will assert visibility after sheet load.

        // Select the sheet
        const sheetSelect = page.locator('#sheetSelect');
        await expect(sheetSelect).toBeEnabled();
        await sheetSelect.selectOption('TestSheet');

        // Wait for data to load
        await expect(page.locator('#dataTable')).toBeVisible();

        // Now button should be visible
        await expect(wrapBtn).toBeVisible();

        // Initial state
        await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('#dataTable')).not.toHaveClass(/wrap-text/);

        // Click to toggle
        await wrapBtn.click();

        // Active state
        await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);

        // Reload to test persistence
        await page.reload();

        // Wait for auto-load (app restores last sheet)
        await expect(page.locator('#dataTable')).toBeVisible();

        // Persisted state
        await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#dataTable')).toHaveClass(/wrap-text/);
    });
});
