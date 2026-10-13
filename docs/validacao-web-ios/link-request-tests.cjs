// App Web real, API interceptada. Não acessa contas nem solicitações de produção.
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8206';
const output = path.resolve(__dirname, '../../.expo/validation-link-request');
const storeId = '11111111-1111-1111-1111-111111111111';
const requestId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const shop = { id: storeId, nome: 'Loja QA', cidade: 'São Paulo', uf: 'SP', modulosAtivos: ['DELIVERY'] };
const results = [], errors = [];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const mode of process.env.QA_LINK_MODE ? [process.env.QA_LINK_MODE] : ['request', 'invite-accept', 'invite-reject']) for (const dark of [false, true]) {
      console.log(`Validando ${mode}, tema ${dark ? 'escuro' : 'claro'}`);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await context.addInitScript(dark => localStorage.setItem('zippygo.design.preferences.v1', JSON.stringify({ dark, reducedMotion: true })), dark);
      const page = await context.newPage(); page.setDefaultTimeout(60000);
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/.*/, ws => ws.close());
      const calls = []; let request = mode === 'request' ? null : { id: requestId, estabelecimentoId: storeId, estabelecimentoNome: shop.nome, status: 'pending', origem: 'estabelecimento', requestedAtUtc: new Date().toISOString() }, links = [], invalidPassword = true;
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!url.pathname.startsWith('/api/')) return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
        const body = req.postData() ? req.postDataJSON() : null;
        calls.push({ method: req.method(), path: url.pathname, body });
        const ok = data => route.fulfill({ json: { success: true, data } });
        if (url.pathname.endsWith('/auth/login')) {
          assert.equal(body.clientApp, 'motoboy');
          if (invalidPassword) return route.fulfill({ status: 401, json: { success: false, error: 'Usuário ou senha inválidos.' } });
          return ok({ accessToken: 'account-qa', refreshToken: 'refresh-qa', motoboyLoginSessionId: 'login-session-qa', user: { id: 'qa', nome: 'Motoboy QA', email: 'qa@exemplo.com' } });
        }
        if (url.pathname.endsWith('/auth/session')) return ok({ active: true });
        if (url.pathname.endsWith('/motoboys/me/vinculos')) return ok(links);
        if (url.pathname.endsWith('/estabelecimentos-disponiveis')) return ok([shop, { ...shop, id: '22222222-2222-2222-2222-222222222222', nome: 'Outra loja QA', cidade: 'Campinas' }]);
        if (url.pathname.endsWith('/vinculos/solicitacoes')) return ok(request ? [request] : []);
        if (/\/convites\/.*\/(aceitar|recusar)$/.test(url.pathname)) {
          assert.equal(links.length, 0, 'O convite pode ser respondido sem vínculo ativo');
          const accepted = url.pathname.endsWith('/aceitar');
          request.status = accepted ? 'approved' : 'rejected';
          if (accepted) links = [{ estabelecimentoId: storeId, nome: shop.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo' }];
          return ok({ requestId, status: request.status });
        }
        if (url.pathname.endsWith('/vinculos/solicitar')) {
          assert.deepEqual(body, { estabelecimentoId: storeId });
          request = { id: requestId, estabelecimentoId: storeId, estabelecimentoNome: shop.nome, status: 'pending', origem: 'motoboy', requestedAtUtc: new Date().toISOString() };
          await new Promise(resolve => setTimeout(resolve, 300));
          return ok(request);
        }
        if (url.pathname.endsWith('/auth/definir-estabelecimento')) {
          assert.equal(links.length, 1, 'Somente vínculo aprovado permite selecionar loja');
          return ok({ accessToken: 'selected-qa', refreshToken: 'selected-refresh-qa', estabelecimentoSelecionado: shop });
        }
        return ok(null);
      });

      await page.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => [...document.querySelectorAll('[role="button"]')].some(element => Object.keys(element).some(key => key.startsWith('__reactProps$'))));
      await page.getByPlaceholder('voce@exemplo.com').fill('qa@exemplo.com');
      await page.getByPlaceholder('Sua senha').fill('senha-qa');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByText('Usuário ou senha inválidos.', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), null);
      invalidPassword = false;
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.waitForURL(base + '/');
      const action = page.getByRole('button', { name: 'Solicitar vínculo', exact: true });
      await action.waitFor();
      assert.equal(await page.getByRole('button', { name: 'Ficar online', exact: true }).count(), 0);
      assert.ok((await action.boundingBox()).height >= 280, 'Solicitar vínculo aparece em cartão grande');
      results.push({ theme: dark ? 'escuro' : 'claro', scenario: 'senha inválida recusada; login sem vínculo abre início com cartão grande', passed: true });

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }); await action.waitFor();
      assert.equal(new URL(page.url()).pathname, '/');
      for (const width of mode === 'request' ? [390, 320] : []) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sem rolagem horizontal');
        const box = await action.boundingBox();
        assert.ok(box.width <= width && box.y + box.height < 700, 'Ação grande permanece visível');
        await page.screenshot({ path: path.join(output, `inicio-${dark ? 'escuro' : 'claro'}-${width}.png`) });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + '/permissoes', { waitUntil: 'domcontentloaded', timeout: 120000 }); await action.waitFor();
      assert.equal(new URL(page.url()).pathname, '/', 'Tela operacional retorna ao início sem vínculo');
      if (mode !== 'request') {
        await page.getByRole('button', { name: 'Convites e vínculos', exact: true }).click();
        await page.getByRole('button', { name: 'Revisar convite', exact: true }).click();
        if (mode === 'invite-accept') {
          await page.getByRole('button', { name: 'Aceitar convite', exact: true }).click();
          await page.getByText('Convite aceito', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Ver meus vínculos', exact: true }).click();
          await page.getByRole('button', { name: 'Trabalhar nesta loja', exact: true }).click();
          await page.waitForFunction(id => JSON.parse(localStorage.getItem('zippygo.estabelecimentoAtual') || 'null')?.id === id, storeId);
        } else {
          await page.getByRole('button', { name: 'Recusar convite', exact: true }).click();
          await page.getByRole('button', { name: 'Confirmar recusa', exact: true }).click();
          await page.getByText('Convite recusado', { exact: true }).waitFor();
          assert.equal(calls.filter(call => call.path.endsWith('/auth/definir-estabelecimento')).length, 0);
        }
        assert.equal(calls.filter(call => /\/convites\/.*\/(aceitar|recusar)$/.test(call.path)).length, 1);
        assert.equal(calls.filter(call => call.method === 'POST' && call.path.endsWith('/session')).length, 0);
        results.push({ theme: dark ? 'escuro' : 'claro', scenario: mode === 'invite-accept' ? 'login sem vínculo para aceitar convite e selecionar a loja' : 'login sem vínculo para recusar convite sem liberar turno', passed: true });
        await context.close();
        continue;
      }
      await action.click();
      await page.getByText('Loja QA', { exact: true }).waitFor();
      await page.getByText('Outra loja QA', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Voltar', exact: true }).click();
      await action.waitFor();
      await action.click();
      await page.getByLabel('Buscar estabelecimento', { exact: true }).filter({ visible: true }).fill('sao paulo');
      await page.getByText('Loja QA', { exact: true }).waitFor();
      assert.equal(await page.getByText('Outra loja QA', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Solicitar vínculo', exact: true }).click();
      await page.getByText('Aguardando aprovação', { exact: true }).waitFor();
      assert.equal(calls.filter(call => call.path.endsWith('/vinculos/solicitar')).length, 1);
      assert.equal(calls.filter(call => call.path.endsWith('/auth/definir-estabelecimento')).length, 0);
      results.push({ theme: dark ? 'escuro' : 'claro', scenario: 'restauração, proteção do turno, busca de lojas e solicitação pendente', passed: true });

      request.status = 'rejected'; request.rejectionReason = 'Equipe completa no momento.';
      await page.getByRole('button', { name: 'Atualizar status', exact: true }).click();
      await page.getByText('Equipe completa no momento.', { exact: true }).waitFor();
      assert.equal(calls.filter(call => call.path.endsWith('/auth/definir-estabelecimento')).length, 0);
      request.status = 'approved';
      await page.getByRole('button', { name: 'Atualizar status', exact: true }).click();
      await page.getByText('A aprovação foi registrada. Atualize os vínculos para conferir se a loja continua disponível.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Selecionar estabelecimento', exact: true }).count(), 0);
      links = [{ estabelecimentoId: storeId, nome: shop.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo' }];
      await page.getByRole('button', { name: 'Atualizar status', exact: true }).click();
      await page.getByRole('button', { name: 'Selecionar estabelecimento', exact: true }).click();
      await page.getByRole('button', { name: 'Trabalhar nesta loja', exact: true }).click();
      await page.waitForFunction(id => JSON.parse(localStorage.getItem('zippygo.estabelecimentoAtual') || 'null')?.id === id, storeId);
      assert.equal(calls.filter(call => call.path.endsWith('/auth/definir-estabelecimento')).length, 1);
      assert.equal(calls.filter(call => call.method === 'POST' && call.path.endsWith('/session')).length, 0);
      results.push({ theme: dark ? 'escuro' : 'claro', scenario: 'recusa, aprovação sem vínculo ainda bloqueada e seleção após vínculo ativo', passed: true });
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(`${results.length} cenários passaram; nenhum erro JavaScript.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
