// Navegação real do bundle Expo com todas as chamadas externas interceptadas.
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || '../../validacao-etapa1/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8193';
const id = '11111111-1111-1111-1111-111111111111';
const user = { id: 'qa', nome: 'Motoboy QA', email: 'qa@exemplo.com', role: 'motoboy' };
const establishment = { id, nome: 'Loja QA Azul' };
const session = { sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', epoch: 7, isEnded: false, heartbeatIntervalSeconds: 60, version: 1 };
const emptyQueue = { version: 1, current: null, next: [], routeState: 'idle' };
const results = [], errors = []; let browser, completed = false;
async function setup(options = {}) {
  const state = { mode: '', queue: emptyQueue, calls: [], ...options };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: -23.5, longitude: -46.6 } });
  await context.addInitScript(({ dark, active, foreign }) => {
    localStorage.setItem('zippygo.user', JSON.stringify({ id: 'qa', nome: 'Motoboy QA', email: 'qa@exemplo.com', role: 'motoboy' }));
    localStorage.setItem('authToken', 'principal-qa'); localStorage.setItem('zippygo.token', 'principal-qa');
    localStorage.setItem('zippygo.estabelecimentoAtual', JSON.stringify({ id: '11111111-1111-1111-1111-111111111111', nome: 'Loja QA Azul' }));
    localStorage.setItem('zippygo.design.preferences.v1', JSON.stringify({ dark, reducedMotion: true }));
    if (active) {
      localStorage.setItem('operationalAccessToken', 'operacional-qa'); localStorage.setItem('operationalUserId', foreign ? 'outro' : 'qa');
      localStorage.setItem('operationalEstablishmentId', '11111111-1111-1111-1111-111111111111');
      localStorage.setItem('operationalSession', JSON.stringify({ sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', epoch: 7, isEnded: false, heartbeatIntervalSeconds: 60, version: 1 }));
    }
  }, { dark: !!options.dark, active: !!options.active, foreign: !!options.foreign });
  const page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(90000);
  await page.routeWebSocket(/.*/, ws => ws.close());
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
    const record = { method: request.method(), path: url.pathname, body: request.postData() ? JSON.parse(request.postData()) : null };
    state.calls.push(record);
    const ok = data => route.fulfill({ json: { success: true, data } });
    const fail = (status, error, code) => route.fulfill({ status, json: { success: false, error, code } });
    if (state.mode === 'offline' && url.pathname.includes('/v2/motoboys/me/session')) return route.abort('failed');
    if (url.pathname.endsWith('/motoboys/me/vinculos')) return state.mode === 'links-offline' ? route.abort('failed') : ok([{ estabelecimentoId: id, nome: establishment.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo' }]);
    if (url.pathname.endsWith('/auth/login')) return ok({ accessToken: 'principal-qa', refreshToken: 'refresh-qa', user });
    if (url.pathname.endsWith('/auth/definir-estabelecimento')) return ok({ accessToken: 'principal-loja-qa', estabelecimentoSelecionado: establishment });
    if (url.pathname.endsWith('/session') && record.method === 'GET') {
      if (state.mode === 'expired') return fail(401, 'Turno expirado no servidor.', 'SESSION_EXPIRED');
      if (state.mode === 'ended') return ok(null);
      if (state.mode === 'offline') return route.abort('failed');
      return ok(session);
    }
    if (url.pathname.endsWith('/session') && record.method === 'DELETE') {
      if (state.mode === 'end-conflict') return fail(409, 'Existe uma transferência pendente.', 'MOTOBOY_HAS_PENDING_WORK');
      if (state.mode === 'end-offline') return route.abort('failed');
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      return ok(null);
    }
    if (url.pathname.endsWith('/heartbeat')) return ok({ accessToken: 'operacional-qa', session });
    if (url.pathname.endsWith('/queue')) return ok(state.queue);
    return ok(null);
  });
  async function goto(url) {
    await page.goto(base + url);
    await page.waitForFunction(() => [...document.querySelectorAll('button,[role="button"]')].some(el => Object.keys(el).some(key => key.startsWith('__reactProps$'))));
    await page.evaluate(() => document.fonts.ready);
    await page.getByText(/Preparando seu acesso|Conferindo permissões|Preparando seu caminho/).waitFor({ state: 'hidden' }).catch(() => {});
  }
  return { context, page, state, goto };
}
async function snap(page, name) {
  await page.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': sem overflow horizontal');
  await page.screenshot({ path: path.join(__dirname, name + '.png'), fullPage: true });
}
async function openLogout(page) {
  // A nova home chega ao logout pelo perfil/configurações aprovados.
  if (!(await page.getByRole('button', { name: 'Sair da conta', exact: true }).filter({ visible: true }).count())) {
    await page.getByRole('tab', { name: 'Perfil', exact: true }).filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Configurações', exact: true }).filter({ visible: true }).last().click();
  }
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).filter({ visible: true }).click();
  await page.getByText('Até o próximo caminho.', { exact: true }).waitFor();
}
async function hasAuth(page) { return page.evaluate(() => !!localStorage.getItem('authToken') && !!localStorage.getItem('zippygo.user')); }
async function hasTurn(page) { return page.evaluate(() => !!localStorage.getItem('operationalAccessToken')); }
async function main() {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const dark of [false, true]) {
      const qa = await setup({ dark });
      for (const [name, route] of [['permissoes', '/permissoes'], ['permissao-negada', '/permissaoNegada?kind=background'], ['sessao-encerrada', '/sessaoEncerrada']]) {
        await qa.goto(route);
        await snap(qa.page, name + (dark ? '-escuro' : '-claro') + '-390');
        await qa.page.setViewportSize({ width: 320, height: 740 }); await snap(qa.page, name + (dark ? '-escuro' : '-claro') + '-320');
        await qa.page.setViewportSize({ width: 390, height: 844 });
      }
      await qa.goto('/permissoes');
      assert.equal(await qa.page.getByRole('button', { name: 'Ficar online', exact: true }).isDisabled(), true);
      assert.equal(qa.state.calls.filter(call => call.path.endsWith('/start')).length, 0);
      await qa.page.getByRole('button', { name: 'Continuar offline', exact: true }).click();
      await qa.page.waitForURL(base + '/'); await openLogout(qa.page); await snap(qa.page, 'logout' + (dark ? '-escuro' : '-claro'));
      await qa.page.getByRole('button', { name: 'Continuar no app', exact: true }).click();
      assert.ok(await hasAuth(qa.page)); await openLogout(qa.page);
      await qa.page.getByRole('button', { name: 'Sair agora', exact: true }).click();
      await qa.page.getByRole('button', { name: 'Entrar', exact: true }).filter({ visible: true }).waitFor();
      assert.equal(await hasAuth(qa.page), false); assert.equal(await hasTurn(qa.page), false);
      await snap(qa.page, 'login-apos-sair' + (dark ? '-escuro' : '-claro'));
      await qa.page.getByLabel('E-mail', { exact: true }).filter({ visible: true }).fill(user.email);
      await qa.page.getByLabel('Senha', { exact: true }).filter({ visible: true }).fill('Senha@123');
      await qa.page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await qa.page.waitForURL(base + '/permissoes'); assert.ok(await hasAuth(qa.page));
      if (dark) {
        await qa.page.setViewportSize({ width: 320, height: 740 });
        await qa.page.evaluate(() => { for (const el of document.querySelectorAll('[dir="auto"]')) { const css = getComputedStyle(el); el.style.fontSize = parseFloat(css.fontSize) * 1.3 + 'px'; if (css.lineHeight !== 'normal') el.style.lineHeight = parseFloat(css.lineHeight) * 1.3 + 'px'; } });
        await snap(qa.page, 'permissoes-texto-ampliado-320');
      }
      await qa.context.close();
    }
    results.push('Três telas em claro/escuro, 390/320 px e texto ampliado; web explica limitação e não inicia turno; logout/cancelamento pela tela principal; login e preparação conectados');

    const success = await setup({ active: true, delay: 400 }); await success.goto('/permissoes');
    await success.page.getByText('O acompanhamento em segundo plano precisa do app instalado no celular.', { exact: false }).waitFor();
    await openLogout(success.page);
    await success.page.getByRole('button', { name: 'Encerrar turno e sair', exact: true }).click();
    assert.ok(await hasAuth(success.page)); assert.ok(await hasTurn(success.page));
    await success.page.getByRole('button', { name: 'Entrar', exact: true }).filter({ visible: true }).waitFor();
    assert.equal(await hasAuth(success.page), false); assert.equal(await hasTurn(success.page), false);
    assert.equal(success.state.calls.filter(call => call.method === 'DELETE').length, 1);
    await success.context.close();
    results.push('Logout operacional consulta fila, envia um DELETE e só limpa credenciais após ACK');

    for (const mode of ['end-conflict', 'end-offline']) {
      const qa = await setup({ active: true, mode }); await qa.goto('/permissoes'); await openLogout(qa.page);
      await qa.page.getByRole('button', { name: 'Encerrar turno e sair', exact: true }).click();
      await qa.page.getByText('Seu acesso foi mantido', { exact: true }).waitFor();
      assert.ok(await hasAuth(qa.page)); assert.ok(await hasTurn(qa.page));
      assert.equal(qa.state.calls.filter(call => call.method === 'DELETE').length, 1);
      await snap(qa.page, 'logout-' + mode); await qa.context.close();
    }
    const pending = await setup({ active: true, queue: { ...emptyQueue, next: [{ pedido: { id: 'pedido-qa', itens: [] } }] } });
    await pending.goto('/permissoes'); await openLogout(pending.page);
    await pending.page.getByRole('button', { name: 'Encerrar turno e sair', exact: true }).click();
    await pending.page.getByText('Conclua os pedidos e o retorno à loja antes de encerrar seu turno.', { exact: true }).last().waitFor();
    assert.equal(pending.state.calls.filter(call => call.method === 'DELETE').length, 0); assert.ok(await hasTurn(pending.page));
    await pending.context.close();
    results.push('Pendências locais e conflito de transferência no servidor bloqueiam logout; falha de rede preserva acesso e turno');

    for (const mode of ['expired', 'ended']) {
      const qa = await setup({ active: true, mode }); await qa.goto('/');
      await qa.page.waitForURL(base + '/sessaoEncerrada');
      await qa.page.getByText('Vamos retomar de onde você parou.', { exact: true }).waitFor();
      assert.ok(await hasAuth(qa.page)); assert.equal(await hasTurn(qa.page), false);
      assert.equal(qa.state.calls.filter(call => call.path.endsWith('/auth/refresh')).length, 0);
      await qa.page.getByRole('button', { name: 'Revisar e retomar meu turno', exact: true }).click();
      await qa.page.waitForURL(base + '/permissoes'); await qa.context.close();
    }
    results.push('401 operacional e sessão nula abrem recuperação e limpam somente turno; autenticação preservada e nenhum refresh principal');

    const foreign = await setup({ active: true, foreign: true }); await foreign.goto('/permissoes');
    await foreign.page.getByText('O turno salvo pertence a outro acesso ou estabelecimento. Entre com o acesso desse turno para recuperá-lo.', { exact: true }).waitFor();
    assert.equal(foreign.state.calls.filter(call => call.path.includes('/v2/motoboys/me/session')).length, 0); assert.ok(await hasTurn(foreign.page)); await foreign.context.close();
    const offline = await setup({ active: true, mode: 'offline' }); await offline.goto('/permissoes');
    await offline.page.getByText('Não foi possível conectar. Reconecte e tente novamente; seus dados foram preservados.', { exact: true }).waitFor();
    await offline.page.getByRole('button', { name: 'Tentar novamente', exact: true }).waitFor();
    assert.ok(await hasTurn(offline.page)); assert.ok(await hasAuth(offline.page)); await offline.context.close();
    const linksOffline = await setup({ mode: 'links-offline' }); await linksOffline.goto('/');
    await linksOffline.page.getByText('Vamos reconectar seu acesso', { exact: true }).waitFor(); assert.ok(await hasAuth(linksOffline.page));
    await linksOffline.context.close();
    results.push('Token de outro contexto não é usado; restauração sem rede preserva turno e falha de vínculos tem retry em vez de spinner infinito');
    assert.deepEqual(errors, []); completed = true;
  } catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.screenshot({ path: path.join(__dirname, 'diagnostico-falha.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(__dirname, 'diagnostico-falha.json'), JSON.stringify({ url: page.url(), text: await page.locator('body').innerText(), hasAuth: await hasAuth(page), hasTurn: await hasTurn(page) }, null, 2));
    }
    throw error;
  } finally {
    await browser?.close();
    fs.writeFileSync(path.join(__dirname, 'resultado.json'), JSON.stringify({ completed, results, errors }, null, 2));
  }
  console.log(JSON.stringify({ completed, groups: results.length, results, errors }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
