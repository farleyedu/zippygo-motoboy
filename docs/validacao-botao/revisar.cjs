// Compara com o HTML aprovado; nunca usa o próprio app como referência visual.
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || '../validacao-etapa1/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8193';
const prototype = path.resolve(__dirname, '../prototipo-motoboy');
const errors = [], checks = [], comparisons = [];
const source = Object.fromEntries(['prototype.js', 'styles.css'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(prototype, file))).digest('hex')]));
let browser, completed = false;
async function native({ dark = false, width = 390, motion = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: motion ? 'no-preference' : 'reduce' });
  await context.addInitScript(({ dark, motion }) => localStorage.setItem('zippygo.design.preferences.v1', JSON.stringify({ dark, reducedMotion: !motion })), { dark, motion });
  const page = await context.newPage(), requests = []; let release;
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
    requests.push({ method: req.method(), path: url.pathname });
    if (url.pathname.endsWith('/auth/login')) {
      await new Promise(resolve => { release = resolve; });
      return route.fulfill({ status: 401, json: { success: false, error: 'E-mail ou senha inválidos.' } });
    }
    return route.fulfill({ json: { success: true, data: null } });
  });
  const ready = page.waitForResponse(response => new URL(response.url()).pathname === '/api/Motoboy');
  await page.goto(base + '/login'); await ready;
  const button = page.getByRole('button', { name: 'Entrar', exact: true });
  await button.waitFor(); await page.evaluate(() => document.fonts.ready);
  return { context, page, button, requests, release: () => release?.() };
}
async function geometry(button) {
  return button.evaluate(el => {
    const style = getComputedStyle(el), bounds = el.getBoundingClientRect();
    const text = el.querySelector('[dir="auto"]') || el.lastElementChild;
    return { width: bounds.width, height: bounds.height, radius: style.borderRadius, padding: style.padding, border: style.border, fontSize: getComputedStyle(text).fontSize };
  });
}
async function main() {
  browser = await chromium.launch({ executablePath: process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const dark of [false, true]) for (const width of [390, 320]) {
      const name = `${dark ? 'escuro' : 'claro'}-${width}`;
      const original = await browser.newPage({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
      await original.goto(pathToFileURL(path.join(prototype, 'index.html')).href + '#login');
      await original.locator('#app form button.primary').waitFor();
      if (dark) await original.locator('#theme-button').click();
      // Retira só a moldura de apresentação. Conteúdo, CSS e assets são originais.
      await original.evaluate(width => {
        const app = document.querySelector('#app'); document.body.append(app);
        Object.assign(app.style, { position: 'fixed', top: '0', left: '0', right: 'auto', bottom: 'auto', width: `${width}px`, height: '844px', transform: 'none', borderRadius: '0', zIndex: '1000' });
      }, width);
      await original.evaluate(() => document.fonts.ready);
      const approved = original.locator('#app form button.primary');
      const expected = await geometry(approved);
      await original.locator('#app').screenshot({ path: path.join(__dirname, `original-${name}.png`) });
      await approved.screenshot({ path: path.join(__dirname, `botao-original-${name}.png`) });
      const app = await native({ dark, width });
      const actual = await geometry(app.button);
      assert.equal(actual.height, expected.height, name + ': altura do original');
      assert.equal(actual.radius, expected.radius, name + ': raio do original');
      assert.equal(actual.padding, expected.padding, name + ': padding do original');
      assert.equal(actual.fontSize, expected.fontSize, name + ': tamanho da fonte do original');
      const background = app.button.locator('svg').filter({ has: app.page.locator('rect[fill^="url("]') }).first();
      const fill = await background.boundingBox(), target = await app.button.boundingBox();
      assert.ok(fill.width >= target.width - 2 && fill.height >= target.height - 2, name + ': gradiente cobre a área inteira');
      assert.ok(Math.abs(fill.x - target.x) <= 1 && Math.abs(fill.y - target.y) <= 1, name + ': fundo começa no limite do botão');
      const icon = app.button.locator('svg').filter({ has: app.page.locator('path') }).last();
      const iconBox = await icon.boundingBox();
      assert.ok(iconBox.width > 0 && iconBox.height > 0, name + ': seta ocupa área visível');
      assert.ok(await icon.evaluate(el => Number(getComputedStyle(el.parentElement).zIndex) > 0), name + ': ícone na camada acima do fundo');
      assert.equal(await app.button.locator('linearGradient[id$="sheen"]').count(), 0, name + ': movimento reduzido sem reflexo animado');
      await app.page.screenshot({ path: path.join(__dirname, `app-web-${name}.png`), fullPage: true });
      await app.button.screenshot({ path: path.join(__dirname, `botao-app-web-${name}.png`) });
      comparisons.push({ theme: name, expected, actual, background: fill, scope: 'Componente botão; composição completa do login ainda diverge.' });
      await original.close(); await app.context.close();
    }
    checks.push('Original e app em claro/escuro e 390/320 px: medidas do botão, cobertura integral do SVG e redução de movimento.');
    const app = await native({ motion: true });
    await app.button.locator('linearGradient[id$="sheen"]').waitFor({ state: 'attached' });
    await app.page.waitForFunction(el => {
      const reflection = Array.from(el.querySelectorAll('svg')).find(svg => svg.querySelector('linearGradient[id$="sheen"]'));
      return reflection && Math.abs(reflection.getBoundingClientRect().x - el.getBoundingClientRect().x) < el.getBoundingClientRect().width * .1;
    }, await app.button.elementHandle(), { timeout: 12000 });
    await app.button.screenshot({ path: path.join(__dirname, 'botao-reflexo-web.png') });
    checks.push('Reflexo carregado com movimento habilitado; captura durante a passagem.');
    await app.button.click();
    await app.page.getByText('Informe um e-mail válido.', { exact: true }).waitFor();
    assert.equal(app.requests.filter(r => r.path.endsWith('/auth/login')).length, 0);
    await app.page.getByLabel('E-mail', { exact: true }).filter({ visible: true }).fill('teste@exemplo.com');
    await app.page.getByLabel('Senha', { exact: true }).filter({ visible: true }).fill('Senha@123');
    await app.button.click();
    await app.button.getByRole('progressbar').waitFor();
    assert.equal(await app.button.getAttribute('aria-disabled'), 'true');
    await app.button.evaluate(el => { el.click(); el.click(); });
    assert.equal(app.requests.filter(r => r.path.endsWith('/auth/login')).length, 1);
    await app.button.screenshot({ path: path.join(__dirname, 'botao-carregando-web.png') });
    app.release();
    await app.page.getByText('E-mail ou senha inválidos.', { exact: true }).waitFor();
    assert.equal(await app.button.isEnabled(), true);
    checks.push('Validação local sem HTTP; envio único durante carregamento; spinner, bloqueio e reativação após erro.');
    await app.context.close();
    assert.deepEqual(errors, []);
    completed = true;
  } finally {
    fs.writeFileSync(path.join(__dirname, 'resultado.json'), JSON.stringify({ completed, source, checks, comparisons, errors, note: 'Capturas são evidência para inspeção, sem aprovação automática de fidelidade da tela completa.' }, null, 2));
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
