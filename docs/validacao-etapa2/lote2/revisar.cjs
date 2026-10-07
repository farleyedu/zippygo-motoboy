const { chromium } = require('../../validacao-etapa1/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8192';
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
const IA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', IB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const store = (id, nome, cidade) => ({ id, nome, cidade, uf: 'SP', modulosAtivos: ['DELIVERY'] });
const link = (id, nome) => ({ estabelecimentoId: id, nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo' });
const req = (id, loja, nome, status, origem = 'motoboy') => ({ id, estabelecimentoId: loja, estabelecimentoNome: nome, status, origem, requestedAtUtc: '2026-10-07T12:00:00Z', rejectionReason: status === 'rejected' ? 'Equipe completa no momento.' : null });
const stores = [store(A, 'Loja QA A', 'São Paulo'), store(B, 'Loja QA B', 'Campinas'), store(C, 'Loja QA C', 'Santos')];
const results = [], requests = [], errors = []; let browser, completed = false;
async function setup(options = {}) {
  const state = { links: [link(A, 'Loja QA A'), link(B, 'Loja QA B')], stores, requests: [req(IA, C, 'Loja QA C', 'pending', 'estabelecimento')], mode: '', delay: 0, ...options };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ dark, seed }) => {
    localStorage.setItem('zippygo.user', JSON.stringify({ id: 'qa', nome: 'Motoboy QA', email: 'qa@exemplo.com', role: 'motoboy' }));
    localStorage.setItem('authToken', 'token-qa');
    localStorage.setItem('zippygo.design.preferences.v1', JSON.stringify({ dark, reducedMotion: true }));
    for (const [key, value] of Object.entries(seed || {})) localStorage.setItem(key, value);
  }, { dark: !!options.dark, seed: options.seed });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return url.origin === base ? route.continue() : route.abort();
    const record = { method: request.method(), path: url.pathname, body: request.postData() ? JSON.parse(request.postData()) : null };
    requests.push(record);
    const ok = data => route.fulfill({ json: { success: true, data } });
    const fail = (status, error) => route.fulfill({ status, json: { success: false, error } });
    if (url.pathname.endsWith('/me/estabelecimentos')) return ok(state.links);
    if (url.pathname.endsWith('/estabelecimentos-disponiveis')) return state.mode === 'load-error' ? fail(503, 'Lista temporariamente indisponível.') : ok(state.stores);
    if (url.pathname.endsWith('/vinculos/solicitacoes')) return ok(state.requests);
    if (url.pathname.endsWith('/auth/definir-estabelecimento')) {
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.mode === 'selection-error') return fail(403, 'Vínculo indisponível.');
      const item = state.links.find(link => link.estabelecimentoId === record.body.estabelecimentoId);
      return ok({ accessToken: 'token-loja', refreshToken: 'refresh-loja', estabelecimentoSelecionado: { id: state.mode === 'wrong-selection' ? A : item.estabelecimentoId, nome: item.nome } });
    }
    if (url.pathname.endsWith('/vinculos/solicitar')) {
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.mode === 'request-error') return fail(409, 'O vínculo mudou. Atualize a lista.');
      const item = state.stores.find(store => store.id === record.body.estabelecimentoId);
      const created = req(IB, item.id, item.nome, 'pending');
      state.requests.unshift(created); return ok(created);
    }
    if (/\/convites\/.*\/aceitar$/.test(url.pathname) || /\/convites\/.*\/recusar$/.test(url.pathname)) {
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.mode === 'invite-error') return fail(404, 'Convite pendente não encontrado.');
      const id = url.pathname.split('/').at(-2), item = state.requests.find(item => item.id === id);
      item.status = url.pathname.endsWith('/aceitar') ? 'approved' : 'rejected';
      if (item.status === 'approved') state.links.push(link(item.estabelecimentoId, item.estabelecimentoNome));
      return ok({ requestId: id, status: item.status });
    }
    if (url.pathname.endsWith('/queue')) return ok({ current: null, next: [], version: 1, routeState: 'idle' });
    return ok(null);
  });
  async function goto(url) {
    const ready = page.waitForResponse(response => new URL(response.url()).pathname === '/api/Motoboy', { timeout: 120000 });
    await page.goto(base + url); await ready;
    await page.getByText(/Carregando seus vínculos|Buscando estabelecimentos|Consultando solicitações|Consultando convite/).waitFor({ state: 'hidden' }).catch(() => {});
  }
  return { state, context, page, goto };
}
async function snap(page, name) {
  await page.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': sem overflow');
  await page.screenshot({ path: path.join(__dirname, name + '.png'), fullPage: true });
}
async function main() {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const visualPaths = [['stores', '/selecionarRestaurante'], ['link', '/solicitarRestaurante'], ['status', '/solicitacoesVinculo?id=' + IA], ['invite', '/convite/' + IA]];
    for (const dark of [false, true]) {
      const qa = await setup({ dark });
      for (const [name, url] of visualPaths) {
        await qa.goto(url); await snap(qa.page, name + (dark ? '-escuro' : '-claro') + '-390');
        await qa.page.setViewportSize({ width: 320, height: 740 }); await snap(qa.page, name + (dark ? '-escuro' : '-claro') + '-320');
        await qa.page.setViewportSize({ width: 390, height: 844 });
      }
      if (dark) {
        await qa.goto('/selecionarRestaurante'); await qa.page.setViewportSize({ width: 320, height: 740 });
        await qa.page.evaluate(() => { for (const el of document.querySelectorAll('[dir="auto"]')) { const css = getComputedStyle(el); el.style.fontSize = (parseFloat(css.fontSize) * 1.3) + 'px'; if (css.lineHeight !== 'normal') el.style.lineHeight = (parseFloat(css.lineHeight) * 1.3) + 'px'; } });
        await snap(qa.page, 'stores-texto-ampliado-320');
      }
      await qa.context.close();
    }
    results.push('Quatro telas em claro/escuro, 390/320 px, movimento reduzido e texto ampliado sem overflow');

    const selection = await setup({ delay: 400 });
    await selection.goto('/selecionarRestaurante');
    const initialCount = requests.filter(item => item.path.endsWith('/definir-estabelecimento')).length;
    await selection.page.getByRole('button', { name: 'Selecionar Loja QA B', exact: true }).click();
    assert.equal(requests.filter(item => item.path.endsWith('/definir-estabelecimento')).length, initialCount);
    await selection.page.getByRole('button', { name: 'Trabalhar nesta loja', exact: true }).click();
    assert.equal(await selection.page.getByRole('button', { name: 'Trabalhar nesta loja', exact: true }).isDisabled(), true);
    await selection.page.waitForURL(base + '/');
    assert.equal(requests.filter(item => item.path.endsWith('/definir-estabelecimento')).length, initialCount + 1);
    assert.equal(await selection.page.evaluate(() => JSON.parse(localStorage.getItem('zippygo.estabelecimentoAtual')).id), B);
    await selection.context.close();
    const active = await setup({ seed: { 'zippygo.estabelecimentoAtual': JSON.stringify({ id: A, nome: 'Loja QA A' }), operationalAccessToken: 'operacional-qa', operationalSession: JSON.stringify({ isEnded: false }), trackingMode: 'active_route' } });
    await active.goto('/selecionarRestaurante');
    const before = requests.filter(item => item.path.endsWith('/definir-estabelecimento')).length;
    await active.page.getByRole('button', { name: 'Selecionar Loja QA B', exact: true }).click();
    await active.page.getByRole('button', { name: 'Trabalhar nesta loja', exact: true }).click();
    await active.page.getByText('Encerre ou recupere seu turno atual antes de trocar de estabelecimento.', { exact: true }).waitFor();
    assert.equal(requests.filter(item => item.path.endsWith('/definir-estabelecimento')).length, before);
    assert.equal(await active.page.evaluate(() => JSON.parse(localStorage.getItem('zippygo.estabelecimentoAtual')).id), A);
    await snap(active.page, 'troca-bloqueada');
    await active.context.close();
    results.push('Seleção local não envia POST; confirmação envia uma vez; troca com contexto operacional bloqueada e loja/token preservados');

    const search = await setup({ links: [], requests: [], stores: [...stores, { ...store('admin', 'Loja sem DELIVERY', 'São Paulo'), modulosAtivos: ['ATENDIMENTO'] }], delay: 400 });
    await search.goto('/solicitarRestaurante');
    assert.equal(await search.page.getByText('Loja sem DELIVERY', { exact: true }).count(), 0);
    await search.page.getByLabel('Buscar estabelecimento', { exact: true }).filter({ visible: true }).fill('sao paulo');
    await search.page.getByText('Loja QA A', { exact: true }).waitFor();
    assert.equal(await search.page.getByText('Loja QA B', { exact: true }).count(), 0);
    await search.page.getByLabel('Buscar estabelecimento', { exact: true }).filter({ visible: true }).fill('inexistente');
    await search.page.getByText('Nenhuma loja encontrada', { exact: true }).waitFor();
    await search.page.getByLabel('Buscar estabelecimento', { exact: true }).filter({ visible: true }).fill('Santos');
    const prior = requests.filter(item => item.path.endsWith('/vinculos/solicitar')).length;
    await search.page.getByRole('button', { name: 'Solicitar vínculo', exact: true }).click();
    assert.equal(await search.page.getByRole('button', { name: 'Solicitar vínculo', exact: true }).isDisabled(), true);
    await search.page.waitForURL('**/solicitacoesVinculo?id=' + IB);
    await search.page.getByText('Aguardando aprovação', { exact: true }).waitFor();
    const sent = requests.filter(item => item.path.endsWith('/vinculos/solicitar'));
    assert.equal(sent.length, prior + 1); assert.deepEqual(sent.at(-1).body, { estabelecimentoId: C });
    await snap(search.page, 'solicitacao-pendente');
    search.state.requests[0].status = 'rejected'; search.state.requests[0].rejectionReason = 'Equipe completa no momento.';
    await search.page.getByRole('button', { name: 'Atualizar status', exact: true }).click();
    await search.page.getByText('Equipe completa no momento.', { exact: true }).waitFor();
    await snap(search.page, 'solicitacao-recusada');
    search.state.requests[0].status = 'approved';
    await search.page.getByRole('button', { name: 'Atualizar status', exact: true }).click();
    await search.page.getByText('A aprovação foi registrada. Atualize os vínculos para conferir se a loja continua disponível.', { exact: true }).waitFor();
    assert.equal(await search.page.getByRole('button', { name: 'Selecionar estabelecimento', exact: true }).count(), 0);
    search.state.links = [link(C, 'Loja QA C')];
    await search.page.getByRole('button', { name: 'Atualizar status', exact: true }).click();
    await search.page.getByRole('button', { name: 'Selecionar estabelecimento', exact: true }).waitFor();
    await snap(search.page, 'solicitacao-aprovada');
    await search.context.close();
    results.push('Busca por cidade sem acento, sem resultados e filtro DELIVERY; solicitação única; pendente/recusada/aprovada; aprovação sem vínculo não libera seleção');

    for (const accept of [true, false]) {
      const invite = await setup({ links: [], delay: 400 });
      await invite.goto('/convite/' + IA);
      const count = requests.filter(item => /\/convites\/.*\/(aceitar|recusar)$/.test(item.path)).length;
      if (!accept) {
        await invite.page.getByRole('button', { name: 'Recusar convite', exact: true }).click();
        await invite.page.getByRole('button', { name: 'Manter convite', exact: true }).click();
        assert.equal(requests.filter(item => /\/convites\/.*\/(aceitar|recusar)$/.test(item.path)).length, count);
        await invite.page.getByRole('button', { name: 'Recusar convite', exact: true }).click();
      }
      const action = accept ? 'Aceitar convite' : 'Confirmar recusa';
      await invite.page.getByRole('button', { name: action, exact: true }).click();
      assert.equal(await invite.page.getByRole('button', { name: action, exact: true }).isDisabled(), true);
      await invite.page.getByText(accept ? 'Convite aceito' : 'Convite recusado', { exact: true }).waitFor();
      assert.equal(requests.filter(item => /\/convites\/.*\/(aceitar|recusar)$/.test(item.path)).length, count + 1);
      await snap(invite.page, accept ? 'convite-aceito' : 'convite-recusado');
      await invite.context.close();
    }
    results.push('Convite: aceite após servidor; recusa com confirmação/cancelamento; ações bloqueadas durante envio e sem duplicidade');

    const fail = await setup({ mode: 'load-error' });
    await fail.goto('/solicitarRestaurante');
    await fail.page.getByText('Lista temporariamente indisponível.', { exact: true }).waitFor();
    await snap(fail.page, 'lista-erro');
    fail.state.mode = '';
    await fail.page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await fail.page.getByText('Loja QA C', { exact: true }).waitFor();
    fail.state.requests = [];
    await fail.goto('/solicitarRestaurante');
    await fail.page.getByLabel('Buscar estabelecimento', { exact: true }).filter({ visible: true }).fill('Santos');
    fail.state.mode = 'request-error';
    await fail.page.getByRole('button', { name: 'Solicitar vínculo', exact: true }).click();
    await fail.page.getByText('O vínculo mudou. Atualize a lista.', { exact: true }).waitFor();
    assert.equal(fail.state.requests.length, 0);
    fail.state.mode = '';
    await fail.page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await fail.page.getByRole('button', { name: 'Solicitar vínculo', exact: true }).waitFor();
    fail.state.requests = [req(IA, C, 'Loja QA C', 'pending', 'estabelecimento')];
    await fail.goto('/convite/' + IA); fail.state.mode = 'invite-error';
    await fail.page.getByRole('button', { name: 'Aceitar convite', exact: true }).click();
    await fail.page.getByText('Convite pendente não encontrado.', { exact: true }).waitFor();
    assert.equal(await fail.page.getByText('Convite aceito', { exact: true }).count(), 0);
    fail.state.requests[0].status = 'approved'; fail.state.mode = '';
    await fail.page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await fail.page.getByText('Este convite já foi respondido', { exact: true }).waitFor();
    await fail.context.close();
    const wrong = await setup({ mode: 'wrong-selection' });
    await wrong.goto('/selecionarRestaurante');
    await wrong.page.getByRole('button', { name: 'Selecionar Loja QA B', exact: true }).click();
    await wrong.page.getByRole('button', { name: 'Trabalhar nesta loja', exact: true }).click();
    await wrong.page.getByText('A seleção não foi confirmada pelo servidor. Atualize os vínculos e tente novamente.', { exact: true }).waitFor();
    assert.equal(await wrong.page.evaluate(() => localStorage.getItem('authToken')), 'token-qa');
    await wrong.context.close();
    const empty = await setup({ links: [], stores: [], requests: [] });
    await empty.goto('/selecionarRestaurante'); await empty.page.getByText('Encontre sua equipe.', { exact: true }).waitFor();
    await snap(empty.page, 'sem-vinculos');
    await empty.goto('/convite/inexistente'); await empty.page.getByText('Convite não encontrado', { exact: true }).waitFor();
    await empty.context.close();
    results.push('Indisponibilidade/retry; convite já respondido/404 sem sucesso fictício; seleção com ID errado não troca token; sem vínculos e convite ausente');

    const late = await setup({ links: [], delay: 1200 });
    await late.goto('/selecionarRestaurante');
    await late.page.getByRole('button', { name: 'Revisar convite', exact: true }).click();
    await late.page.getByRole('button', { name: 'Aceitar convite', exact: true }).waitFor();
    const reply = late.page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/aceitar'));
    await late.page.getByRole('button', { name: 'Aceitar convite', exact: true }).click();
    await late.page.goBack();
    await late.page.getByRole('heading', { name: 'Onde vamos hoje?', exact: true }).waitFor();
    await reply;
    assert.equal(await late.page.getByText('Convite aceito', { exact: true }).filter({ visible: true }).count(), 0);
    await late.context.close();
    results.push('Resposta de convite após sair da tela não apresenta confirmação na tela seguinte');
    assert.deepEqual(errors, []); completed = true;
  } finally {
    fs.writeFileSync(path.join(__dirname, 'resultado.json'), JSON.stringify({ completed, ambiente: 'Exportação Expo Web local; Chrome headless; API interceptada; sem dados reais', results, requests, errors }, null, 2));
    console.log(JSON.stringify({ completed, results, errors }, null, 2));
    if (browser) await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
