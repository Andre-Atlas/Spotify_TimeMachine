const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:5173');
  
  // Wait for React to render
  await page.waitForTimeout(2000);
  
  // Check the images in the carousel
  const images = await page.$$eval('img', imgs => imgs.map(img => img.src));
  console.log('Images loaded:', images.length);
  console.log('First 3 images:', images.slice(0, 3));
  
  await browser.close();
})();
