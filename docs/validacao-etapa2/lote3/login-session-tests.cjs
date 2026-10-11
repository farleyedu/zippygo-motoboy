// App Web real, API interceptada. Não encerra contas nem turnos de produção.
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8206';
const output = path.resolve(__dirname, '../../../.expo/validation-login-session');
const sessionA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', sessionB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const shop = { id: '11111111-1111-1111-1111-111111111111', nome: 'Loja QA' };
const results = [], errors = [];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const dark of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await context.addInitScript(dark => localStorage.setItem('zippygo.design.preferences.v1', JSON.stringify({ dark, reducedMotion: true })), dark);
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/.*/, ws => ws.close());
      const logins = []; let expected = sessionA, fail = false, replaced = false;
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!url.pathname.startsWith('/api/')) return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
        const ok = data => route.fulfill({ json: { success: true, data } });
        if (url.pathname.endsWith('/auth/login')) {
          const body = req.postDataJSON(); logins.push(body);
          assert.equal(body.clientApp, 'motoboy'); assert.match(body.clientInstanceId, /^[\da-f-]{36}$/i);
          if (body.confirmSessionReplacement && fail) return route.fulfill({ status: 503, json: { success: false, error: 'Sem conexão com o servidor.' } });
          if (!body.confirmSessionReplacement || body.expectedSessionId !== expected)
            return route.fulfill({ status: 409, json: { success: false, code: 'LOGIN_SESSION_ACTIVE', details: { sessionId: expected } } });
          return ok({ accessToken: 'login-qa', refreshToken: 'refresh-qa', motoboyLoginSessionId: 'nova-sessao-qa', user: { id: 'qa', nome: 'Motoboy QA', email: 'qa@exemplo.com' } });
        }
        if (replaced) return route.fulfill({ status: 401, json: { success: false, code: 'SESSION_REPLACED', error: 'Conta acessada em outro aparelho.' } });
        if (url.pathname.endsWith('/motoboys/me/vinculos')) return ok([{ estabelecimentoId: shop.id, nome: shop.nome, tipoAcesso: 'motoboy' }]);
        if (url.pathname.endsWith('/auth/definir-estabelecimento')) return ok({ accessToken: 'selecionado-qa', refreshToken: 'refresh-selecionado-qa', estabelecimentoSelecionado: shop });
        if (url.pathname.endsWith('/auth/session')) return ok({ active: true });
        return ok(null);
      });
      await page.goto(base + '/login');
      await page.getByPlaceholder('voce@exemplo.com').fill('qa@exemplo.com');
      await page.getByPlaceholder('Sua senha').fill('qa-password-2026');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByText('Já existe uma sessão ativa.', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), null);
      assert.equal(logins.length, 1); assert.equal(logins[0].confirmSessionReplacement, false);
      await page.waitForTimeout(400); // Concluir o fade nativo/Web antes da captura visual.
      await page.screenshot({ path: path.join(output, `aviso-${dark ? 'escuro' : 'claro'}.png`) });
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(logins.length, 1); assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), null);
      results.push({ theme: dark ? 'escuro' : 'claro', scenario: 'aviso e cancelamento preservam o outro aparelho', passed: true });
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByText('Já existe uma sessão ativa.', { exact: true }).waitFor();
      expected = sessionB;
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByText('A sessão ativa mudou. Confira o aviso e confirme novamente.').last().waitFor();
      assert.equal(logins.at(-1).expectedSessionId, sessionA);
      fail = true;
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByText('Sem conexão com o servidor.').last().waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), null);
      fail = false;
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.waitForURL('**/permissoes');
      assert.equal(logins.at(-1).expectedSessionId, sessionB);
      assert.equal(new Set(logins.map(login => login.clientInstanceId)).size, 1);
      assert.equal(await page.evaluate(() => localStorage.getItem('zippygo.loginSessionId')), 'nova-sessao-qa');
      results.push({ theme: dark ? 'escuro' : 'claro', scenario: 'mudança da sessão, falha de rede e confirmação explícita', passed: true });
      replaced = true;
      await page.reload();
      await page.waitForURL('**/login');
      assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), null);
      results.push({ theme: dark ? 'escuro' : 'claro', scenario: 'aparelho substituído volta ao login', passed: true });
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(`${results.length} cenários passaram; nenhum erro JavaScript.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
