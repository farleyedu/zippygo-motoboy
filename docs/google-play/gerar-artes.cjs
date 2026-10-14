// Derivados para o Google Play. Reutiliza a identidade aprovada e não altera o app.
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PNG } = require('pngjs');
const { generateImageAsync } = require('@expo/image-utils');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');

function exportPng(buffer, colorType) {
  const png = PNG.sync.read(buffer);
  return PNG.sync.write(png, { colorType, inputColorType: 6 });
}

(async () => {
  await fs.mkdir(path.join(__dirname, 'imagens'), { recursive: true });
  const icon = await generateImageAsync({ projectRoot: root, cacheType: 'google-play-icon' }, {
    src: path.join(root, 'assets/images/icon.png'), width: 512, height: 512,
    resizeMode: 'contain', backgroundColor: '#1854cd', removeTransparency: true,
  });
  await fs.writeFile(path.join(__dirname, 'imagens/icone-512.png'), exportPng(icon.source, 6));
  await fs.copyFile(path.join(root, 'assets/images/icon.png'), path.join(__dirname, 'imagens/logo-1024.png'));
  await fs.copyFile(path.join(root, 'assets/images/splash-icon.png'), path.join(__dirname, 'imagens/logo-transparente.png'));
  const browser = await chromium.launch({
    executablePath: process.env.PLAY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(__dirname, 'artes/banner.html')).href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });
    await fs.writeFile(path.join(__dirname, 'imagens/banner-1024x500.png'), exportPng(await page.screenshot(), 2));
    const originals = path.join(__dirname, 'originais');
    const files = await fs.readdir(originals).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    for (const name of files.filter(name => name.endsWith('.png')).sort()) {
      const buffer = await fs.readFile(path.join(originals, name));
      const png = PNG.sync.read(buffer);
      const width = Math.max(png.width, Math.round(png.height * 9 / 16));
      const height = png.height;
      const index = (Math.min(120, height - 1) * png.width) * 4;
      const background = '#' + [...png.data.subarray(index, index + 3)].map(value => value.toString(16).padStart(2, '0')).join('');
      await page.setViewportSize({ width, height });
      await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}body{display:flex;align-items:center;justify-content:center;background:${background}}img{display:block;width:${png.width}px;height:${png.height}px}</style><img src="data:image/png;base64,${buffer.toString('base64')}">`);
      await page.evaluate(async () => Promise.all([...document.images].map(image => image.decode())));
      await fs.writeFile(path.join(__dirname, 'imagens', name), exportPng(await page.screenshot(), 2));
      console.log(`${name}: ${width} × ${height}, interface integral, sem corte nem ampliação.`);
    }
  } finally { await browser.close(); }
  console.log('Artes, logos e capturas disponíveis exportadas para imagens/.');
})().catch(error => { console.error(error); process.exitCode = 1; });
