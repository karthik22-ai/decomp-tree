import puppeteer from 'puppeteer';

(async () => {
    console.log("Starting browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set up console listener
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    console.log("Navigating to http://localhost:5174...");
    await page.goto('http://localhost:5174');
    
    console.log("Waiting for app to load...");
    try {
        await page.waitForFunction(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Create Blank Project'));
            return !!btn;
        }, { timeout: 10000 });
    } catch (e) {
        console.log("Timeout waiting for Create Blank Project. Page content:");
        const content = await page.content();
        console.log(content.substring(0, 1000));
        await browser.close();
        return;
    }
    
    // Click Create Blank Project
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Create Blank Project'));
        btn.click();
    });
    console.log("Clicked Create Blank Project");
    
    // Wait for input
    await page.waitForSelector('input[placeholder="Project Name..."]');
    await page.type('input[placeholder="Project Name..."]', 'Test Lock Project');
    
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent === 'Create');
        btn.click();
    });
    console.log("Created project");

    await page.waitForSelector('.lucide-plus', { timeout: 10000 });
    
    // Add two rows so we have something to test
    await page.evaluate(() => {
        document.querySelector('.lucide-plus').parentElement.click();
    });
    await page.waitForTimeout(500);

    // Switch to tabular
    console.log("Switching to tabular view...");
    const tabularTab = await page.$('.view-tab:last-child'); // usually the tabular tab
    if (tabularTab) {
        await tabularTab.click();
    } else {
        console.log("Could not find tabular tab");
    }
    
    await page.waitForTimeout(2000); // wait for render
    
    // Find lock icon and click it
    console.log("Looking for lock icon...");
    try {
        const lockIcon = await page.$('.lucide-unlock');
        if (lockIcon) {
            console.log("Found unlock icon, clicking...");
            await page.evaluate(() => {
                document.querySelector('.lucide-unlock').parentElement.click();
            });
            await page.waitForTimeout(1000); // Wait for re-render and backend interaction
            
            // Check if it's now red
            const hasLock = await page.$('.text-red-500');
            console.log("Red lock icon exists?", !!hasLock);
            
            // Check if scenario dropdown changed
            const selectValue = await page.$eval('.scenario-select', el => el.value);
            console.log("Scenario active:", selectValue);
            
        } else {
            console.log("NO unlock icon found");
        }
    } catch (e) {
        console.log("Error finding/clicking:", e);
    }
    
    await browser.close();
})();
