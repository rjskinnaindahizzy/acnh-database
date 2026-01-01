
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Console logs from the browser
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  // Mock the Sheets API responses
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('sheets.googleapis.com')) {
        if (url.includes('/values/')) {
             // Mock for loadSheetData
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    values: [
                    ["Name", "Type", "Cost"],
                    ["Apple", "Fruit", "100"],
                    ["Chair", "Furniture", "200"],
                    ["Banana", "Fruit", "150"]
                    ]
                })
            });
        } else {
             // Mock for loadAvailableSheets
             await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    sheets: [
                    { properties: { title: "TestSheet" } }
                    ]
                })
            });
        }
    } else {
        await route.continue();
    }
  });

  // Navigate to the local server
  await page.goto('http://localhost:8000');

  // Set API Key to bypass the initial screen
  await page.evaluate(() => {
    localStorage.setItem('googleSheetsApiKey', 'mock-key');
    // Reload to apply key
    location.reload();
  });

  await page.waitForTimeout(1000); // Wait for reload

  // Wait for sheet select to be populated (attached to DOM)
  await page.waitForSelector('#sheetSelect option[value="TestSheet"]', { state: 'attached' });

  // Select the sheet
  await page.selectOption('#sheetSelect', 'TestSheet');

  // Wait for table to load
  await page.waitForSelector('#dataTable th');
  console.log('Table loaded.');

  const headers = await page.$$('#dataTable th');

  // Check if the first header is focusable (tabindex="0")
  const firstHeader = headers[0];
  const tabindex = await firstHeader.getAttribute('tabindex');
  const role = await firstHeader.getAttribute('role');

  console.log(`Header 0 tabindex: ${tabindex}`);
  console.log(`Header 0 role: ${role}`);

  if (tabindex === '0' && role === 'button') {
    console.log("Headers are accessible!");
  } else {
    console.log("Headers are NOT accessible yet.");
    process.exit(1);
  }

  // Focus the 3rd header (Cost)
  await page.evaluate(() => {
      const ths = document.querySelectorAll('th');
      if (ths[2]) ths[2].focus();
  });

  // Press Enter (Ascending)
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  // Verify focus is still on Cost header
  const isCostFocused = await page.evaluate(() => {
      const ths = document.querySelectorAll('th');
      return document.activeElement === ths[2];
  });

  if (isCostFocused) {
      console.log('Focus preserved on Cost header after sorting!');
  } else {
      console.log('Focus LOST after sorting!');
      process.exit(1);
  }

  // Press Enter (Descending)
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  // Check first row name, expect "Chair"
  let firstRowName = await page.$eval('#tableBody tr:first-child td:first-child', el => el.textContent);
  console.log(`First row after Enter x2 on Cost: ${firstRowName}`);

  if (firstRowName === 'Chair') {
      console.log('Sorting via keyboard verified!');
  } else {
      console.log('Sorting via keyboard failed.');
      process.exit(1);
  }

  await browser.close();
})();
