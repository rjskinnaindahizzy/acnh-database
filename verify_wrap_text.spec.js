const { test, expect } = require('@playwright/test');

test('Wrap Text button functionality', async ({ page }) => {
    // Mock API Key
    await page.addInitScript(() => {
        localStorage.setItem('googleSheetsApiKey', 'mock-key');
        window.DEFAULT_API_KEY = 'mock-key';
    });

    // Mock Sheet Metadata
    await page.route('**/spreadsheets/**?key=mock-key', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                sheets: [
                    { properties: { title: 'Housewares' } }
                ]
            })
        });
    });

    // Mock Sheet Data
    await page.route('**/spreadsheets/**/values/**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                values: [
                    ['Name', 'Description'], // Header
                    ['Item 1', 'A very long description that should wrap when the button is clicked.']
                ]
            })
        });
    });

    // Go to the page
    await page.goto('http://localhost:8000');

    // Wait for the sheet dropdown to be populated
    const sheetSelect = page.locator('#sheetSelect');
    await expect(sheetSelect).not.toBeDisabled({ timeout: 10000 });

    // Select a sheet to load data
    await sheetSelect.selectOption({ label: 'Housewares' });

    // Wait for the "Wrap Text" button to be visible
    // Note: It might not exist yet, so we use locator and expect visible
    const wrapBtn = page.locator('#wrapTextBtn');

    // This will fail initially because button doesn't exist
    // But we want to confirm it fails for the right reason (not found)
    // Or we can comment this out and uncomment after implementation.
    // For TDD, let's keep it and expect it to fail.
    await expect(wrapBtn).toBeVisible({ timeout: 5000 });

    // Check initial state (should be false/off by default unless previously saved)
    await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
    const table = page.locator('#dataTable');
    await expect(table).not.toHaveClass(/wrap-text/);

    // Click to toggle on
    await wrapBtn.click();
    await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(table).toHaveClass(/wrap-text/);

    // Reload page to test persistence
    await page.reload();

    // Wait for data to load again (auto-load last sheet)
    // We need to wait for sheet select to be enabled first
    await expect(sheetSelect).not.toBeDisabled({ timeout: 10000 });

    // Wait for button
    await expect(wrapBtn).toBeVisible({ timeout: 10000 });

    // Check if state persisted
    await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(table).toHaveClass(/wrap-text/);

    // Click to toggle off
    await wrapBtn.click();
    await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(table).not.toHaveClass(/wrap-text/);
});
