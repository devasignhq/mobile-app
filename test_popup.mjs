import puppeteer from 'puppeteer';

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Listen to console logs
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.error('BROWSER ERROR:', err));

        console.log('Navigating to http://localhost:3000/login/callback?token=abc&refreshToken=def&userId=123');
        await page.goto('http://localhost:3000/login/callback?token=abc&refreshToken=def&userId=123', { waitUntil: 'networkidle0' });

        console.log('Page loaded successfully. Taking screenshot test if needed.');
        console.log('Root content:', await page.content());

        console.log('Navigating to simulate error flow...');
        await page.goto('http://localhost:3000/login/callback?error=test_error', { waitUntil: 'networkidle0' });
        console.log('Root content with error:', await page.content());

        await browser.close();
        console.log('Test completed.');
    } catch (e) {
        console.error('Test script failed:', e);
    }
})();
