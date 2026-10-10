// Bundle real, API/GPS controlados e teste de clique nas camadas do Leaflet.
// Chromium/WebKit de desktop não substituem homologação no iPhone físico.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const dist = path.resolve(__dirname, '../../dist');
const engine = process.env.QA_BROWSER || 'chromium';
const baseline = process.env.QA_EXPECT_COVERED === '1';
const shop = { id: '11111111-1111-4111-8111-111111111111', nome: 'Loja QA' };
const user = { id: '7', nome: 'Motoboy QA', email: 'qa@exemplo.invalid', role: 'motoboy' };
const session = { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', epoch: 1, origin: 'mobile', clientPlatform: 'web',
  startedAtUtc: new Date().toISOString(), isEnded: false, version: 1, heartbeatIntervalSeconds: 25,
  presenceExpiresAtUtc: new Date(Date.now() + 43200000).toISOString() };
const order = { id: 23, nomeCliente: 'Cliente QA', enderecoEntrega: 'Rua QA, 123', latitude: -18.918, longitude: -48.24,
  pickedUpAtUtc: new Date().toISOString(), total: 30, pago: true, itens: [], checklist: { items: [], enabled: false } };
const stop = { pedidoId: 23, status: 'en_route', position: 1, pickedUpAtUtc: order.pickedUpAtUtc, pedido: order };
const result = { engine, baseline, cases: [], errors: [], failedRequests: [] };
let browser, page;
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  let file = path.resolve(dist, relative);
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function reachable(locator) {
  await locator.waitFor({ state: 'visible' });
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { reachable: !!hit && (hit === el || el.contains(hit)), hit: hit?.outerHTML.slice(0, 250) };
  });
}
async function controlPainted(locator) {
  const rect = await locator.boundingBox();
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(async ({ rect, png }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(Math.ceil(rect.x + 7), Math.ceil(rect.y + 7), Math.floor(rect.width - 14), Math.floor(rect.height - 14)).data;
    let dark = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 85 && pixels[i + 1] < 100 && pixels[i + 2] < 140) dark++;
    return dark / (pixels.length / 4) > .65;
  }, { rect, png });
}
async function visit(url) {
  if (page.url() !== 'about:blank') {
    await page.evaluate(() => { window.__qaVisible = false; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300); // concluir as respostas da API controlada antes de destruir o documento
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ headless: true,
    executablePath: process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
  for (const dark of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'],
      geolocation: { latitude: -18.916, longitude: -48.238 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ shop, user, session, dark }) => {
      // API de teste na mesma origem: o roteiro mede camadas/navegação,
      // sem depender de CORS entre loopback e a URL publicada durante reloads.
      const fetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (typeof input === 'string') {
          const url = new URL(input, window.location.href);
          if (url.pathname.startsWith('/api/')) return fetch(url.pathname + url.search, init);
        }
        return fetch(input, init);
      };
      const values = { 'zippygo.user': JSON.stringify(user), authToken: 'principal-qa', 'zippygo.token': 'principal-qa',
        'zippygo.estabelecimentoAtual': JSON.stringify(shop), operationalAccessToken: 'operacional-qa',
        operationalSession: JSON.stringify(session), operationalEstablishmentId: shop.id, operationalUserId: user.id,
        'zippygo.design.preferences.v1': JSON.stringify({ dark, reducedMotion: true }) };
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      window.__qaVisible = true;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__qaVisible ? 'visible' : 'hidden' });
    }, { shop, user, session, dark });
    page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.routeWebSocket(/.*/, ws => ws.close());
    let mode = 'delivery';
    await page.route('**/*', route => {
      const req = route.request(), url = new URL(req.url()), p = url.pathname;
      // Tiles públicos somente para a captura visual; nenhuma API real é acessada.
      if (!p.startsWith('/api/')) return url.origin === base || url.hostname === 'tile.openstreetmap.org' ||
        ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
      const headers = { 'access-control-allow-origin': base, 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const ok = data => route.fulfill({ headers, json: { success: true, data } });
      if (p.endsWith('/vinculos')) return ok([{ estabelecimentoId: shop.id, nome: shop.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo', modulosAtivos: ['DELIVERY'] }]);
      if (p.endsWith('/session')) return ok(session);
      if (p.endsWith('/heartbeat')) return ok({ accessToken: 'operacional-qa', session });
      if (p.endsWith('/queue')) return ok({ motoboyId: 1, estabelecimentoId: shop.id, version: 3,
        current: mode === 'return' ? null : mode === 'pickup' ? { ...stop, pickedUpAtUtc: null } : stop,
        next: [], routeState: mode === 'return' ? 'returning' : 'delivering' });
      if (p.endsWith('/store')) return ok({ nome: shop.nome, latitude: -18.92, longitude: -48.242, rua: 'Rua da Loja', numero: '100' });
      if (p.endsWith('/orders/23')) return ok(order);
      if (p.endsWith('/location/batch')) return ok({ samples: JSON.parse(req.postData()).samples.map(s => ({ sampleId: s.sampleId, sequence: s.sequence, outcome: 'accepted', updatedCurrent: true, receivedAtUtc: new Date().toISOString() })) });
      if (p.endsWith('/contacts') || p.endsWith('/notifications')) return ok([]);
      if (p.includes('/messages')) return ok({ messages: [], hasMore: false });
      return ok(null);
    });
    await visit(base + '/mapa');
    await page.locator('.leaflet-marker-pane .leaflet-marker-icon').first().waitFor();
    const center = page.getByRole('button', { name: 'Centralizar minha posição', exact: true });
    const before = await reachable(center);
    before.painted = await controlPainted(center);
    if (baseline) {
      if (!dark) {
        assert.equal(before.painted, false, 'O bundle anterior deve reproduzir o mapa cobrindo os controles no tema claro.');
        await page.screenshot({ path: path.join(__dirname, 'map-layer-before.png') });
      }
      result.cases.push({ theme: dark ? 'dark' : 'light', center: before });
      await context.close(); continue;
    }
    assert.equal(before.reachable, true, JSON.stringify(before));
    assert.equal(before.painted, true, 'O botão deve estar desenhado acima dos tiles, além de aceitar cliques.');
    await center.click();
    await page.mouse.move(120, 300); await page.mouse.down(); await page.mouse.move(230, 360, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(500); // fim da inércia/animação do Leaflet
    await page.evaluate(() => { window.__qaVisible = false; document.dispatchEvent(new Event('visibilitychange'));
      window.__qaVisible = true; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); });
    await page.waitForTimeout(500);
    assert.equal(await controlPainted(center), true, 'O botão deve continuar visível após arrastar e retornar.');
    for (const label of ['Centralizar minha posição', 'Opções do mapa', 'Expandir pedidos', 'Conferir pedido']) {
      const hit = await reachable(page.getByRole('button', { name: label, exact: true }));
      assert.equal(hit.reachable, true, label + ': ' + JSON.stringify(hit));
    }
    await page.getByRole('button', { name: 'Opções do mapa', exact: true }).click();
    assert.equal((await reachable(page.getByRole('button', { name: 'Histórico de rotas', exact: true }))).reachable, true);
    await page.getByRole('button', { name: 'Opções do mapa', exact: true }).click();
    await page.getByRole('button', { name: 'Iniciar modo rota', exact: true }).click();
    await page.getByRole('button', { name: 'Google Maps', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.screenshot({ path: path.join(__dirname, `map-layer-${engine}-${dark ? 'dark' : 'light'}.png`) });
    // A conferência da retirada abre esse link; na web ele mantém as ações da rota.
    await visit(base + '/mapa?modo=rota');
    assert.equal((await reachable(page.getByRole('button', { name: 'Conferir pedido', exact: true }))).reachable, true);
    assert.equal(await controlPainted(page.getByRole('button', { name: 'Centralizar minha posição', exact: true })), true);
    await page.getByRole('button', { name: 'Conferir pedido', exact: true }).click();
    await page.waitForURL('**/pedido/23');
    result.cases.push({ theme: dark ? 'dark' : 'light', mode: 'delivery', panResume: true, chooser: true, routeLink: true, checks: '/pedido/23' });
    for (const variant of [{ mode: 'pickup', label: 'Conferir coleta', route: '/retirada' }, { mode: 'return', label: 'Conferir retorno', route: '/retornoLoja' }]) {
      mode = variant.mode;
      await visit(base + '/mapa');
      const button = page.getByRole('button', { name: variant.label, exact: true });
      assert.equal((await reachable(button)).reachable, true);
      await button.click(); await page.waitForURL('**' + variant.route);
      if (mode === 'return') await page.screenshot({ path: path.join(__dirname, `map-return-${engine}-${dark ? 'dark' : 'light'}.png`) });
      result.cases.push({ theme: dark ? 'dark' : 'light', mode, checks: variant.route });
    }
    await context.close();
  }
  assert.deepEqual(result.errors, []);
  result.ok = true;
  fs.writeFileSync(path.join(__dirname, `map-layer-${baseline ? 'baseline' : engine}-results.json`), JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
})().catch(async error => {
  process.stderr.write(error.stack + '\n'); process.exitCode = 1;
  process.stderr.write(JSON.stringify(result, null, 2) + '\n');
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(__dirname, `map-layer-${engine}-failure.png`) }).catch(() => {});
}).finally(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); });
