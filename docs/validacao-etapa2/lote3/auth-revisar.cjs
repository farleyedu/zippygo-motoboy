// Restauração e novo login no app real exportado; toda API é interceptada.
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8195';
const output = path.resolve(__dirname, '../../../.expo/validation-auth');
const user = { id: 'qa-auth', nome: 'Motoboy QA', email: 'qa-auth@exemplo.com', role: 'motoboy' };
const shop = { id: '11111111-1111-1111-1111-111111111111', nome: 'Loja QA' };
const session = { sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', epoch: 7, isEnded: false, heartbeatIntervalSeconds: 60, version: 1 };
const gpsKey = 'tracking.queue.v3.turno-auth.7';
const gps = JSON.stringify([{ sampleId: 'gps-qa', sequence: 1, latitude: -23.5, longitude: -46.6 }]);
const results = [], errors = [];
let browser;

async function setup(mode, refresh = true) {
  const state = { mode, calls: [] };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ user, shop, session, refresh, gpsKey, gps }) => {
    for (const [key, value] of Object.entries({
      'zippygo.user': JSON.stringify(user), authToken: 'principal-antigo', 'zippygo.token': 'principal-antigo',
      'zippygo.estabelecimentoAtual': JSON.stringify(shop), operationalAccessToken: 'operacional-pendente',
      operationalUserId: user.id, operationalEstablishmentId: shop.id, operationalSession: JSON.stringify(session),
      [gpsKey]: gps, 'zippygo.design.preferences.v1': JSON.stringify({ dark: false, reducedMotion: true }),
    })) localStorage.setItem(key, value);
    if (refresh) localStorage.setItem('refreshToken', 'refresh-antigo');
  }, { user, shop, session, refresh, gpsKey, gps });
  const page = await context.newPage();
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(/.*/, ws => ws.close());
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
    state.calls.push({ path: url.pathname, method: req.method() });
    const ok = data => route.fulfill({ json: { success: true, data } });
    const fail = status => route.fulfill({ status, json: { success: false, error: status === 503 ? 'Banco temporariamente indisponível.' : 'Não autorizado.' } });
    if (url.pathname.endsWith('/auth/refresh')) {
      if (state.mode === 'network') return route.abort('failed');
      if (state.mode === '503') return fail(503);
      if (state.mode === 'refused') return fail(401);
      return ok({ accessToken: 'principal-renovado', refreshToken: 'refresh-renovado' });
    }
    if (url.pathname.endsWith('/auth/login')) {
      state.mode = 'good';
      return ok({ accessToken: 'principal-login', refreshToken: 'refresh-login', user });
    }
    if (url.pathname.endsWith('/motoboys/me/vinculos')) {
      const auth = req.headers().authorization;
      if (state.mode === 'persistent-401' || !['Bearer principal-renovado', 'Bearer principal-login', 'Bearer principal-selecionado'].includes(auth)) return fail(401);
      return ok([{ estabelecimentoId: shop.id, nome: shop.nome, tipoAcesso: 'motoboy' }]);
    }
    if (url.pathname.endsWith('/auth/definir-estabelecimento')) return ok({ accessToken: 'principal-selecionado', estabelecimentoSelecionado: shop });
    if (url.pathname.endsWith('/session')) return ok(session);
    if (url.pathname.endsWith('/heartbeat')) return ok({ accessToken: 'operacional-pendente', session });
    if (url.pathname.endsWith('/queue')) return ok({ version: 1, current: null, next: [], routeState: 'idle' });
    return ok(null);
  });
  await page.goto(base + '/');
  return { page, context, state };
}

async function values(page) {
  return page.evaluate(gpsKey => Object.fromEntries(['authToken', 'zippygo.token', 'refreshToken', 'zippygo.user', 'zippygo.estabelecimentoAtual', 'operationalAccessToken', 'operationalSession', gpsKey].map(key => [key, localStorage.getItem(key)])), gpsKey);
}
function preserved(saved) {
  assert.equal(saved[gpsKey], gps);
  assert.equal(saved.operationalAccessToken, 'operacional-pendente');
  assert.equal(JSON.parse(saved['zippygo.estabelecimentoAtual']).id, shop.id);
  assert.equal(JSON.parse(saved['zippygo.user']).id, user.id);
}
function noEnd(state) { assert.equal(state.calls.some(c => c.method === 'DELETE' && c.path.endsWith('/session')), false); }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  for (const [mode, refresh] of [['refused', false], ['refused', true], ['persistent-401', true]]) {
    const f = await setup(mode, refresh);
    await f.page.waitForURL(/\/login$/);
    await f.page.getByRole('button', { name: /Entrar/ }).waitFor();
    const saved = await values(f.page); preserved(saved); noEnd(f.state);
    for (const key of ['authToken', 'zippygo.token', 'refreshToken']) assert.equal(saved[key], null);
    assert.equal(f.state.calls.filter(c => c.path.endsWith('/auth/refresh')).length, refresh ? 1 : 0);
    results.push({ scenario: mode + (refresh ? '-refresh' : '-legado'), passed: true });
    if (!refresh) {
      await f.page.getByPlaceholder('voce@exemplo.com').fill(user.email);
      await f.page.getByPlaceholder('Sua senha').fill('senha-ficticia-qa');
      await f.page.getByRole('button', { name: /Entrar/ }).click();
      await f.page.waitForURL(/\/permissoes$/);
      const logged = await values(f.page); preserved(logged); noEnd(f.state);
      assert.equal(logged.authToken, 'principal-selecionado');
      assert.equal(logged.refreshToken, 'refresh-login');
      assert.equal(f.state.calls.filter(c => c.path.endsWith('/auth/definir-estabelecimento')).length, 1);
      results.push({ scenario: 'novo-login-mesmo-usuario-recupera-contexto', passed: true });
    }
    await f.context.close();
  }
  for (const mode of ['503', 'network']) {
    const f = await setup(mode);
    await f.page.getByText('Vamos reconectar seu acesso', { exact: true }).waitFor();
    const saved = await values(f.page); preserved(saved); noEnd(f.state);
    assert.equal(saved.authToken, 'principal-antigo'); assert.equal(saved.refreshToken, 'refresh-antigo');
    f.state.mode = 'good';
    await f.page.getByRole('button', { name: 'Tentar novamente', exact: true }).evaluate(button => { button.click(); button.click(); });
    await f.page.waitForURL(/\/permissoes$/);
    const recovered = await values(f.page); preserved(recovered); noEnd(f.state);
    assert.equal(recovered.authToken, 'principal-renovado'); assert.equal(recovered.refreshToken, 'refresh-renovado');
    assert.equal(f.state.calls.filter(c => c.path.endsWith('/auth/refresh')).length, 2);
    assert.equal(f.state.calls.filter(c => c.path.endsWith('/motoboys/me/vinculos')).length, 3);
    results.push({ scenario: mode + '-retry-sem-perder-turno-e-sem-duplicar-restauracao', passed: true });
    await f.context.close();
  }
  const good = await setup('good');
  await good.page.waitForURL(/\/permissoes$/);
  const renewed = await values(good.page); preserved(renewed); noEnd(good.state);
  assert.equal(renewed.authToken, 'principal-renovado'); assert.equal(renewed.refreshToken, 'refresh-renovado');
  assert.equal(good.state.calls.filter(c => c.path.endsWith('/auth/refresh')).length, 1);
  results.push({ scenario: 'renovacao-automatica-restaura-acesso', passed: true });
  await good.context.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ completed: true, results, errors }, null, 2));
})().catch(error => {
  errors.push(error.message); process.exitCode = 1; console.error(error.message);
}).finally(async () => {
  if (browser) await browser.close();
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ completed: process.exitCode !== 1, results, errors }, null, 2));
});
