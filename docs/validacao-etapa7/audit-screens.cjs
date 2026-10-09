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
const baseQueue = { motoboyId: 1, estabelecimentoId: shop.id, version: 3, next: [], routeState: 'idle', politicas: {}, current: null, offer: null };
const results = [], errors = [], failures = [];

function okFallback(p, method) {
  if (method !== 'GET') return { success: true, data: method === 'DELETE' ? true : {} };
  if (/\/(messages|targets|transfers|documentos|solicitacoes|vinculos|estabelecimentos|notifications|contacts|support)(\?|$)/.test(p)) return { success: true, data: [] };
  return { success: true, data: {} };
}

async function mockRoute(page, queueRef, stateRef) {
  await page.routeWebSocket(/.*/, ws => ws.close());
  await page.route('**/tile.openstreetmap.org/**', route => route.fulfill({ body: png, contentType: 'image/png' }));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname;
    if (!p.startsWith('/api/')) return url.origin === base || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
    const ok = data => route.fulfill({ json: { success: true, data } });
    const method = req.method();
    if (p.endsWith('/motoboys/me/vinculos')) return ok([{ estabelecimentoId: shop.id, nome: shop.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo' }]);
    if (p.endsWith('/session')) return ok(session);
    if (p.endsWith('/heartbeat')) return ok({ accessToken: 'operacional-qa', session });
    if (p.endsWith('/queue')) return ok(queueRef.value);
    if (p.endsWith('/motoboys/me/perfil')) return ok({ motoboyId: 1, nome: user.nome, email: user.email, telefone: '11999990000', cidade: 'Uberlandia', uf: 'MG', modeloMoto: 'Honda CG', placaMoto: 'ABC1D23', anoMoto: 2024, statusCadastro: 'ativo' });
    if (p.endsWith('/motoboys/me/documentos')) return ok([]);
    if (p.endsWith('/transfer-targets')) return ok([{ motoboyId: 2, nome: 'Diego Martins', hasCurrentDelivery: false, queueSize: 1 }]);
    if (p.endsWith('/transfers')) return ok([{ id: 1, pedidoId: 23, fromMotoboyId: 1, toMotoboyId: 2, toMotoboyNome: 'Diego Martins', status: 'pending_approval', policy: 'approval', requestedAtUtc: now }]);
    if (p.endsWith('/store')) return ok({ nome: shop.nome, rua: 'Rua Central', numero: '100', bairro: 'Centro', cidade: 'Uberlandia', uf: 'MG' });
    if (p.endsWith('/preferences')) return ok({ compartilharLocalizacaoCliente: false });
    if (p.endsWith('/motoboys/me/estabelecimentos-disponiveis')) return ok([{ estabelecimentoId: '22222222-2222-2222-2222-222222222222', nome: 'Pizzaria Bella', distanciaKm: 1.2 }]);
    if (p.endsWith('/motoboys/me/vinculos/solicitacoes')) return ok([{ id: 1, estabelecimentoNome: 'Pizzaria Bella', status: 'pendente', criadoEmUtc: now }]);
    if (/\/motoboys\/me\/convites\/.+/.test(p)) return ok({ id: '1', estabelecimentoNome: 'Pizzaria Bella', convidadoPorNome: 'Gerente', criadoEmUtc: now });
    if (p.endsWith('/motoboys/me/work')) return ok(stateRef.work);
    if (p.endsWith('/motoboys/me/work/support')) return ok(crypto.randomUUID());
    if (p.includes('/motoboys/me/receipts/')) return ok({ operationId: 'op1', pedidoId: 23, codigo: '1234', payments: [], createdAtUtc: now });
    if (p.includes('/completion/')) return ok({ pedidoId: 23, order: order(23, 'Maria Oliveira'), requireCode: true, requirePayment: false, codeChecked: false });
    if (p.endsWith('/chat/notifications')) return ok([]);
    const chat = p.match(/\/chat\/(group|store|private)\/messages/);
    if (chat) { if (method === 'GET') return ok({ messages: [], hasMore: false }); return ok({ id: 'm1', sequence: 1, body: (JSON.parse(req.postData() || '{}')).body || '', senderName: user.nome, mine: true, createdAtUtc: now, readCount: 0, mentions: [], reactions: [] }); }
    if (p.endsWith('/client-chat')) return ok({ channel: { pedidoId: 23, clienteNome: 'Maria Oliveira', podeReceber: true }, messages: [], hasMore: false });
    if (p.endsWith('/atendimento/motoboys') || p.endsWith('/contacts')) return ok([{ motoboyId: 2, nome: 'Diego Martins', online: true }]);
    return route.fulfill({ json: okFallback(p, method) });
  });
}

async function setup(browser, width, dark, queue) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: -22.9, longitude: -47.06 } });
  await context.addInitScript(({ shop, user, session, dark }) => {
    localStorage.setItem('zippygo.design.preferences.v1', JSON.stringify({ dark, reducedMotion: true, sound: true, vibration: true }));
    for (const [k, v] of Object.entries({ 'zippygo.user': JSON.stringify(user), authToken: 'principal-qa', 'zippygo.token': 'principal-qa', 'zippygo.estabelecimentoAtual': JSON.stringify(shop), operationalAccessToken: 'operacional-qa', operationalUserId: user.id, operationalEstablishmentId: shop.id, operationalSession: JSON.stringify(session) })) localStorage.setItem(k, v);
  }, { shop, user, session, dark });
  const page = await context.newPage();
  page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', e => errors.push(`${page.url()} :: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Manrope|net::ERR_ABORTED/.test(m.text())) errors.push(`${page.url()} :: console: ${m.text()}`); });
  const queueRef = { value: queue }, stateRef = { work: { plan: { id: 'plan', mode: 'delivery', rate: 10, createdAtUtc: now }, plans: [], entries: [], settlementEntries: [], settlements: [], balance: { outstanding: 0, cashToReturn: 0 }, history: [], earnings: 0, unpricedDeliveries: 0, unconfirmedReceipts: 0, support: [] } };
  await mockRoute(page, queueRef, stateRef);
  return { page, context, queueRef };
}

async function visit(page, route, label) {
  try {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => [...document.querySelectorAll('*')].some(el => Object.keys(el).some(k => k.startsWith('__reactProps$'))), { timeout: 15000 });
    await page.waitForTimeout(600);
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

const screens = [
  ['01-welcome', '/(auth)/welcome'], ['02-login', '/(auth)/login'], ['03-register', '/(auth)/register'], ['04-recovery', '/(auth)/recovery'],
  ['05-permissions', '/permissoes'], ['06-stores', '/selecionarRestaurante'], ['07-link', '/solicitarRestaurante'], ['08-link-status', '/solicitacoesVinculo'], ['09-invite', '/convite/1'],
  ['13-map', '/mapa'], ['15-offer', '/oferta'], ['16-route', '/rota'], ['17-pickup', '/retirada'], ['18-navigate', '/mapa?modo=rota'],
  ['19-order', '/pedido/23'], ['20-arrive', '/chegadaEntrega'], ['21-finish', '/confirmacaoEntrega?id=23'], ['22-code', '/VerificationScreen?id=23'],
  ['23-charge', '/cobrarEntrega?id=23'], ['24-split', '/dividirPagamento?id=23'], ['25-proof', '/comprovanteEntrega?id=23'], ['26-success', '/entregaConcluida'],
  ['27-return', '/retornoLoja'],
  ['36-history', '/historico'], ['37-history-detail', '/reciboHistorico?stop=1&period=today'], ['38-earnings', '/ganhos'], ['39-settlement', '/acerto'], ['40-shift', '/resumoTurno'],
  ['41-profile', '/perfil'], ['42-edit-profile', '/dadosPessoais'], ['43-vehicle', '/minhaMoto'], ['44-documents', '/documentos'], ['45-settings', '/configuracoes'], ['46-tracking', '/privacidade'],
  ['47-support', '/suporte'], ['48-safety', '/seguranca'], ['49-incident', '/ocorrencia?id=23'], ['50-absent', '/clienteAusente'],
  ['51-transfer', '/transferencia?id=23'], ['52-transfer-status', '/acompanharTransferencia'], ['53-connection', '/conexao'],
  ['55-expired', '/sessaoEncerrada'], ['56-denied', '/permissaoNegada'],
  ['57-cancelled', '/estadoRota?tipo=cancelled&pedidoId=23'], ['58-changed', '/estadoRota?tipo=changed&pedidoId=23'], ['59-conflict', '/estadoRota?tipo=conflict&pedidoId=23'], ['60-offer-expired', '/estadoRota?tipo=offer-expired&pedidoId=23'],
  ['28-chats', '/conversas'], ['29-chat-store', '/conversas?channel=store'], ['30-chat-client', '/conversas?channel=client&pedidoId=23'],
  ['31-chat-rider', '/conversas?channel=private&target=2&name=Diego%20Martins'], ['32-chat-group', '/conversas?channel=group'],
  ['33-group-details', '/conversas?view=group'], ['34-contacts', '/conversas?view=contacts'], ['35-notifications', '/conversas?view=notifications'],
  ['61-channel-unavailable', '/conversas?channel=client&pedidoId=23'],
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  try {
    for (const dark of [false, true]) {
      const theme = dark ? 'escuro' : 'claro';
      const queueOnline = { ...baseQueue, routeState: 'delivering', current: stop(1, 23, 'en_route', { arrivedAtUtc: now, pickedUpAtUtc: now }), next: [stop(2, 24, 'assigned')] };
      const { page, context } = await setup(browser, 390, dark, queueOnline);
      let ok = 0, total = 0;
      for (const [id, route] of screens) {
        total++;
        if (await visit(page, route, `${id}-${theme}`)) ok++;
      }
      await context.close();
      results.push(`${theme}: ${ok}/${total} telas abriram sem crash/overflow`);
    }
    fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ results, errors: [...new Set(errors)], failures, scope: 'Varredura estrutural (navegacao + screenshot + console/overflow) via Expo Web com API simulada minima; nao exercita interacoes nem Android.' }, null, 2));
    console.log(results.join('\n'));
    console.log('\nFALHAS:', failures.length); failures.forEach(f => console.log(' -', f));
    console.log('\nERROS DE CONSOLE/PAGE:', [...new Set(errors)].length); [...new Set(errors)].slice(0, 40).forEach(e => console.log(' -', e));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
