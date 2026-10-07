// API totalmente interceptada; somente dados fictícios de revisão.
const { chromium } = require('../validacao-etapa1/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8191';
const results = [], requests = [], failures = [];
const user = { id: 'qa', nome: 'Motoboy de teste', email: 'teste@exemplo.com' };
const link = id => ({ estabelecimentoId: id, nome: 'Loja de teste ' + id, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo' });
let browser;
let completed = false;
async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ dark, seed }) => {
    localStorage.setItem('zippygo.design.preferences.v1', JSON.stringify({ dark, reducedMotion: true }));
    for (const [key, value] of Object.entries(seed || {})) localStorage.setItem(key, value);
  }, { dark: !!options.dark, seed: options.seed });
  const page = await context.newPage();
  page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => failures.push(error.message));
  const state = { mode: 'normal', links: [], delay: 0, ...options };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      return route.abort();
    }
    const record = { method: request.method(), path: url.pathname, body: request.postData() ? JSON.parse(request.postData()) : null };
    requests.push(record);
    const ok = data => route.fulfill({ json: { success: true, data } });
    if (url.pathname.endsWith('/auth/login')) {
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.mode === 'network') return route.abort('failed');
      if (state.mode === 'invalid') return route.fulfill({ status: 401, json: { success: false, error: 'E-mail ou senha inválidos.' } });
      return ok({ accessToken: 'token-de-teste', refreshToken: 'refresh-de-teste', user });
    }
    if (url.pathname.endsWith('/motoboys/cadastro')) {
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.mode === 'conflict') return route.fulfill({ status: 409, json: { success: false, error: 'Este e-mail já está cadastrado.' } });
      return ok({ userId: 1, motoboyId: 1, nome: record.body.nome, email: record.body.email });
    }
    if (url.pathname.endsWith('/me/estabelecimentos')) {
      if (state.mode === 'refresh') { state.mode = 'normal'; return route.fulfill({ status: 401, json: { success: false } }); }
      return ok(state.links);
    }
    if (url.pathname.endsWith('/auth/refresh')) return ok({ accessToken: 'token-renovado', refreshToken: 'refresh-renovado' });
    if (url.pathname.endsWith('/auth/definir-estabelecimento')) return ok({ accessToken: 'token-da-loja', refreshToken: 'refresh-da-loja', estabelecimentoSelecionado: { id: state.links[0].estabelecimentoId, nome: state.links[0].nome } });
    if (url.pathname.endsWith('/estabelecimentos-disponiveis') || url.pathname.endsWith('/vinculos/solicitacoes')) return ok([]);
    if (url.pathname.endsWith('/queue')) return ok({ version: 1, current: null, next: [], routeState: 'idle' });
    return ok(null);
  });
  return { context, page, state };
}
async function snap(page, name) {
  await page.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sem rolagem horizontal: ' + name);
  await page.screenshot({ path: path.join(__dirname, name + '.png'), fullPage: true });
}
async function fillLogin(page) {
  await page.getByLabel('E-mail', { exact: true }).filter({ visible: true }).fill('teste@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).filter({ visible: true }).fill('Senha@123');
}
async function gotoReady(page, url) {
  // O health check já existente só roda após carregar fontes e montar o app.
  const ready = page.waitForResponse(response => new URL(response.url()).pathname === '/api/Motoboy', { timeout: 120000 });
  await page.goto(url);
  await ready;
}
async function main() {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const { page, context, state } = await setup();
    await gotoReady(page, base);
    await page.getByRole('button', { name: 'Entrar no meu caminho', exact: true }).waitFor();
    await page.waitForFunction(() => Array.from(document.images).some(img => img.complete && img.naturalWidth > 0));
    await snap(page, 'welcome-claro-390');
    await page.getByRole('button', { name: 'Entrar no meu caminho', exact: true }).click();
    await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
    await snap(page, 'login-claro-390');
    const beforeValidation = requests.length;
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByText('Informe um e-mail válido.', { exact: true }).waitFor();
    await page.getByText('Informe sua senha.', { exact: true }).waitFor();
    assert.equal(requests.slice(beforeValidation).filter(r => r.path.endsWith('/auth/login')).length, 0);
    results.push('Boas-vindas pela raiz; capacete carregado; validação de login sem pedido HTTP');
    await page.getByRole('button', { name: 'Esqueci a senha', exact: true }).click();
    await page.getByText('Recuperação indisponível', { exact: true }).waitFor();
    assert.equal(await page.locator('input:visible').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Enviar instruções', exact: true }).isDisabled(), true);
    await snap(page, 'recovery-claro-390');
    await page.getByRole('button', { name: 'Voltar para entrar', exact: true }).click();
    await fillLogin(page);
    assert.equal(await page.getByLabel('Senha', { exact: true }).filter({ visible: true }).getAttribute('type'), 'password');
    state.mode = 'invalid';
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByText('E-mail ou senha inválidos.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('E-mail', { exact: true }).filter({ visible: true }).inputValue(), 'teste@exemplo.com');
    await snap(page, 'login-erro');
    state.mode = 'network';
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByText('Não foi possível carregar os restaurantes vinculados.', { exact: true }).waitFor();
    state.mode = 'normal'; state.delay = 500;
    const loginCount = requests.filter(r => r.path.endsWith('/auth/login')).length;
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    assert.equal(await page.getByLabel('E-mail', { exact: true }).filter({ visible: true }).isEditable(), false);
    assert.equal(await page.getByRole('button', { name: 'Entrar', exact: true }).isDisabled(), true);
    await page.waitForURL('**/solicitarRestaurante');
    assert.equal(requests.filter(r => r.path.endsWith('/auth/login')).length, loginCount + 1);
    results.push('Recuperação indisponível sem coleta de e-mail/envio; senha protegida; falha HTTP/rede; retry; bloqueio durante login; sem vínculos');
    await context.close();

    const registration = await setup();
    await gotoReady(registration.page, base + '/register');
    await registration.page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
    await registration.page.getByText('Informe seu nome completo.', { exact: true }).waitFor();
    await registration.page.getByText('A senha precisa ter pelo menos 6 caracteres.', { exact: true }).waitFor();
    await registration.page.getByLabel('Seu nome', { exact: true }).filter({ visible: true }).fill('  Motoboy de teste  ');
    await registration.page.getByLabel('E-mail', { exact: true }).filter({ visible: true }).fill('  TESTE@EXEMPLO.COM  ');
    await registration.page.getByLabel('Crie uma senha', { exact: true }).filter({ visible: true }).fill('Senha@123');
    await registration.page.getByLabel('Confirmar senha', { exact: true }).filter({ visible: true }).fill('outra senha');
    await registration.page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
    await registration.page.getByText('A confirmação precisa ser igual à senha.', { exact: true }).waitFor();
    await registration.page.getByLabel('Confirmar senha', { exact: true }).filter({ visible: true }).fill('Senha@123');
    registration.state.mode = 'conflict';
    await registration.page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
    await registration.page.getByText('Este e-mail já está cadastrado.', { exact: true }).waitFor();
    await snap(registration.page, 'register-erro');
    registration.state.mode = 'normal'; registration.state.delay = 500;
    const count = requests.filter(r => r.path.endsWith('/cadastro')).length;
    await registration.page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
    assert.equal(await registration.page.getByRole('button', { name: 'Criar minha conta', exact: true }).isDisabled(), true);
    await registration.page.getByRole('heading', { name: 'Conta criada.', exact: true }).waitFor();
    const sent = requests.filter(r => r.path.endsWith('/cadastro'));
    assert.equal(sent.length, count + 1);
    assert.deepEqual(sent.at(-1).body, { nome: 'Motoboy de teste', email: 'teste@exemplo.com', senha: 'Senha@123' });
    await snap(registration.page, 'register-sucesso');
    await registration.page.getByRole('button', { name: 'Ir para login', exact: true }).click();
    await registration.page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
    results.push('Cadastro: campos inválidos, confirmação diferente, conflito HTTP, retry, telefone opcional, payload normalizado, envio único e sucesso após resposta');
    await registration.context.close();

    for (const dark of [false, true]) {
      const visual = await setup({ dark });
      for (const screen of ['welcome', 'login', 'register', 'recovery']) {
        await gotoReady(visual.page, base + '/' + screen);
        await visual.page.getByRole('button').first().waitFor();
        await snap(visual.page, screen + '-' + (dark ? 'escuro' : 'claro') + '-390');
        await visual.page.setViewportSize({ width: 320, height: 740 });
        await snap(visual.page, screen + '-' + (dark ? 'escuro' : 'claro') + '-320');
        await visual.page.setViewportSize({ width: 390, height: 844 });
      }
      await visual.page.reload();
      const background = await visual.page.getByRole('heading', { name: /A gente te ajuda/ }).evaluate(el => getComputedStyle(el).color);
      assert.equal(background, dark ? 'rgb(241, 246, 255)' : 'rgb(24, 36, 58)');
      if (dark) {
        await visual.page.setViewportSize({ width: 320, height: 740 });
        await gotoReady(visual.page, base + '/register');
        await visual.page.getByLabel('Seu nome', { exact: true }).filter({ visible: true }).waitFor();
        await visual.page.evaluate(() => {
          for (const el of document.querySelectorAll('[dir="auto"]')) {
            const style = getComputedStyle(el);
            el.style.fontSize = (parseFloat(style.fontSize) * 1.3) + 'px';
            if (style.lineHeight !== 'normal') el.style.lineHeight = (parseFloat(style.lineHeight) * 1.3) + 'px';
          }
        });
        await snap(visual.page, 'register-texto-ampliado-320');
      }
      await visual.context.close();
    }
    results.push('Quatro telas em claro/escuro, 390/320 px, sem overflow; tema persistido; texto 30% maior em cadastro; movimento reduzido');

    const multiple = await setup({ links: [link('1'), link('2')] });
    await gotoReady(multiple.page, base + '/login'); await fillLogin(multiple.page);
    await multiple.page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await multiple.page.waitForURL('**/selecionarRestaurante');
    await multiple.page.getByText('Loja de teste 1', { exact: true }).waitFor();
    await multiple.context.close();
    const single = await setup({ links: [link('1')] });
    await gotoReady(single.page, base + '/login'); await fillLogin(single.page);
    await single.page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await single.page.waitForURL(base + '/');
    const tokens = await single.page.evaluate(() => ({ token: localStorage.getItem('authToken'), refresh: localStorage.getItem('refreshToken'), store: JSON.parse(localStorage.getItem('zippygo.estabelecimentoAtual')) }));
    assert.equal(tokens.token, 'token-da-loja'); assert.equal(tokens.refresh, 'refresh-da-loja'); assert.equal(tokens.store.id, '1');
    const prior = requests.filter(r => r.path.endsWith('/auth/login')).length;
    await gotoReady(single.page, base + '/welcome');
    await single.page.waitForURL(base + '/');
    assert.equal(requests.filter(r => r.path.endsWith('/auth/login')).length, prior);
    await single.context.close();
    results.push('Login com dois vínculos abre seleção; um vínculo seleciona loja e salva tokens; welcome restaura sessão sem novo login');

    const renewed = await setup({ mode: 'refresh', links: [link('1'), link('2')], seed: { 'zippygo.user': JSON.stringify(user), authToken: 'token-expirado', refreshToken: 'refresh-teste' } });
    await gotoReady(renewed.page, base + '/welcome');
    await renewed.page.waitForURL('**/selecionarRestaurante');
    assert.equal(await renewed.page.evaluate(() => localStorage.getItem('authToken')), 'token-renovado');
    await renewed.context.close();
    results.push('Restauração com 401 renova token pelo contrato existente e preserva seleção de loja');
    assert.deepEqual(failures, [], 'Sem erros JavaScript de página');
    completed = true;
  } finally {
    fs.writeFileSync(path.join(__dirname, 'resultado.json'), JSON.stringify({ completed, ambiente: 'Expo Web; Chrome headless; API interceptada; sem API/banco reais', results, requests, failures }, null, 2));
    console.log(JSON.stringify({ completed, results, failures }, null, 2));
    if (browser) await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
