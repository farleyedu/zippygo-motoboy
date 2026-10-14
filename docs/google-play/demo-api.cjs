// API fictícia, somente loopback, para capturar a interface Android real.
// Não conecta ao backend publicado nem usa contas, pedidos ou credenciais reais.
const http = require('node:http');
const { WebSocketServer } = require('ws');
const port = Number(process.env.PLAY_DEMO_PORT || 4358);
const shopId = '11111111-1111-4111-8111-111111111111';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const now = () => new Date().toISOString();
const user = { id: 7, nome: 'Rafael Lima', email: 'demo@example.invalid', role: 'motoboy', telefone: '' };
const tokenData = { accessToken: 'google-play-demo-local', refreshToken: 'google-play-demo-refresh', user };
let scene = 'home';
let active = false;
let locationCount = 0, lastLocation = null;
function receivedLocations(samples) {
  for (const sample of samples) { locationCount++; lastLocation = { capturedAtUtc: sample.capturedAtUtc, trackingMode: sample.trackingMode }; }
}
const session = () => ({ sessionId, epoch: 1, origin: 'mobile', clientPlatform: 'native', startedAtUtc: now(), isEnded: false, version: 1, heartbeatIntervalSeconds: 25, presenceExpiresAtUtc: new Date(Date.now() + 86400000).toISOString() });
const order = (id, name, address, latitude, longitude) => ({
  id, nomeCliente: name, enderecoEntrega: address, latitude, longitude, bairro: 'Centro', cidade: 'Uberlândia',
  total: 68.9, value: 68.9, pago: true, statusPagamento: 'pago', formaPagamento: 'Pix',
  itens: [{ nome: 'Pizza de calabresa', quantidade: 1 }, { nome: 'Refrigerante 2 L', quantidade: 1 }],
  checklist: { version: 'demo-v1', detailsUnavailable: false, requiresExtraRecheck: false, items: [
    { key: 'pizza', name: 'Pizza de calabresa', quantity: 1, extra: false },
    { key: 'bebida', name: 'Refrigerante 2 L', quantity: 1, extra: false },
  ] },
});
const orders = [order(1042, 'Marina Costa', 'Av. Afonso Pena, 1200', -18.9179, -48.2684), order(1043, 'Lucas Santos', 'Rua Olegário Maciel, 550', -18.9212, -48.2755)];
const stops = () => orders.map((pedido, position) => ({ pedidoId: pedido.id, position: position + 1, status: scene === 'offer' ? 'offered' : 'assigned', pedido, earnings: { mode: 'delivery', rate: position ? 10 : 8, amount: position ? 10 : 8 } }));
const queue = () => ({ motoboyId: 1, estabelecimentoId: shopId, version: 3, routeState: scene === 'pickup' ? 'delivering' : 'idle', current: scene === 'pickup' ? stops()[0] : null, next: scene === 'pickup' ? stops().slice(1) : [], offer: scene === 'offer' ? { offerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', expiresAtUtc: new Date(Date.now() + 300000).toISOString(), stops: stops() } : null });
const work = () => ({
  plan: { id: 'demo-plan', mode: 'delivery', rate: 8, createdAtUtc: now() },
  entries: Array.from({ length: 8 }, (_, i) => ({ id: `entry-${i}`, kind: 'delivery', mode: 'delivery', amount: i % 2 ? 10 : 8, storeCash: 0, pedidoId: 1034 + i, stopId: i + 1, fromUtc: now(), toUtc: now() })),
  settlementEntries: [], settlements: [], balance: { outstanding: 72, cashToReturn: 0 },
  history: Array.from({ length: 8 }, (_, i) => ({ stopId: i + 1, pedidoId: 1034 + i, status: 'completed', district: 'Centro', amount: i % 2 ? 10 : 8, mode: 'delivery', assignedAtUtc: now(), pickedUpAtUtc: now(), arrivedAtUtc: now(), updatedAtUtc: now() })),
  earnings: 72, unpricedDeliveries: 0, unconfirmedReceipts: 0, support: [],
});
const messages = () => [
  { body: 'Oi, Rafael! Seus pedidos já estão sendo preparados.', mine: false, senderName: 'Pizzaria Central' },
  { body: 'Combinado! Estou a caminho da loja.', mine: true, senderName: user.nome },
  { body: 'A retirada é no balcão. São duas entregas no Centro.', mine: false, senderName: 'Pizzaria Central' },
  { body: 'Pode deixar. Vou conferir os pedidos antes de sair.', mine: true, senderName: user.nome },
  { body: 'Tudo pronto! Boa rota e qualquer dúvida chama aqui.', mine: false, senderName: 'Pizzaria Central' },
].map((m, i) => ({ ...m, id: `message-${i}`, sequence: i + 1, channel: 'store', threadKey: 'store', senderKey: m.mine ? 'motoboy:1' : 'operator:1', motoboyId: m.mine ? 1 : null, createdAtUtc: new Date(Date.now() - (5 - i) * 60000).toISOString(), readCount: 1, read: true, mentioned: false, mentions: [], reactions: [], type: 'text', status: 'delivered' }));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`), p = url.pathname;
  let raw = ''; for await (const chunk of req) raw += chunk;
  let body; try { body = raw ? JSON.parse(raw) : {} } catch { body = {} }
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(data)); };
  const ok = data => send({ success: true, data });
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); return res.end(); }
  if (p === '/demo/scene') { scene = url.searchParams.get('name') || 'home'; console.log('Cena:', scene); return ok(scene); }
  if (p === '/demo/status') return ok({ scene, active, locationCount, lastLocation });
  console.log(req.method, p);
  if (p.endsWith('/negotiate')) return send({ negotiateVersion: 1, connectionId: 'demo', connectionToken: 'demo', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] });
  if (p.endsWith('/auth/login') || p.endsWith('/auth/refresh')) return ok(tokenData);
  if (p.endsWith('/vinculos') || p.endsWith('/me/estabelecimentos')) return ok([{ estabelecimentoId: shopId, id: shopId, nome: 'Pizzaria Central', tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo', modulosAtivos: ['DELIVERY'] }]);
  if (p.endsWith('/definir-estabelecimento')) return ok({ ...tokenData, estabelecimentoId: shopId, estabelecimentoSelecionado: { id: shopId, nome: 'Pizzaria Central', modulosAtivos: ['DELIVERY'] } });
  if (p.endsWith('/session/start')) { active = true; return ok({ establishmentId: shopId, accessToken: 'google-play-demo-operational', motoboy: { id: 1 }, session: session() }); }
  if (p.endsWith('/session') && req.method === 'DELETE') { active = false; return ok(true); }
  if (p.endsWith('/session')) return active ? ok(session()) : ok(null);
  if (p.endsWith('/heartbeat')) return ok({ accessToken: 'google-play-demo-operational', session: session() });
  if (p.endsWith('/queue') || p.endsWith('/queue/resume')) return ok(queue());
  if (p.endsWith('/offer/accept')) { scene = 'pickup'; return ok(queue()); }
  if (p.endsWith('/offer/reject')) { scene = 'home'; return ok(queue()); }
  if (p.endsWith('/preferences')) return ok({ compartilharLocalizacaoCliente: false });
  if (p.endsWith('/pause')) return ok(queue());
  if (p.endsWith('/location/batch')) { receivedLocations(body.samples || []); return ok({ samples: (body.samples || []).map(s => ({ sampleId: s.sampleId, sequence: s.sequence, outcome: 'accepted', updatedCurrent: true, receivedAtUtc: now() })) }); }
  if (p.endsWith('/location')) { receivedLocations([body]); return ok({ sampleId: body.sampleId, sequence: body.sequence, outcome: 'accepted', updatedCurrent: true, receivedAtUtc: now() }); }
  if (p.endsWith('/store')) return ok({ nome: 'Pizzaria Central', latitude: -18.9208, longitude: -48.2742 });
  if (p.endsWith('/work')) return ok(work());
  if (p.endsWith('/perfil')) return ok({ motoboyId: 1, ...user, statusCadastro: 'ativo', cidade: 'Uberlândia', uf: 'MG' });
  const orderMatch = p.match(/\/orders\/(1042|1043)$/); if (orderMatch) return ok(orders.find(o => o.id === Number(orderMatch[1])));
  if (p.endsWith('/messages')) return ok({ messages: messages(), hasMore: false });
  if (p.endsWith('/contacts')) return ok({ contacts: [{ motoboyId: 2, nome: 'Diego Martins', online: true }], hasMore: false });
  if (p.endsWith('/read')) return ok(true);
  if (p.endsWith('/notifications') || p.endsWith('/transfers') || p.endsWith('/documentos')) return ok([]);
  if (p.includes('login-session')) return ok({ active: true, isActive: true });
  return ok(null);
});
const sockets = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => sockets.handleUpgrade(req, socket, head, ws => sockets.emit('connection', ws, req)));
sockets.on('connection', ws => {
  let greeted = false;
  ws.on('message', buffer => {
    for (const part of buffer.toString().split('\x1e').filter(Boolean)) {
      const msg = JSON.parse(part);
      if (msg.protocol) { ws.send('{}\x1e'); greeted = true; }
      else if (msg.invocationId) ws.send(JSON.stringify({ type: 3, invocationId: msg.invocationId }) + '\x1e');
    }
  });
  const timer = setInterval(() => { if (greeted && ws.readyState === 1) ws.send('{"type":6}\x1e'); }, 10000);
  ws.on('close', () => clearInterval(timer));
});
server.listen(port, '127.0.0.1', () => console.log(`API de demonstração local: http://127.0.0.1:${port}`));
