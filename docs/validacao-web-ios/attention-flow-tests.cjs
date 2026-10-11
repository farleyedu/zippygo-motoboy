// Bundle real com API/GPS controlados. O teclado é simulado pelo visualViewport;
// Chromium/WebKit de desktop não comprovam o teclado ou o zoom do iPhone físico.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const dist = path.resolve(__dirname, '../../dist'), engine = process.env.QA_BROWSER || 'chromium';
const shop = { id: '11111111-1111-4111-8111-111111111111', nome: 'Loja QA' };
const user = { id: '7', nome: 'Motoboy QA', role: 'motoboy', email: 'qa@exemplo.invalid' };
const session = { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', epoch: 1, origin: 'mobile', clientPlatform: 'web',
  startedAtUtc: new Date().toISOString(), isEnded: false, version: 1, heartbeatIntervalSeconds: 25,
  presenceExpiresAtUtc: new Date(Date.now() + 43200000).toISOString() };
const calls = [], result = { engine, cases: [], errors: [] };
const reportPrefix = process.env.QA_OFFER_ONLY ? 'offer-review' : 'attention-flow';
async function capture(name) { if (process.env.QA_CAPTURE_DIR) {
  if (process.env.QA_CAPTURE_ONLY && !name.startsWith(process.env.QA_CAPTURE_ONLY)) return;
  if (name.startsWith('inicio-pins')) await page.getByRole('button', { name: 'Abrir pedidos no mapa', exact: true }).evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  if (name.startsWith('oferta')) await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  if (name.startsWith('oferta')) {
    const details = await page.getByText(/^R\$\s*(20|12),00$/).first().evaluate(el => {
      const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const styles = getComputedStyle(el);
      return { text: el.textContent, rect: rect(el), parent: rect(el.parentElement), font: styles.fontFamily, textAlign: styles.textAlign, scrollLeft: el.scrollLeft, parentScrollLeft: el.parentElement.scrollLeft };
    });
    (result.visualDetails ||= []).push({ name, ...details });
  }
  await page.screenshot({ path: path.join(process.env.QA_CAPTURE_DIR, `${engine}-${name}.png`) });
} }
let browser, page, mode = 'pickup', attention = false, requirements = false, returned = false, rejectPickupOnce = false;
let routeStudy = false, offered = false, offerAccepted = false, queueVersion = 3, proofRequired = true, failCompletion = false;
let receipt = null, pendingOnly = false, failResumeOnce = false, offerIds = [31];
let offerExpiresAtUtc = new Date(Date.now() + 60000).toISOString();
function startOffer() { offered = true; offerExpiresAtUtc = new Date(Date.now() + 60000).toISOString(); }
const offerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const chatMessages = () => Array.from({ length: 25 }, (_, i) => ({ id: `qa-message-${i}`, sequence: i + 1, channel: 'store', threadKey: 'store',
  body: i === 24 ? 'Última mensagem visível' : `Mensagem da conversa ${i + 1}`, senderName: 'Loja QA', senderKey: 'operator:qa',
  mine: false, createdAtUtc: new Date(Date.now() - (25 - i) * 1000).toISOString(), readCount: 1, read: true, mentioned: false, mentions: [], reactions: [], type: 'text', status: 'delivered' }));
const order = id => ({ id, nomeCliente: 'Cliente ' + id, total: 30, pago: true, enderecoEntrega: id >= 31 ? 'Rua da oferta, ' + id : 'Rua QA, 123', latitude: id === 24 ? -18.926 : id === 31 ? -18.921 : id === 32 ? -18.924 : -18.918, longitude: id === 24 ? -48.232 : id === 31 ? -48.235 : id === 32 ? -48.242 : -48.24,
  pickedUpAtUtc: mode === 'pickup' ? null : new Date().toISOString(),
  isCurrent: id === 23, isOffer: id === 31, itens: [{ nome: 'Pizza QA', quantidade: 2, adicionais: [] }], statusPagamento: 'pago',
  checklist: { version: 'v' + id + (attention ? '-attention' : ''), detailsUnavailable: false, requiresExtraRecheck: attention,
    items: [{ key: 'p' + id, name: 'Pizza', quantity: 2, extra: false },
      { key: 'a' + id, name: 'Refrigerante', quantity: 4, parentName: 'Pizza', extra: attention }] } });
const queue = () => ({ motoboyId: 1, estabelecimentoId: shop.id, version: queueVersion,
  current: returned || pendingOnly ? null : { pedidoId: 23, position: 1, status: mode === 'pickup' ? 'assigned' : 'arrived',
    pickedUpAtUtc: order(23).pickedUpAtUtc, arrivedAtUtc: mode === 'delivery' && !routeStudy ? new Date().toISOString() : null, pedido: order(23) },
  next: [...(pendingOnly ? [{ pedidoId: 23, position: 1, status: 'assigned', pedido: order(23) }] : []), ...(mode === 'pickup' || routeStudy ? [{ pedidoId: 24, position: 2, status: 'assigned', pedido: order(24) }] : []), ...(offerAccepted ? [{ pedidoId: 31, position: 3, status: 'assigned', pedido: order(31) }] : [])],
  offer: offered ? { offerId, expiresAtUtc: offerExpiresAtUtc, stops: offerIds.map((id, index) => ({ pedidoId: id, position: 3 + index, status: 'offered', pedido: order(id), earnings: { mode: 'delivery', rate: 8, amount: id === 31 ? 8 : 12 } })) } : null,
  routeState: returned ? 'returning' : 'delivering' });
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  let file = path.resolve(dist, relative);
  if (!file.startsWith(dist + path.sep)) return res.writeHead(403).end();
  if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function visit(url) {
  if (page.url() !== 'about:blank') {
    await page.evaluate(() => { window.__qaVisible = false; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
}
const pickupCalls = () => calls.filter(call => call.p.endsWith('/pickup'));
const completionCalls = () => calls.filter(call => call.p.endsWith('/completion') && call.method === 'POST');
async function waitForDraft(body) {
  // A simulação de viewport é externa ao navegador. Esperar o estado controlado
  // e a gravação do rascunho antes dela distingue perda real de digitação pendente.
  await page.waitForFunction(body => {
    const input = document.querySelector('textarea[aria-label="Mensagem"]');
    return input?.value === body && Object.entries(localStorage).some(([key, value]) => key.startsWith('zippygo.chat.draft.v2:') && value.includes(body));
  }, body);
}
async function slideToConfirm(handle) {
  if (engine === 'webkit') await handle.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  else await handle.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="delivery-slide-handle"]');
    if (!el) return false;
    const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  const rect = await handle.boundingBox(), track = await handle.locator('..').boundingBox();
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2, destination = track.x + track.width - 15;
  await page.mouse.move(x, y); await page.mouse.down();
  // Um gesto humano atravessa vários frames; não comprimir a captura/movimento
  // e liberação no mesmo frame do responder do React Native Web.
  for (let i = 1; i <= 12; i++) { await page.mouse.move(x + (destination - x) * i / 12, y); await page.waitForTimeout(16); }
  await page.mouse.up();
}
async function checkItems() {
  const boxes = page.getByRole('checkbox');
  await boxes.first().waitFor();
  const count = await boxes.count(); assert.ok(count > 0);
  for (let i = 0; i < count; i++) {
    const box = boxes.nth(i);
    if (engine === 'webkit') await box.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    else await box.scrollIntoViewIfNeeded();
    const before = await box.boundingBox();
    await box.and(page.locator(':not([aria-disabled="true"])')).waitFor();
    if (await box.getAttribute('aria-checked') === 'true') continue;
    if (engine === 'webkit') {
      assert.ok(await box.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), 'Checkbox realmente visível e sem sobreposição.');
      await box.click({ force: true });
    } else await box.click();
    await box.and(page.locator('[aria-checked="true"]')).waitFor();
    const after = await box.boundingBox();
    assert.equal(after.width, before.width, 'Marcar não deve alterar a largura.');
    assert.equal(after.height, before.height, 'Marcar não deve alterar a altura.');
    assert.equal(await page.locator('#root').evaluate(el => el.getBoundingClientRect().width), 390);
  }
}
async function fresh(context, url) {
  if (page) await page.close();
  page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on('pageerror', error => result.errors.push({ url: page.url(), message: error.message }));
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
    if (p.endsWith('/queue')) return ok(queue());
    if (p.endsWith('/queue/resume')) {
      if (failResumeOnce) { failResumeOnce = false; return route.fulfill({ status: 503, json: { success: false, error: 'Conexão interrompida ao recuperar pedidos' } }); }
      pendingOnly = false; queueVersion++; return ok(queue());
    }
    if (p.endsWith('/offer/accept')) { offered = false; offerAccepted = true; queueVersion++; return ok(queue()); }
    if (p.endsWith('/offer/reject')) { offered = false; queueVersion++; return ok(queue()); }
    if (p.endsWith('/pickup')) {
      if (rejectPickupOnce) { rejectPickupOnce = false; attention = true; return route.fulfill({ status: 422, json: { success: false, code: 'CHECKLIST_CHANGED', error: 'Os itens destacados mudaram. Atualize a conferência.' } }); }
      mode = 'delivery'; return ok(queue());
    }
    if (p.endsWith('/completion/23')) return ok({ pedidoId: 23, version: 3, nomeCliente: 'Cliente 23', total: 30,
      requiresCode: requirements, requiresPayment: requirements, requiresProof: requirements && proofRequired, checklist: order(23).checklist });
    if (p.endsWith('/completion/23/code')) return ok(body.codigo === '1234');
    if (p.includes('/receipts/')) return receipt ? ok(receipt) : route.fulfill({ status: 404, json: { success: false, error: 'Ainda não confirmado' } });
    if (p.endsWith('/transfers')) return ok([]);
    if (p.endsWith('/completion') && request.method() === 'POST') {
      if (failCompletion) return route.fulfill({ status: 503, json: { success: false, error: 'Sem confirmação do servidor' } });
      returned = true;
      queueVersion++;
      receipt = { operationId: body.operationId, pedidoId: 23, completedAtUtc: new Date().toISOString(), codeChecked: !!body.codigo, paidBeforeDelivery: !requirements, payments: body.payments };
      return ok({ queue: queue(), receipt });
    }
    const match = p.match(/\/orders\/(23|24|31)$/); if (match) return ok(order(Number(match[1])));
    if (p.endsWith('/store')) return ok({ nome: shop.nome, latitude: -18.92, longitude: -48.242 });
    if (p.endsWith('/location/batch')) return ok({ samples: body.samples.map(sample => ({ sampleId: sample.sampleId, sequence: sample.sequence, outcome: 'accepted', updatedCurrent: true, receivedAtUtc: new Date().toISOString() })) });
    if (p.endsWith('/contacts') || p.endsWith('/notifications')) return ok([]);
    if (p.endsWith('/client-chat')) return ok({ channel: { pedidoId: 23, clienteNome: 'Cliente 23', podeReceber: true }, messages: chatMessages(), hasMore: false });
    if (p.includes('/messages')) return ok({ messages: chatMessages(), hasMore: false });
    return ok(null);
  });
  await visit(url);
}
let base;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ headless: true, executablePath: process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
  for (const dark of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, permissions: ['geolocation'], geolocation: { latitude: -18.92, longitude: -48.24 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ shop, user, session, dark }) => {
      const fetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (typeof input === 'string') { const url = new URL(input, location.href); if (url.pathname.startsWith('/api/')) return fetch(url.pathname + url.search, init); }
        return fetch(input, init);
      };
      for (const [key, value] of Object.entries({ 'zippygo.user': JSON.stringify(user), authToken: 'principal-qa', 'zippygo.token': 'principal-qa',
        'zippygo.estabelecimentoAtual': JSON.stringify(shop), operationalAccessToken: 'operacional-qa', operationalSession: JSON.stringify(session),
        operationalEstablishmentId: shop.id, operationalUserId: user.id, 'zippygo.design.preferences.v1': JSON.stringify({ dark, reducedMotion: true }) })) localStorage.setItem(key, value);
      if (location.pathname === '/permissoes' && location.search.includes('qaOffline=1')) for (const key of ['operationalAccessToken', 'operationalSession', 'operationalEstablishmentId', 'operationalUserId']) localStorage.removeItem(key);
      window.__qaVisible = true;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__qaVisible ? 'visible' : 'hidden' });
      const viewport = visualViewport;
      Object.defineProperties(viewport, { height: { configurable: true, get: () => window.__qaKeyboardHeight || innerHeight },
        scale: { configurable: true, get: () => 1 }, offsetTop: { configurable: true, get: () => 0 } });
    }, { shop, user, session, dark });
    mode = 'pickup'; attention = false; requirements = false; returned = false;
    if (!process.env.QA_OFFER_ONLY) {
    const startsBeforeFirstAccess = calls.filter(c => c.p.endsWith('/session/start')).length;
    await fresh(context, base + '/permissoes?intent=start&qaOffline=1');
    await page.waitForURL('**/retirada');
    await page.getByRole('checkbox').first().waitFor();
    assert.equal(calls.filter(c => c.p.endsWith('/session/start')).length, startsBeforeFirstAccess + 1, 'Primeiro acesso inicia uma única vez após a restauração.');
    assert.equal(calls.filter(c => c.p.endsWith('/session/start')).at(-1).body.clientPlatform, 'web');
    assert.equal(await page.getByText('PERMITIDO', { exact: true }).count(), 0);
    result.cases.push({ dark, case: 'Primeiro acesso com permissões prontas espera restauração e entra direto na tarefa, sem travar ou duplicar turno' });

    pendingOnly = true; failResumeOnce = true;
    const resumesBefore = calls.filter(c => c.p.endsWith('/queue/resume')).length;
    await fresh(context, base + '/retirada');
    await page.getByText('Conexão interrompida ao recuperar pedidos', { exact: true }).waitFor();
    assert.equal(calls.filter(c => c.p.endsWith('/queue/resume')).length, resumesBefore + 1);
    assert.equal(await page.getByRole('button', { name: 'Estou saindo do estabelecimento', exact: true }).getAttribute('aria-disabled'), 'true');
    await page.getByRole('button', { name: 'Atualizar itens e conferir novamente', exact: true }).click();
    await page.waitForFunction(() => !document.body.innerText.includes('Conexão interrompida ao recuperar pedidos'));
    await checkItems();
    await page.getByRole('button', { name: 'Estou saindo do estabelecimento', exact: true }).and(page.locator(':not([aria-disabled="true"])')).waitFor();
    assert.equal(calls.filter(c => c.p.endsWith('/queue/resume')).length, resumesBefore + 2, 'Uma falha libera nova tentativa da mesma fila.');
    result.cases.push({ dark, case: 'Pedidos já aceitos são recuperados automaticamente; falha não permite saída e retry destrava a mesma fila' });

    for (const extra of [false, true]) {
      mode = 'pickup'; attention = extra; requirements = false; returned = false;
      await fresh(context, base + '/retirada');
      await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('zippygo.item-checks.')) localStorage.removeItem(key); });
      await visit(base + '/retirada');
      await checkItems();
      const before = pickupCalls().length;
      await page.getByRole('button', { name: 'Estou saindo do estabelecimento', exact: true }).click();
      if (extra) {
        const modal = page.getByRole('alert'); await modal.waitFor();
        assert.equal(pickupCalls().length, before);
        for (const id of [23, 24]) assert.ok(await modal.getByText('Pedido #' + id, { exact: false }).isVisible());
        assert.equal(await modal.getByText('4× Refrigerante · Pizza', { exact: true }).count(), 2);
        await page.waitForTimeout(350); // capturar após o fade do Modal
        await page.getByRole('button', { name: 'Voltar e conferir', exact: true }).click();
        assert.equal(pickupCalls().length, before);
        assert.equal(await page.locator('[role="checkbox"][aria-checked="true"]').count(), 4);
        await page.getByRole('button', { name: 'Estou saindo do estabelecimento', exact: true }).click();
        await page.getByRole('button', { name: 'Tudo na bag · estou saindo', exact: true }).click();
      }
      await page.waitForURL('**/mapa');
      await page.getByText('Como você quer navegar?', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Navegar no ZippyGo', exact: true }).count(), 0, 'Web não abre o navegador nativo.');
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(pickupCalls().length, before + 1, 'A saída envia uma única confirmação.');
      const payload = pickupCalls().at(-1).body;
      assert.deepEqual(payload.pedidoIds, [23, 24]);
      assert.equal(payload.checklists.length, 2);
      for (const c of payload.checklists) { assert.equal(c.confirmedKeys.length, 2); assert.deepEqual(c.recheckedExtraKeys, extra ? ['a' + c.pedidoId] : []); }
      result.cases.push({ dark, case: extra ? 'Retirada com resumo por pedido, cancelamento e confirmação única' : 'Retirada sem segunda interação', stableCheckboxes: true });
    }
    mode = 'pickup'; attention = false; returned = false;
    await fresh(context, base + '/retirada'); await checkItems();
    rejectPickupOnce = true;
    const attempted = pickupCalls().length;
    await page.getByRole('button', { name: 'Estou saindo do estabelecimento', exact: true }).click();
    await page.getByRole('button', { name: 'Atualizar itens e conferir novamente', exact: true }).click();
    await page.getByText('Confira com atenção · destacado pela loja', { exact: true }).first().waitFor();
    assert.ok(page.url().endsWith('/retirada'), 'Recusa não avança a retirada.');
    await checkItems();
    await page.getByRole('button', { name: 'Estou saindo do estabelecimento', exact: true }).click();
    await page.getByRole('button', { name: 'Tudo na bag · estou saindo', exact: true }).click();
    await page.waitForURL('**/mapa'); assert.equal(pickupCalls().length, attempted + 2);
    assert.ok(pickupCalls().at(-1).body.checklists.every(c => c.version.endsWith('-attention') && c.recheckedExtraKeys.length === 1));
    result.cases.push({ dark, case: 'Seleção alterada na loja rejeita versão antiga e permite atualizar sem avanço local' });
    mode = 'delivery'; attention = false; requirements = false; returned = false;
    await fresh(context, base + '/confirmacaoEntrega?id=23');
    await page.evaluate(() => { sessionStorage.removeItem('zippygo.completion.7'); for (const key of Object.keys(localStorage)) if (key.startsWith('zippygo.item-checks.')) localStorage.removeItem(key); });
    await visit(base + '/confirmacaoEntrega?id=23');
    await checkItems();
    await page.getByText('Arraste para concluir', { exact: true }).waitFor();
    await capture(`finalizacao-${dark ? 'dark' : 'light'}`);
    assert.equal(await page.getByRole('button', { name: 'Conferir itens destacados', exact: true }).count(), 0);
    assert.equal(await page.getByText('Código do cliente', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Comprovante obrigatório', { exact: true }).count(), 0);
    const before = completionCalls().length, handle = page.getByTestId('delivery-slide-handle');
    await handle.scrollIntoViewIfNeeded(); await handle.click();
    assert.equal(completionCalls().length, before, 'Um toque não conclui a entrega.');
    await slideToConfirm(handle);
    await page.waitForURL('**/retornoLoja');
    assert.equal(completionCalls().length, before + 1);
    assert.deepEqual(completionCalls().at(-1).body.checklist.recheckedExtraKeys, []);
    result.cases.push({ dark, case: 'Entrega sem itens destacados, sem etapas dispensáveis, exige arraste' });
    mode = 'delivery'; attention = true; requirements = true; returned = false;
    await fresh(context, base + '/confirmacaoEntrega?id=23');
    await page.evaluate(() => sessionStorage.removeItem('zippygo.completion.7')); await visit(base + '/confirmacaoEntrega?id=23');
    await checkItems();
    assert.equal(await page.getByRole('button', { name: 'Conferir itens destacados', exact: true }).count(), 0);
    await page.getByText('Falta validar o código do cliente.', { exact: true }).waitFor();
    for (const title of ['Código do cliente', 'Comprovante obrigatório']) await page.getByText(title, { exact: true }).waitFor();
    await page.getByText('Conclua as conferências acima', { exact: true }).waitFor();
    result.cases.push({ dark, case: 'Entrega destacada mantém bloqueio por código, cobrança e foto obrigatórios' });
    proofRequired = false; receipt = null;
    await fresh(context, base + '/confirmacaoEntrega?id=23');
    await page.evaluate(() => { sessionStorage.removeItem('zippygo.completion.7'); for (const key of Object.keys(localStorage)) if (key.startsWith('zippygo.item-checks.')) localStorage.removeItem(key); });
    await visit(base + '/confirmacaoEntrega?id=23'); await checkItems();
    await page.getByLabel('Dígito 1 do código', { exact: true }).fill('1111');
    await page.getByRole('button', { name: 'Validar código', exact: true }).click();
    await page.getByText('O código não foi confirmado.', { exact: true }).waitFor();
    await page.getByLabel('Dígito 1 do código', { exact: true }).fill('1234');
    await page.getByRole('button', { name: 'Validar código', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Dígito 1 do código"]').readOnly);
    assert.equal(await page.getByLabel('Dígito 4 do código', { exact: true }).inputValue(), '4');
    const countBeforePayment = completionCalls().length;
    await page.getByRole('button', { name: 'Cobrar', exact: true }).click();
    await page.getByRole('button', { name: 'Dividir em duas formas', exact: true }).click();
    await page.getByLabel('Forma de pagamento da parte 1', { exact: true }).selectOption('pix');
    await page.getByLabel('Valor da parte 1', { exact: true }).fill('10,00');
    await page.getByLabel('Forma de pagamento da parte 2', { exact: true }).selectOption('dinheiro');
    await page.getByLabel('Dinheiro recebido na parte 2', { exact: true }).fill('15,00');
    assert.equal(await page.getByRole('button', { name: 'Confirmo que recebi as duas partes', exact: true }).isEnabled(), false);
    await page.getByLabel('Dinheiro recebido na parte 2', { exact: true }).fill('30,00');
    await page.getByRole('button', { name: 'Confirmo que recebi as duas partes', exact: true }).click();
    await page.getByText('Arraste para concluir', { exact: true }).waitFor();
    assert.equal(completionCalls().length, countBeforePayment, 'Preparar recebimento não conclui nem registra pago sozinho.');
    await page.getByLabel('Valor da parte 1', { exact: true }).fill('12,00');
    await page.getByText('Conclua as conferências acima', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirmo que recebi as duas partes', exact: true }).click();
    await page.getByText('Arraste para concluir', { exact: true }).waitFor();
    await slideToConfirm(page.getByTestId('delivery-slide-handle'));
    await page.waitForURL('**/retornoLoja');
    const finished = completionCalls().at(-1).body;
    assert.equal(finished.codigo, '1234'); assert.deepEqual(finished.payments.map(p => p.amount), [12, 18]);
    assert.ok(finished.payments.every(p => p.receivedConfirmed)); assert.deepEqual(finished.checklist.recheckedExtraKeys, ['a23']);
    result.cases.push({ dark, case: 'Código validado permanece visível; cobrança dividida inline exige recebimento e edição invalida confirmação; arraste único avança após servidor' });

    mode = 'delivery'; attention = false; requirements = false; returned = false; failCompletion = true; receipt = null;
    await fresh(context, base + '/confirmacaoEntrega?id=23');
    await page.evaluate(() => sessionStorage.removeItem('zippygo.completion.7')); await visit(base + '/confirmacaoEntrega?id=23');
    await checkItems(); await page.getByText('Arraste para concluir', { exact: true }).waitFor();
    await slideToConfirm(page.getByTestId('delivery-slide-handle'));
    await page.waitForURL('**/entregaPendente');
    const pendingOperation = completionCalls().at(-1).body.operationId;
    await page.getByRole('button', { name: 'Consultar o caminho', exact: true }).click(); await page.waitForURL('**/mapa');
    await page.getByText('conclusão aguardando confirmação', { exact: false }).waitFor();
    assert.ok(!returned, 'Falha não avança a fila.');
    await page.getByText('conclusão aguardando confirmação', { exact: false }).click(); await page.waitForURL('**/entregaPendente');
    failCompletion = false;
    await page.getByRole('button', { name: 'Sincronizar conclusão', exact: true }).click(); await page.waitForURL('**/retornoLoja');
    assert.equal(completionCalls().at(-1).body.operationId, pendingOperation);
    result.cases.push({ dark, case: 'Falha mantém conclusão e fila; mapa permanece consultável; sincronização única reutiliza operação' });

    const startsBeforeReview = calls.filter(c => c.p.endsWith('/session/start')).length;
    await fresh(context, base + '/permissoes?intent=review&returnTo=%2Fconfiguracoes&qaOffline=1');
    await page.waitForURL('**/configuracoes');
    assert.equal(calls.filter(c => c.p.endsWith('/session/start')).length, startsBeforeReview);
    assert.equal(await page.getByText('PERMITIDO', { exact: true }).count(), 0);
    await page.getByRole('switch', { name: 'Som dos avisos', exact: true }).waitFor();
    result.cases.push({ dark, case: 'Revisão de permissões já concedidas fecha direto, sem iniciar turno; som e vibração ficam nas configurações' });
    proofRequired = true; requirements = false; returned = false;
    await fresh(context, base + '/conversas?channel=store');
    const input = page.getByPlaceholder('Escreva uma mensagem…', { exact: true }); await input.waitFor();
    const fontSize = await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize)); assert.ok(fontSize >= 16);
    await page.getByText('Última mensagem visível', { exact: true }).waitFor();
    await input.fill(''); await input.pressSequentially('Teste do teclado', { delay: 25 });
    await waitForDraft('Teste do teclado');
    await page.evaluate(() => { window.__qaKeyboardHeight = 420; visualViewport.dispatchEvent(new Event('resize')); });
    await page.waitForFunction(() => document.documentElement.dataset.zippyKeyboard === 'open');
    await page.getByRole('tab').first().waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('tab').count(), 0);
    assert.equal(await page.locator('#root').evaluate(el => el.getBoundingClientRect().height), 420);
    const composer = await input.boundingBox(); assert.ok(composer.y >= 0 && composer.y + composer.height <= 420, JSON.stringify(composer));
    const lastMessage = page.getByText('Última mensagem visível', { exact: true });
    await lastMessage.waitFor();
    await page.waitForFunction(() => { const el = document.querySelector('[data-testid="chat-bubble-qa-message-24"]'); const input = document.querySelector('textarea'); return el && input && el.getBoundingClientRect().bottom <= input.getBoundingClientRect().top; });
    assert.equal(await input.inputValue(), 'Teste do teclado');
    assert.equal(await page.locator('#root').evaluate(el => el.getBoundingClientRect().width), 390);
    await input.evaluate(el => el.blur());
    await page.evaluate(() => { window.__qaKeyboardHeight = 844; visualViewport.dispatchEvent(new Event('resize')); });
    await page.waitForFunction(() => document.documentElement.dataset.zippyKeyboard === 'closed');
    await page.getByRole('tab', { name: 'Chat', exact: true }).waitFor();
    assert.equal(await page.locator('#root').evaluate(el => el.getBoundingClientRect().height), 844);
    result.cases.push({ dark, case: 'Chat com fonte 16px, teclado simulado reserva altura, mantém largura e restaura navegação' });
    await fresh(context, base + '/conversas?channel=client&pedidoId=23');
    const clientInput = page.getByPlaceholder('Escreva uma mensagem…', { exact: true }); await clientInput.fill('Teste com cliente');
    await waitForDraft('Teste com cliente');
    await clientInput.focus();
    await page.evaluate(() => { window.__qaKeyboardHeight = 420; visualViewport.dispatchEvent(new Event('resize')); });
    await page.waitForFunction(() => document.documentElement.dataset.zippyKeyboard === 'open');
    await page.getByText('Última mensagem visível', { exact: true }).waitFor();
    await page.waitForFunction(() => { const el = document.querySelector('[data-testid="chat-bubble-qa-message-24"]'); const input = document.querySelector('textarea'); return el && input && el.getBoundingClientRect().bottom <= input.getBoundingClientRect().top && input.getBoundingClientRect().bottom <= 420; });
    assert.equal(await clientInput.inputValue(), 'Teste com cliente');
    result.cases.push({ dark, case: 'Chat de cliente com 25 mensagens mantém última mensagem e caixa de texto acima do teclado' });
    await context.addInitScript(() => { if (location.pathname === '/permissaoNegada') {
      navigator.permissions.query = async () => ({ state: window.__qaPermissionGranted ? 'granted' : 'denied' });
      navigator.geolocation.getCurrentPosition = (success, fail) => window.__qaPermissionGranted ? success({ coords: { latitude: -18.92, longitude: -48.24 }, timestamp: Date.now() }) : fail({ code: 1, message: 'denied' });
    } });
    await fresh(context, base + '/permissaoNegada?kind=foreground&intent=resume');
    await page.getByRole('button', { name: 'Já permiti, verificar localização', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Abrir configurações', exact: true }).count(), 0);
    await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_, fail) => fail({ code: 1, message: 'denied' }); });
    await page.getByRole('button', { name: 'Já permiti, verificar localização', exact: true }).click();
    await page.getByText('Localização não confirmada', { exact: true }).waitFor();
    assert.ok(page.url().includes('/permissaoNegada'));
    await page.evaluate(() => { window.__qaPermissionGranted = true; navigator.geolocation.getCurrentPosition = success => success({ coords: { latitude: -18.92, longitude: -48.24 }, timestamp: Date.now() }); });
    await page.getByRole('button', { name: 'Já permiti, verificar localização', exact: true }).click();
    await page.waitForURL('**/confirmacaoEntrega?id=23');
    result.cases.push({ dark, case: 'Permissão negada informa ajuste, verifica GPS real e permite retornar ao turno' });

    mode = 'delivery'; attention = false; requirements = false; returned = false; routeStudy = true;
    const startsBeforeRestore = calls.filter(c => c.p.endsWith('/session/start')).length;
    await fresh(context, base + '/');
    await page.waitForURL('**/mapa');
    assert.equal(calls.filter(c => c.p.endsWith('/session/start')).length, startsBeforeRestore);
    const leaflet = page.locator('.leaflet-container'); await leaflet.waitFor();
    await leaflet.evaluate(el => { el.dataset.qaOriginalMap = 'true'; });
    await page.getByRole('button', { name: 'Ver rota completa e detalhes dos pedidos', exact: true }).click();
    await page.getByRole('heading', { name: 'Sua rota, de perto', exact: true }).waitFor();
    await capture(`percurso-${dark ? 'dark' : 'light'}`);
    await page.getByRole('button', { name: 'Ver pedido 24, parada 2', exact: true }).click();
    await page.getByText('2× Pizza QA', { exact: true }).waitFor();
    assert.ok(page.url().endsWith('/mapa'), 'Detalhes abrem dentro da rota.');
    assert.equal(await page.getByRole('button', { name: 'Mais detalhes do pedido', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Voltar à sequência da rota', exact: true }).click();
    await page.getByRole('button', { name: 'Ver pedido 23, parada 1', exact: true }).click();
    await page.getByRole('button', { name: 'Conferir entrega', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Recolher rota completa', exact: true }).click();
    assert.equal(await page.locator('.leaflet-container[data-qa-original-map="true"]').count(), 1, 'A gaveta mantém o mesmo mapa.');
    result.cases.push({ dark, case: 'Reabertura retoma mapa; rota completa e detalhes inline preservam a instância do mapa' });
    await page.getByRole('tab', { name: 'Início', exact: true }).click();
    const mini = page.getByRole('button', { name: 'Abrir pedidos no mapa', exact: true }); await mini.waitFor();
    await mini.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await mini.locator('.leaflet-marker-icon svg').first().waitFor();
    assert.equal(await mini.locator('.leaflet-marker-icon svg text').count(), 2);
    const mapBox = await mini.boundingBox(), pauseBox = await page.getByRole('button', { name: 'Pausar chamados', exact: true }).boundingBox();
    for (const pin of await mini.locator('.leaflet-marker-icon').all()) {
      const pinBox = await pin.boundingBox(); assert.ok(pinBox.y >= mapBox.y && pinBox.y + pinBox.height <= Math.min(mapBox.y + mapBox.height, pauseBox.y), 'Pin inteiro cabe no mapa pequeno, acima do rodapé.');
    }
    await capture(`inicio-pins-${dark ? 'dark' : 'light'}`);
    result.cases.push({ dark, case: 'Pins com numeração legível e próxima parada destacada cabem inteiros no mapa do início' });
    }
    mode = 'delivery'; returned = false; routeStudy = true;
    offered = false; offerAccepted = false;
    await fresh(context, base + '/conversas?channel=store');
    const draft = page.getByPlaceholder('Escreva uma mensagem…', { exact: true }); await draft.fill('Conversa preservada');
    const responseCalls = () => calls.filter(c => /\/offer\/(accept|reject)$/.test(c.p));
    const beforeOffer = responseCalls().length;
    startOffer();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.getByRole('heading', { name: 'Nova rota', exact: true }).waitFor();
    assert.equal(responseCalls().length, beforeOffer, 'Exibir oferta não aceita o pedido.');
    await page.getByRole('button', { name: /Aceitar pedido/ }).click();
    await page.getByRole('heading', { name: 'Nova rota', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(responseCalls().at(-1).body.expectedOfferId, offerId);
    assert.deepEqual(responseCalls().at(-1).body.acceptedPedidoIds, [31]);
    assert.ok(page.url().includes('/conversas'));
    assert.equal(await draft.inputValue(), 'Conversa preservada');
    result.cases.push({ dark, case: 'Oferta aparece no chat, exige aceite e preserva tela e rascunho' });

    startOffer(); offerAccepted = false;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.getByRole('heading', { name: 'Nova rota', exact: true }).waitFor();
    const beforeDecline = responseCalls().length;
    await page.getByRole('button', { name: 'Recusar', exact: true }).click();
    assert.equal(responseCalls().length, beforeDecline);
    await page.getByRole('button', { name: 'Confirmar recusa', exact: true }).click();
    await page.getByRole('heading', { name: 'Nova rota', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(responseCalls().at(-1).body.expectedOfferId, offerId);
    assert.ok(responseCalls().at(-1).p.endsWith('/offer/reject'));
    assert.equal(await draft.inputValue(), 'Conversa preservada');
    result.cases.push({ dark, case: 'Recusa pede confirmação inline, envia identidade da oferta e preserva chat' });
    // Oferta durante navegação: não altera rota, pode recolher e mantém seleção/prazo.
    offered = false; offerAccepted = false;
    await fresh(context, base + '/mapa');
    await page.locator('.leaflet-container').first().waitFor();
    await page.locator('.leaflet-container').first().evaluate(el => el.setAttribute('data-offer-original-map', 'true'));
    offerIds = [31, 32]; startOffer();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.getByRole('heading', { name: 'Nova rota', exact: true }).waitFor();
    await page.getByText('Rota atual + novas paradas', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Aceitar 2 pedidos.*20/ }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.leaflet-container')[1]?.querySelectorAll('.leaflet-marker-icon').length === 4);
    await page.getByText('3 · #31 · Cliente 31', { exact: true }).waitFor();
    await page.getByText('4 · #32 · Cliente 32', { exact: true }).waitFor();
    await capture('oferta-completa-' + (dark ? 'dark' : 'light'));
    await page.getByRole('checkbox', { name: 'Selecionar pedido #31', exact: true }).click();
    await page.getByRole('button', { name: /Aceitar pedido.*12/ }).waitFor();
    await capture('oferta-' + (dark ? 'dark' : 'light'));
    const countdown = async () => {
      const value = (await page.getByRole('heading', { name: 'Nova rota', exact: true }).locator('..').innerText()).match(/(\d+):(\d+) para responder/);
      assert.ok(value, 'Prazo visível na oferta'); return Number(value[1]) * 60 + Number(value[2]);
    };
    const secondsBeforeHide = await countdown();
    const beforeHide = responseCalls().length;
    await page.getByRole('button', { name: 'Ocultar por enquanto', exact: true }).click();
    await page.getByRole('heading', { name: 'Nova rota', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(responseCalls().length, beforeHide, 'Ocultar não aceita nem recusa.');
    assert.equal(await page.locator('.leaflet-container[data-offer-original-map="true"]').count(), 1);
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.getByRole('button', { name: /Nova oferta.*responder em/ }).click();
    assert.ok(await countdown() < secondsBeforeHide, 'Ocultar e atualizar a fila não renova o prazo.');
    await page.getByRole('button', { name: /Aceitar pedido.*12/ }).click();
    await page.getByText('Aceitar 1 e recusar 1 pedidos?', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirmar escolha', exact: true }).click();
    await page.getByRole('heading', { name: 'Nova rota', exact: true }).waitFor({ state: 'hidden' });
    assert.deepEqual(responseCalls().at(-1).body.acceptedPedidoIds, [32]);
    assert.equal(await page.locator('.leaflet-container[data-offer-original-map="true"]').count(), 1);
    result.cases.push({ dark, case: 'Oferta na rota mostra ganhos/mapa, recolhe sem responder, reabre com seleção e exige confirmação do aceite parcial' });
    offerIds = [31]; routeStudy = false; offered = false; offerAccepted = false; queueVersion = 3;
    await context.close(); page = null;
  }
  assert.deepEqual(result.errors, []); result.ok = true;
  fs.writeFileSync(path.join(__dirname, `${reportPrefix}-${engine}-results.json`), JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
})().catch(async error => {
  process.stderr.write(error.stack + '\n'); process.exitCode = 1;
  if (page && !page.isClosed()) {
    result.failure = { error: error.message, text: await page.locator('body').innerText(), inputs: await page.locator('textarea').evaluateAll(elements => elements.map(el => ({ value: el.value, readonly: el.readOnly, disabled: el.disabled, label: el.getAttribute('aria-label') }))), checkboxes: await page.getByRole('checkbox').evaluateAll(elements => elements.map(el => el.outerHTML.slice(0, 1300))), drafts: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('zippygo.chat.draft.v2:')))), calls }; }
  fs.writeFileSync(path.join(__dirname, `${reportPrefix}-${engine}-failure.json`), JSON.stringify(result, null, 2));
}).finally(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); });
