const { test, expect } = require('@playwright/test');

test('Wrap Text button toggles text wrapping state and persists in local storage', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.evaluate("localStorage.setItem('googleSheetsApiKey', 'dummy_key')");

    // Mock API
    await page.route('**/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4?key=*', async route => {
        const json = { sheets: [{ properties: { title: 'Housewares' } }] };
        await route.fulfill({ json });
    });

    await page.route('**/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/values/*?key=*', async route => {
        const json = {
            values: [
                ['Name', 'Buy', 'Sell', 'Source'],
                ['A very long item name that should be wrapped', '100', '25', 'Nook Inc.'],
            ]
        };
        await route.fulfill({ json });
    });

    await page.reload();

    const sheetSelect = page.locator('#sheetSelect');
    await expect(sheetSelect).not.toBeDisabled();
    await sheetSelect.selectOption('Housewares');

    const wrapBtn = page.locator('#wrapTextBtn');
    await expect(wrapBtn).toBeVisible();
    await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');

    const dataTable = page.locator('#dataTable');
    await expect(dataTable).not.toHaveClass(/wrap-text/);

    // Toggle on
    await wrapBtn.click();
    await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(dataTable).toHaveClass(/wrap-text/);

    const localStorageWrapText = await page.evaluate(() => localStorage.getItem('acnh_wrap_text'));
    expect(localStorageWrapText).toBe('true');

    // Reload and check persistence
    await page.reload();
    await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(dataTable).toHaveClass(/wrap-text/);

    // Toggle off
    await wrapBtn.click();
    await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(dataTable).not.toHaveClass(/wrap-text/);
});
