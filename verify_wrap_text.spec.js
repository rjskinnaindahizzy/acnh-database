const { test, expect } = require('@playwright/test');

test('Wrap Text toggle works and persists', async ({ page }) => {
  // Go to page
  await page.goto('http://localhost:8000/');

  // Check if button exists
  const wrapBtn = page.locator('#wrapTextBtn');
  await expect(wrapBtn).toBeVisible();

  // Verify initial state
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false');
  const table = page.locator('#dataTable');
  await expect(table).not.toHaveClass(/wrap-text/);

  // Click toggle
  await wrapBtn.click();

  // Verify class added and button state changed
  await expect(table).toHaveClass(/wrap-text/);
  await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(wrapBtn).toHaveClass(/active/);

  // Reload page
  await page.reload();

  // Verify state persists
  const wrapBtnAfterReload = page.locator('#wrapTextBtn');
  const tableAfterReload = page.locator('#dataTable');

  await expect(wrapBtnAfterReload).toHaveAttribute('aria-pressed', 'true');
  await expect(wrapBtnAfterReload).toHaveClass(/active/);
  await expect(tableAfterReload).toHaveClass(/wrap-text/);

  // Click again to disable
  await wrapBtnAfterReload.click();

  // Verify class removed
  await expect(tableAfterReload).not.toHaveClass(/wrap-text/);
  await expect(wrapBtnAfterReload).toHaveAttribute('aria-pressed', 'false');
  await expect(wrapBtnAfterReload).not.toHaveClass(/active/);
});
