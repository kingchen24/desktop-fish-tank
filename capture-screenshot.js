// 截图脚本 - 使用 puppeteer 截取游戏画面（file:// 协议）
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files', '--enable-local-file-accesses']
  });
  const page = await browser.newPage();

  const filePath = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
  console.log('打开:', filePath);

  await page.setViewport({ width: 400, height: 260 });
  await page.goto(filePath, { waitUntil: 'networkidle0', timeout: 15000 });

  await page.waitForSelector('canvas', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 4000));

  const dir = path.join(__dirname, 'screenshots');
  await page.screenshot({
    path: path.join(dir, 'game-preview.png'),
    clip: { x: 0, y: 0, width: 400, height: 260 }
  });

  console.log('✅ 截图已保存: screenshots/game-preview.png');
  await browser.close();
})();
