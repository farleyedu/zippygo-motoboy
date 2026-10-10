// Exercita o bundle web de produção com API interceptada e GPS controlado no Chromium.
// Não usa credenciais/requisições de produção e não substitui teste em iPhone físico.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), dist = path.join(root, 'dist');
const shop = { id: '11111111-1111-4111-8111-111111111111', nome: 'Loja QA' };
const user = { id: '7', nome: 'Motoboy QA', email: 'qa@exemplo.invalid', role: 'motoboy' };
const session = { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', epoch: 1, origin: 'mobile', clientPlatform: 'web',
  isEnded: false, version: 1, heartbeatIntervalSeconds: 25, presenceExpiresAtUtc: new Date(Date.now() + 43200000).toISOString() };
const queue = { motoboyId: 1, estabelecimentoId: shop.id, version: 3, current: { pedidoId: 23, status: 'en_route', position: 1,
  pedido: { id: 23, nomeCliente: 'Cliente QA', enderecoEntrega: 'Rua QA, 123' } }, next: [], routeState: 'delivering' };
const calls = [], errors = []; let failGps = false, browser, currentPage;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let file = path.resolve(dist, relative);
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: -18.9, longitude: -48.2 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ shop, user }) => {
    for (const [key, value] of Object.entries({ 'zippygo.user': JSON.stringify(user), authToken: 'principal-qa', 'zippygo.token': 'principal-qa',
      'zippygo.estabelecimentoAtual': JSON.stringify(shop), 'zippygo.design.preferences.v1': JSON.stringify({ dark: false, reducedMotion: true }) })) localStorage.setItem(key, value);
    window.__qaVisible = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__qaVisible ? 'visible' : 'hidden' });
  }, { shop, user });
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(/.*/, ws => ws.close());
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname;
    if (!p.startsWith('/api/')) return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
    const body = request.postData() ? JSON.parse(request.postData()) : null;
    calls.push({ p, method: request.method(), body });
    const ok = data => route.fulfill({ json: { success: true, data } });
    if (p.endsWith('/vinculos')) return ok([{ estabelecimentoId: shop.id, nome: shop.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo', modulosAtivos: ['DELIVERY'] }]);
    if (p.endsWith('/session/start')) return ok({ establishmentId: shop.id, accessToken: 'operacional-qa', motoboy: { id: 1 }, session });
    if (p.endsWith('/session')) return ok(session);
    if (p.endsWith('/heartbeat')) return ok({ accessToken: 'operacional-qa', session });
    if (p.endsWith('/queue')) return ok(queue);
    if (p.endsWith('/location/batch')) {
      if (failGps) return route.abort('failed');
      return ok({ samples: body.samples.map(sample => ({ sampleId: sample.sampleId, sequence: sample.sequence, outcome: 'accepted', updatedCurrent: true, sessionVersion: 2, receivedAtUtc: new Date().toISOString() })) });
    }
    if (p.endsWith('/contacts')) return ok([]);
    if (p.includes('/messages')) return ok({ messages: [], hasMore: false });
    if (p.endsWith('/notifications')) return ok([]);
    return ok(null);
  });
  const gpsCalls = () => calls.filter(call => call.p.endsWith('/location/batch'));
  const waitForGps = async count => {
    const deadline = Date.now() + 30000;
    while (gpsCalls().length <= count && Date.now() < deadline) await page.waitForTimeout(100);
    assert.ok(gpsCalls().length > count, 'O retorno deve enviar uma posição nova.');
  };
  await page.goto(base + '/permissoes', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: 'Ficar online', exact: true }).click();
  await context.setGeolocation({ latitude: -18.90001, longitude: -48.20001 });
  await page.waitForFunction(() => !!localStorage.getItem('tracking.sent.v3.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.1'));
  assert.equal(calls.find(call => call.p.endsWith('/session/start')).body.clientPlatform, 'web');
  assert.ok(gpsCalls().length > 0);
  await page.goto(base + '/conexao', { waitUntil: 'domcontentloaded' });
  await page.getByText('Última localização agora', { exact: true }).waitFor();
  const hide = async visible => page.evaluate(value => { window.__qaVisible = value; document.dispatchEvent(new Event('visibilitychange')); }, visible);
  await hide(false); const paused = gpsCalls().length;
  await context.setGeolocation({ latitude: -18.901, longitude: -48.201 });
  await page.waitForTimeout(1000); assert.equal(gpsCalls().length, paused);
  await hide(true); await waitForGps(paused);
  const key = 'tracking.sent.v3.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.1';
  await hide(false);
  const staleAt = new Date(Date.now() - 180000).toISOString();
  await page.evaluate(({ key, staleAt }) => { const sent = JSON.parse(localStorage.getItem(key)); sent.capturedAtUtc = staleAt; localStorage.setItem(key, JSON.stringify(sent)); }, { key, staleAt });
  failGps = true; await context.setGeolocation({ latitude: -18.902, longitude: -48.202 }); await hide(true);
  await page.getByText('Última localização há 3 min', { exact: true }).waitFor();
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).capturedAtUtc, key), staleAt);
  await page.screenshot({ path: path.join(__dirname, 'conexao-web.png'), fullPage: true });
  failGps = false; await hide(false); await hide(true);
  await page.waitForTimeout(16000); // janela de retry da fila após a falha controlada
  // O override do Chromium mantém o timestamp do último setGeolocation;
  // produzir um fix novo para exercitar a consulta periódica real do app.
  await context.setGeolocation({ latitude: -18.9021, longitude: -48.2021 });
  await page.getByText('Última localização agora', { exact: true }).waitFor();
  await page.goto(base + '/permissoes', { waitUntil: 'domcontentloaded' });
  await page.getByText('Localização com o ZippyGo aberto', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Permitir em segundo plano' }).count(), 0);
  await page.screenshot({ path: path.join(__dirname, 'permissoes-web.png'), fullPage: true });
  assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'), 'yes');
  const manifest = await (await context.request.get(base + '/manifest.json')).json(); assert.equal(manifest.display, 'standalone');
  assert.equal((await context.request.get(base + '/icon.png')).status(), 200);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(__dirname, 'browser-results.json'), JSON.stringify({ ok: true, gpsRequests: gpsCalls().length, platform: 'Chromium, GPS/API controlados', cases: ['início web sem background', 'posição ao abrir', 'pausa oculta', 'posição ao retornar', 'falha não zera idade', 'recuperação da fila', 'permissões', 'manifest/ícone'], errors }, null, 2));
  process.stdout.write('Web: início, retorno, pausa, falha, fila, permissões e instalação verificados.\n');
})().catch(async error => {
  process.stderr.write(error.stack + '\n'); process.exitCode = 1;
  if (currentPage) {
    await currentPage.screenshot({ path: path.join(__dirname, 'browser-failure.png'), fullPage: true }).catch(() => {});
    const state = await currentPage.evaluate(() => ({ text: document.body.innerText, secure: window.isSecureContext,
      keys: Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('tracking.') || key.startsWith('operational'))) })).catch(() => null);
    fs.writeFileSync(path.join(__dirname, 'browser-failure.json'), JSON.stringify({ error: error.message, errors, calls, state }, null, 2));
  }
}).finally(async () => { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); });
