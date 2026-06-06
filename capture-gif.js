// GIF 录制脚本 - 使用 puppeteer 录制游戏动画（file:// 协议）
const puppeteer = require('puppeteer');
const GIFEncoder = require('gif-encoder-2');
const { PNG } = require('pngjs');
const path = require('path');
const fs = require('fs');

const WIDTH = 400;
const HEIGHT = 260;
const FPS = 5;
const DURATION = 2000;
const TOTAL_FRAMES = Math.floor(DURATION / 1000 * FPS);

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files', '--enable-local-file-accesses']
  });
  const page = await browser.newPage();

  const filePath = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
  console.log('打开:', filePath);

  await page.setViewport({ width: WIDTH, height: HEIGHT });
  await page.goto(filePath, { waitUntil: 'networkidle0', timeout: 15000 });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', false, TOTAL_FRAMES);
  encoder.setDelay(1000 / FPS);
  encoder.setQuality(10);
  encoder.setRepeat(0);

  const dir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const outputPath = path.join(dir, 'game-animation.gif');
  const outStream = fs.createWriteStream(outputPath);
  encoder.createReadStream().pipe(outStream);
  encoder.start();

  console.log('🎬 开始录制 GIF...');
  const interval = 1000 / FPS;

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const buffer = await page.screenshot({
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT }
    });
    const png = PNG.sync.read(buffer);
    const rgb = Buffer.alloc(WIDTH * HEIGHT * 3);
    for (let j = 0; j < WIDTH * HEIGHT; j++) {
      rgb[j * 3] = png.data[j * 4];
      rgb[j * 3 + 1] = png.data[j * 4 + 1];
      rgb[j * 3 + 2] = png.data[j * 4 + 2];
    }
    encoder.addFrame(rgb);
    await new Promise(r => setTimeout(r, interval));
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r   进度: ${i + 1}/${TOTAL_FRAMES} 帧`);
    }
  }

  encoder.finish();
  console.log('\n  合成中...');

  await new Promise((resolve) => outStream.on('finish', resolve));
  console.log('✅ GIF 已保存: screenshots/game-animation.gif');

  await browser.close();
})();
