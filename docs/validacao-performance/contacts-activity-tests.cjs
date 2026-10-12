// Exercita o bundle real com dados locais; nenhuma chamada sai para a API publicada.
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const dist = path.resolve(process.env.QA_DIST || '.expo/performance-validation/web');
const shop = { id: '11111111-1111-4111-8111-111111111111', nome: 'Loja QA' }, user = { id: '7', nome: 'Motoboy QA', role: 'motoboy' };
const session = { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', epoch: 1, origin: 'mobile', clientPlatform: 'web', isEnded: false, version: 1, heartbeatIntervalSeconds: 240, presenceExpiresAtUtc: new Date(Date.now() + 720000).toISOString() };
const contacts = Array.from({ length: 35 }, (_, i) => ({ motoboyId: i + 2, nome: `Pessoa ${String(i + 2).padStart(2, '0')}`, online: i < 5 }));
const shots = path.resolve('.expo/performance-validation/screens'); fs.mkdirSync(shots, { recursive: true });
const server = http.createServer((req, res) => {
  let file = path.resolve(dist, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html');
  if (!file.startsWith(dist + path.sep)) return res.writeHead(403).end();
  if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
const result = { cases: [], errors: [] }; let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const dark of [false, true]) for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, permissions: ['geolocation'], geolocation: { latitude: -18.92, longitude: -48.24 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ shop, user, session, dark }) => {
      const nativeFetch = window.fetch.bind(window); window.fetch = (input, init) => { if (typeof input === 'string') { const u = new URL(input, location.href); if (u.pathname.startsWith('/api/')) return nativeFetch(u.pathname + u.search, init); } return nativeFetch(input, init); };
      const interval = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
      window.__qaIntervals = new Map();
      window.setInterval = (callback, delay, ...args) => { const id = interval(callback, delay, ...args); window.__qaIntervals.set(id, { delay }); return id; };
      window.clearInterval = id => { window.__qaIntervals.delete(id); clear(id); };
      for (const [key, value] of Object.entries({ 'zippygo.user': JSON.stringify(user), authToken: 'principal-qa', 'zippygo.token': 'principal-qa', 'zippygo.estabelecimentoAtual': JSON.stringify(shop), operationalAccessToken: 'operacional-qa', operationalSession: JSON.stringify(session), operationalEstablishmentId: shop.id, operationalUserId: user.id, 'zippygo.design.preferences.v1': JSON.stringify({ dark, reducedMotion: true }) })) localStorage.setItem(key, value);
    }, { shop, user, session, dark });
    const page = await context.newPage(); const requests = [];
    page.on('pageerror', e => result.errors.push(e.message)); await page.routeWebSocket(/.*/, ws => ws.close());
    await page.route('**/*', route => {
      const u = new URL(route.request().url()), p = u.pathname;
      if (!p.startsWith('/api/')) return u.origin === base || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort();
      requests.push(p + u.search); const ok = data => route.fulfill({ json: { success: true, data } });
      if (p.endsWith('/contacts')) {
        assert.equal(u.searchParams.get('paged'), 'true');
        const rows = contacts.filter(c => c.nome.toLowerCase().includes((u.searchParams.get('search') || '').toLowerCase()));
        const start = Number(u.searchParams.get('cursor') || 0), limit = start ? 10 : 15;
        return ok({ contacts: rows.slice(start, start + limit), totalContacts: rows.length, onlineContacts: rows.filter(c=>c.online).length, hasMore: start + limit < rows.length, cursor: start + limit < rows.length ? String(start + limit) : null });
      }
      if (p.endsWith('/vinculos')) return ok([{ estabelecimentoId: shop.id, nome: shop.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo', modulosAtivos: ['DELIVERY'] }]);
      if (p.endsWith('/session')) return ok(session);
      if (p.endsWith('/heartbeat')) return ok({ accessToken: 'operacional-qa', session });
      if (p.endsWith('/queue')) return ok({ motoboyId: 1, estabelecimentoId: shop.id, version: 1, current: null, next: [], offer: null, routeState: 'idle' });
      if (p.endsWith('/notifications')) return ok([]);
      if (p.endsWith('/messages')) return ok({ messages: [], hasMore: false });
      return ok(null);
    });
    await page.goto(base + '/conversas?view=contacts');
    await page.getByText('Pessoa 02', { exact: true }).waitFor();
    const rosterRequests = () => requests.filter(p => p.includes('/contacts'));
    assert.equal(rosterRequests().length, 1);
    await page.screenshot({ path: path.join(shots, `contacts-${dark ? 'dark' : 'light'}-${width}.png`) });
    const scrollToEnd = () => page.evaluate(() => {
      for (const el of document.querySelectorAll('div')) if (el.scrollHeight > el.clientHeight + 20 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
    });
    await scrollToEnd(); await page.getByText('Pessoa 26', { exact: true }).waitFor({ state: 'attached' });
    await scrollToEnd(); await page.getByText('Pessoa 36', { exact: true }).waitFor({ state: 'attached' });
    assert.equal(rosterRequests().length, 3);
    const queueBeforeSearch = requests.filter(p => p.endsWith('/queue')).length;
    await page.getByRole('textbox', { name: 'Buscar contato' }).fill('Pessoa 31');
    await page.getByText('Pessoa 31', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.body.textContent.includes('Pessoa 02'));
    assert.equal(requests.filter(p => p.endsWith('/queue')).length, queueBeforeSearch);
    await page.evaluate(() => {
      window.__qaVisibility = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__qaVisibility });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => !Array.from(window.__qaIntervals.values()).some(timer => timer.delay === 60000));
    await page.evaluate(() => { window.__qaVisibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => Array.from(window.__qaIntervals.values()).some(timer => timer.delay === 60000));
    await page.goto(base + '/conversas?view=group');
    await page.getByText('Grupo · 35 participantes · 5 online', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    result.cases.push({ dark, width, contacts: 35, pages: 3, backgroundStopsTimers: true, searchDoesNotReloadQueue: true, teamCountIncludesUnloadedContacts: true });
    await context.close();
  }
  assert.deepEqual(result.errors, []); result.ok = true;
})().catch(error => { result.ok = false; result.failure = error.stack; process.exitCode = 1; }).finally(async () => {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(__dirname, 'contacts-activity-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
});
