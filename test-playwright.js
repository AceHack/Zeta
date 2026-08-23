const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('Navigating to http://localhost:5177/');
  await page.goto('http://localhost:5177/');
  
  console.log('Waiting for 5 seconds for simulation to run...');
  await page.waitForTimeout(5000);
  
  await browser.close();
})();
