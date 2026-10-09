const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8198', out = path.join(__dirname, 'captures');
const shop = { id: '11111111-1111-1111-1111-111111111111', nome: 'Forno & Lenha' };
const user = { id: '7', nome: 'Farley Silva', email: 'qa@exemplo.com', role: 'motoboy' };
const session = { sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', epoch: 1, isEnded: false, version: 1, heartbeatIntervalSeconds: 60 };
const now = new Date().toISOString();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9mEAAAAASUVORK5CYII=', 'base64');
const order = (id, nome) => ({ id, nomeCliente: nome, enderecoEntrega: 'Rua dos Ipes, 128', telefoneCliente: '11999990000', observacoes: 'Portao azul', items: [], value: '42.90' });
const stop = (id, pedidoId, status, extra = {}) => ({ pedidoId, stopId: id, position: 1, status, offerId: null, pedido: order(pedidoId, 'Maria Oliveira'), ...extra });
const errors = [], failures = [], results = [];

async function mockRoute(page, queueRef, withSession) {
  await page.routeWebSocket(/.*/, ws => ws.close());
  await page.route('**/tile.openstreetmap.org/**', route => route.fulfill({ body: png, contentType: 'image/png' }));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname;
    if (!p.startsWith('/api/')) return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
    const ok = data => route.fulfill({ json: { success: true, data } });
    if (p.endsWith('/motoboys/me/vinculos')) return ok([{ estabelecimentoId: shop.id, nome: shop.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo' }]);
    if (p.endsWith('/session')) return withSession ? ok(session) : route.fulfill({ status: 404, json: { success: false, error: 'Sem sessao ativa.' } });
    if (p.endsWith('/heartbeat')) return ok({ accessToken: 'operacional-qa', session });
    if (p.endsWith('/queue')) return ok(queueRef.value);
    if (p.endsWith('/motoboys/me/work')) return ok({ plan: null, plans: [], entries: [], settlementEntries: [], settlements: [], balance: { outstanding: 0, cashToReturn: 0 }, history: [], earnings: 0, unpricedDeliveries: 0, unconfirmedReceipts: 0, support: [] });
    if (p.endsWith('/chat/notifications')) return ok([]);
    const chat = p.match(/\/chat\/(group|store|private)\/messages/);
    if (chat) return ok({ messages: [], hasMore: false });
    if (p.endsWith('/atendimento/motoboys') || p.endsWith('/contacts')) return ok([]);
    return ok(method_default(req.method()));
  });
  function method_default(method) { return method === 'GET' ? {} : {}; }
}

async function setup(browser, width, dark, { withSession = true, pendingDraft = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: -22.9, longitude: -47.06 } });
  await context.addInitScript(({ shop, user, session, dark, withSession, pendingDraft }) => {
    localStorage.setItem('zippygo.design.preferences.v1', JSON.stringify({ dark, reducedMotion: true, sound: true, vibration: true }));
    const items = { 'zippygo.user': JSON.stringify(user), authToken: 'principal-qa', 'zippygo.token': 'principal-qa', 'zippygo.estabelecimentoAtual': JSON.stringify(shop) };
    if (withSession) Object.assign(items, { operationalAccessToken: 'operacional-qa', operationalUserId: user.id, operationalEstablishmentId: shop.id, operationalSession: JSON.stringify(session) });
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    if (pendingDraft) sessionStorage.setItem(`zippygo.completion.${user.id}`, JSON.stringify(pendingDraft));
  }, { shop, user, session, dark, withSession, pendingDraft });
  const page = await context.newPage();
  page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', e => errors.push(`${page.url()} :: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Manrope|net::ERR_ABORTED/.test(m.text())) errors.push(`${page.url()} :: console: ${m.text()}`); });
  return { page, context };
}

async function visit(page, route, label) {
  try {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => [...document.querySelectorAll('*')].some(el => Object.keys(el).some(k => k.startsWith('__reactProps$'))), { timeout: 15000 });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    await page.screenshot({ path: path.join(out, label + '.png'), fullPage: true });
    if (overflow) failures.push(`${label}: overflow horizontal`);
    return true;
  } catch (e) {
    failures.push(`${label}: ${e.message.split('\n')[0]}`);
    try { await page.screenshot({ path: path.join(out, label + '-falha.png'), fullPage: true }); } catch {}
    return false;
  }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  try {
    for (const dark of [false, true]) {
      const theme = dark ? 'escuro' : 'claro';
      let ok = 0, total = 0;

      // 10-home: offline, sem sessao operacional.
      { const queueRef = { value: { motoboyId: 1, estabelecimentoId: shop.id, version: 1, current: null, next: [], routeState: 'idle', politicas: {} } };
        const { page, context } = await setup(browser, 390, dark, { withSession: false });
        await mockRoute(page, queueRef, false);
        total++; if (await visit(page, '/', `10-home-${theme}`)) ok++;
        await context.close(); }

      // 11-online: sessao ativa, fila vazia (so online, aguardando oferta).
      { const queueRef = { value: { motoboyId: 1, estabelecimentoId: shop.id, version: 1, current: null, next: [], routeState: 'idle', politicas: {}, paused: false } };
        const { page, context } = await setup(browser, 390, dark, { withSession: true });
        await mockRoute(page, queueRef, true);
        total++; if (await visit(page, '/', `11-online-${theme}`)) ok++;
        await context.close(); }

      // 12-pause: sessao ativa, fila pausada.
      { const queueRef = { value: { motoboyId: 1, estabelecimentoId: shop.id, version: 1, current: null, next: [], routeState: 'idle', politicas: {}, paused: true } };
        const { page, context } = await setup(browser, 390, dark, { withSession: true });
        await mockRoute(page, queueRef, true);
        total++; if (await visit(page, '/', `12-pause-${theme}`)) ok++;
        await context.close(); }

      // 14-orders: mapa com pedidos na fila.
      { const queueRef = { value: { motoboyId: 1, estabelecimentoId: shop.id, version: 1, routeState: 'delivering', politicas: {}, current: stop(1, 23, 'en_route', { arrivedAtUtc: null, pickedUpAtUtc: now }), next: [stop(2, 24, 'assigned'), stop(3, 25, 'assigned')] } };
        const { page, context } = await setup(browser, 390, dark, { withSession: true });
        await mockRoute(page, queueRef, true);
        total++; if (await visit(page, '/mapa', `14-orders-${theme}`)) ok++;
        await context.close(); }

      // 54-pending: rascunho de conclusao pendente salvo localmente.
      { const queueRef = { value: { motoboyId: 1, estabelecimentoId: shop.id, version: 1, current: null, next: [], routeState: 'idle', politicas: {} } };
        const draft = { userId: String(user.id), storeId: shop.id, sessionId: session.sessionId, epoch: session.epoch, phase: 'pending',
          context: { pedidoId: 23, total: 42.90 }, request: { operationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', expectedPedidoId: 23 }, codeChecked: true };
        const { page, context } = await setup(browser, 390, dark, { withSession: true, pendingDraft: draft });
        await mockRoute(page, queueRef, true);
        total++; if (await visit(page, '/entregaPendente', `54-pending-${theme}`)) ok++;
        await context.close(); }

      results.push(`${theme}: ${ok}/${total} telas restantes abriram sem crash/overflow`);
    }
    fs.writeFileSync(path.join(__dirname, 'results-remaining.json'), JSON.stringify({ results, errors: [...new Set(errors)], failures }, null, 2));
    console.log(results.join('\n'));
    console.log('\nFALHAS:', failures.length); failures.forEach(f => console.log(' -', f));
    console.log('\nERROS:', [...new Set(errors)].length); [...new Set(errors)].forEach(e => console.log(' -', e));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
