import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log("🌐 Navigating to Farm Manager login page...");
    await page.goto('https://farm-manager1.vercel.app/login', { waitUntil: 'networkidle2' });
    
    // Step 1: 접속 직후 화면 캡처
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'public/step1.png' });
    console.log("📸 Step 1: Login page captured.");

    // Step 2: 정보 입력 
    console.log("⌨️ Typing credentials...");
    const emailInput = await page.$('input[type="email"], input[name*="email"], input[id*="email"], input[placeholder*="email" i], input[type="text"]');
    const passwordInput = await page.$('input[type="password"]');

    if (emailInput && passwordInput) {
      await emailInput.type('supersm3@naver.com');
      await passwordInput.type('050827');
    } else {
      // Fallback
      const inputs = await page.$$('input');
      if (inputs.length >= 2) {
        await inputs[0].type('supersm3@naver.com');
        await inputs[1].type('050827');
      } else {
        throw new Error("Inputs not found");
      }
    }
    
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'public/step2.png' });
    console.log("📸 Step 2: Credentials captured.");

    // Step 3: 로그인 버튼 누르고 대시보드 캡처
    console.log("🖱️ Clicking login button...");
    const button = await page.$('button[type="submit"]');
    if (button) {
      await button.click();
    } else {
      await page.keyboard.press('Enter');
    }
    
    console.log("⏳ Waiting for dashboard to load...");
    await new Promise(r => setTimeout(r, 5000)); // 로그인 후 대기
    await page.screenshot({ path: 'public/step3.png' });
    console.log("📸 Step 3: Dashboard captured.");

    await browser.close();
    console.log("✅ All done!");
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
