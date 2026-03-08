const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8000');

  // Press tab multiple times to see focus
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? `${el.tagName}#${el.id || ''}.${el.className || ''}` : 'none';
    });
    console.log(`Focus ${i}: ${focused}`);
  }

  await browser.close();
})();
