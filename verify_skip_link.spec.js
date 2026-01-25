const { test, expect } = require('@playwright/test');

test('Skip to main content link should be accessible and functional', async ({ page }) => {
  // Load the page
  await page.goto('http://localhost:8000');

  // Verify skip link exists
  const skipLink = page.locator('.skip-link');
  await expect(skipLink).toHaveCount(1);
  await expect(skipLink).toHaveText('Skip to main content');
  await expect(skipLink).toHaveAttribute('href', '#main-content');

  // Verify it is hidden initially (top < 0)
  await expect(skipLink).toHaveCSS('top', '-100px');

  // Focus the link (first tab stop usually, or press tab)
  await page.keyboard.press('Tab');

  // Verify it is now visible (top = 0)
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveCSS('top', '0px');

  // Press Enter to activate
  await page.keyboard.press('Enter');

  // Verify focus moved to main content
  const mainContent = page.locator('#main-content');
  await expect(mainContent).toBeFocused();
});
