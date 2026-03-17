import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    console.log("🌐 Navigating to Farm Manager login page...");
    await page.goto('https://farm-manager1.vercel.app/login', { waitUntil: 'networkidle2' });
    
    // Step 1: Login Page
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'public/step1.png' });
    console.log("📸 Step 1: Login page captured.");

    // Type credentials
    console.log("⌨️ Typing credentials...");
    const emailInput = await page.$('input[type="email"], input[name*="email"], input[id*="email"], input[placeholder*="email" i], input[type="text"]');
    const passwordInput = await page.$('input[type="password"]');

    if (emailInput && passwordInput) {
      await emailInput.type('supersm3@naver.com');
      await passwordInput.type('050827');
    } else {
      const inputs = await page.$$('input');
      if (inputs.length >= 2) {
        await inputs[0].type('supersm3@naver.com');
        await inputs[1].type('050827');
      }
    }
    
    // Click login
    console.log("🖱️ Clicking login button...");
    const button = await page.$('button[type="submit"], button.bg-blue-600');
    if (button) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => console.log('Navigation timeout, continuing...')),
        button.click()
      ]);
    } else {
      await Promise.all([
         page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => console.log('Navigation timeout, continuing...')),
         page.keyboard.press('Enter')
      ])
    }
    
    console.log("⏳ Waiting extra time for Dashboard to settle...");
    await new Promise(r => setTimeout(r, 8000)); // 로그인 처리가 오래 걸릴 수 있으므로 충분히 대기
    
    // 현재 URL 확인
    console.log("Current URL after login:", page.url());

    // Step 2: Dashboard
    await page.screenshot({ path: 'public/step2.png' });
    console.log("📸 Step 2: Dashboard captured.");

    const menus = [
      { name: 'customers', url: 'https://farm-manager1.vercel.app/customers' },
      { name: 'shopping', url: 'https://farm-manager1.vercel.app/shopping' },
      { name: 'notes', url: 'https://farm-manager1.vercel.app/notes' },
      { name: 'recipes', url: 'https://farm-manager1.vercel.app/recipes' },
      { name: 'reservations', url: 'https://farm-manager1.vercel.app/reservations' }
    ];

    let stepCounter = 3;
    for (const menu of menus) {
      console.log(`🚀 Navigating to ${menu.name}...`);
      await page.goto(menu.url, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 4000)); // wait for Supabase data fetch
      await page.screenshot({ path: `public/step${stepCounter}.png` });
      console.log(`📸 Captured ${menu.name} (step${stepCounter}.png)`);
      stepCounter++;
    }

    await browser.close();
    console.log("✅ All menus captured!");
  } catch(e) {
    console.error("Error occurred:", e);
    process.exit(1);
  }
})();
