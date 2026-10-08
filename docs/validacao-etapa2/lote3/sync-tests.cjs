// Regras de sincronização reais; rede, relógio e GPS controlados, sem produção.
const test = require('node:test'), assert = require('node:assert/strict');
const { load, fixture, trackingFixture, deferred, session, blankQueue, location } = require('./session-tests.cjs');
const { createOperationalRequestCoordinator } = load('services/operationalRequests.ts');
const { createOperationalQueueSync } = load('services/operationalQueueSync.ts');
const turn = { accessToken: 'renovado-qa', session };
const settle = () => new Promise(setImmediate);

test('50 consultas simultâneas compartilham uma leitura; próxima consulta é nova', async () => {
  const coordinator = createOperationalRequestCoordinator(), wait = deferred(); let requests = 0;
  const request = () => { requests++; return wait.promise; };
  const reads = Array.from({ length: 50 }, () => coordinator.queue('token', request));
  await settle(); assert.equal(requests, 1); wait.resolve(blankQueue);
  assert.ok((await Promise.all(reads)).every(queue => queue === blankQueue));
  await coordinator.queue('token', async () => { requests++; return blankQueue; });
  assert.equal(requests, 2);
});
test('falha não envenena próximas leituras; tokens de outro turno não compartilham', async () => {
  const coordinator = createOperationalRequestCoordinator(); let requests = 0;
  const request = async () => { if (++requests === 1) throw new Error('Sem rede'); return blankQueue; };
  await assert.rejects(coordinator.queue('a', request));
  await Promise.all([coordinator.queue('a', request), coordinator.queue('b', request)]);
  assert.equal(requests, 3);
});
test('heartbeats compartilham ACK real, inclusive token renovado, sem adiar prazo', async () => {
  let now = 100000, requests = 0;
  const coordinator = createOperationalRequestCoordinator(() => now);
  const request = async () => { requests++; return turn; };
  await Promise.all(Array.from({ length: 30 }, () => coordinator.heartbeat('original', request)));
  assert.equal(requests, 1);
  now += 19000; await coordinator.heartbeat('renovado-qa', request); assert.equal(requests, 1);
  now += 1000; await coordinator.heartbeat('renovado-qa', request); assert.equal(requests, 2);
});
test('restauração força confirmação e sessão encerrada nunca entra no cache', async () => {
  let requests = 0; const coordinator = createOperationalRequestCoordinator(() => 1000);
  const request = async () => { requests++; return turn; };
  await coordinator.heartbeat('a', request); await coordinator.heartbeat('a', request, true);
  assert.equal(requests, 2);
  const ended = createOperationalRequestCoordinator();
  const end = async () => { requests++; return { ...turn, session: { ...session, isEnded: true } }; };
  await ended.heartbeat('a', end); await ended.heartbeat('a', end); assert.equal(requests, 4);
});
test('ACK atrasado de outra sessão não substitui cache do contexto novo', async () => {
  const old = deferred(), coordinator = createOperationalRequestCoordinator(() => 1000);
  const pending = coordinator.heartbeat('antigo', () => old.promise); await settle();
  await coordinator.heartbeat('novo', async () => ({ ...turn, accessToken: 'novo-renovado' }));
  old.resolve(turn); await pending;
  await coordinator.heartbeat('novo-renovado', () => { throw new Error('Não deve consultar'); });
});
test('foreground e tarefa GPS usam a mesma renovação e timestamp do ACK', async () => {
  const wait = deferred(), f = trackingFixture({ heartbeat: () => wait.promise });
  const foreground = f.api.heartbeatOperationalSession({ persist: false });
  const background = f.tracking.maintainOperationalPresence(); await settle();
  assert.equal(f.lifecycle.filter(x => x === 'heartbeat').length, 1);
  assert.equal(f.secure.has('tracking.heartbeat.v3.turno-qa.4'), false);
  wait.resolve(turn); await foreground; assert.equal(await background, true);
  const timestamp = f.secure.get('tracking.heartbeat.v3.turno-qa.4'); assert.ok(timestamp);
  await f.api.heartbeatOperationalSession({ persist: false });
  assert.equal(f.secure.get('tracking.heartbeat.v3.turno-qa.4'), timestamp);
  assert.equal(f.lifecycle.filter(x => x === 'heartbeat').length, 1);
});
test('heartbeat normal não busca fila; reconexão recupera fila preservada', async () => {
  const f = fixture(); await f.store.restore(); const reads = f.count('queue');
  await f.store.tick(); assert.equal(f.count('queue'), reads);
  const good = f.ports.heartbeat; f.ports.heartbeat = async () => { throw { code: 'ECONNABORTED', message: 'Conexão lenta' }; };
  await f.store.tick(); assert.equal(f.store.getSnapshot().phase, 'reconnecting'); assert.ok(f.store.getSnapshot().queue);
  f.ports.heartbeat = good; await f.store.tick();
  assert.equal(f.count('queue'), reads + 1); assert.equal(f.store.getSnapshot().error, null);
});
test('leitura lenta da fila não impede a presença e leituras concorrentes juntam', async () => {
  const f = fixture(); await f.store.restore(); const wait = deferred(), heartbeats = f.count('heartbeat'); let reads = 0;
  f.ports.queue = () => { reads++; return wait.promise; };
  const first = f.store.refreshQueue(), second = f.store.refreshQueue(); await settle();
  assert.equal(first, second); assert.equal(reads, 1);
  assert.equal(await f.store.tick(), true); assert.equal(f.count('heartbeat'), heartbeats + 1);
  wait.resolve({ ...blankQueue, version: 2 }); assert.equal(await first, true);
});
test('ACK reutilizado não regride versão de sessão mais recente', async () => {
  const f = fixture(); await f.store.restore();
  f.ports.heartbeat = async () => ({ ...turn, session: { ...session, version: 8 } }); await f.store.tick();
  f.ports.heartbeat = async () => turn; await f.store.tick();
  assert.equal(f.store.getSnapshot().session.version, 8);
});
test('leitura antiga não restaura online durante encerramento', async () => {
  const f = fixture(); await f.store.restore(); const read = deferred(), ack = deferred(); let n = 0;
  f.ports.queue = async () => ++n === 1 ? read.promise : blankQueue;
  f.ports.end = () => ack.promise;
  const reading = f.store.refreshQueue(); await settle(); const ending = f.store.end(); await settle();
  assert.equal(f.store.getSnapshot().phase, 'ending');
  read.resolve({ ...blankQueue, current: { pedido: { id: 99 } } }); assert.equal(await reading, false);
  assert.equal(f.store.getSnapshot().phase, 'ending'); ack.resolve(); assert.equal(await ending, true);
});
test('GPS lento não segura heartbeat; renovação concorrente é única', async () => {
  const wait = deferred(), f = trackingFixture({ location: () => wait.promise });
  const sending = f.tracking.sendLocation(location(1), 'active_route'); await settle(); assert.equal(f.sent.length, 1);
  assert.ok((await Promise.all(Array.from({ length: 10 }, () => f.tracking.maintainOperationalPresence()))).every(Boolean));
  assert.deepEqual(f.lifecycle, ['heartbeat']); wait.resolve(); await sending;
});
test('GPS recupera doze pontos com um único HTTP e mantém a ordem', async () => {
  const f = trackingFixture(); f.fail(true);
  for (let i = 0; i < 12; i++) await f.tracking.sendLocation(location(i), 'active_route', { force: true });
  assert.equal(f.sent.length, 1); // Cooldown evita doze tentativas de rede.
  f.fail(false); f.sent.length = 0; await f.tracking.flushLocationQueue();
  assert.equal(f.requests.length, 2); // Uma tentativa offline e um lote recuperado.
  assert.deepEqual(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')), []);
  await f.tracking.flushLocationQueue(); await f.tracking.flushLocationQueue();
  assert.deepEqual(f.sent.map(x => x.payload.sequence), Array.from({ length: 12 }, (_, i) => i + 1));
});
test('parado e offline, amostras repetidas não lotam fila nem escrevem sequência', async () => {
  const f = trackingFixture(), start = location(0); f.fail(true);
  for (let i = 0; i < 12; i++) await f.tracking.sendLocation({ ...start, timestamp: start.timestamp + i * 1000 }, 'online_idle');
  assert.equal(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')).length, 1);
  assert.equal(f.secure.get('tracking.sequence.v3.turno-qa.4'), '1'); assert.equal(f.sent.length, 1);
});

test('histórico acumulado usa no máximo vinte pontos por HTTP e drena sem cem requests', async () => {
  const f = trackingFixture(); f.fail(true);
  for (let i = 0; i < 100; i++) await f.tracking.sendLocation(location(i), 'active_route', { force: true });
  f.fail(false); f.requests.length = 0; f.sent.length = 0;
  await f.tracking.flushLocationQueue();
  assert.equal(f.requests.length, 5); assert.ok(f.requests.every(r => r.payload.samples.length === 20));
  assert.deepEqual(f.sent.map(s => s.payload.sequence), Array.from({ length: 100 }, (_, i) => i + 1));
  assert.deepEqual(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')), []);
});

test('API anterior usa fallback limitado e só remove pontos confirmados', async () => {
  const f = trackingFixture({ legacy: true }); f.fail(true);
  for (let i = 0; i < 8; i++) await f.tracking.sendLocation(location(i), 'active_route', { force: true });
  f.fail(false); f.sent.length = 0; f.requests.length = 0;
  await f.tracking.flushLocationQueue();
  assert.equal(f.requests.length, 5); assert.ok(f.requests.every(r => r.endpoint === '/location'));
  assert.deepEqual(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')).map(s => s.sequence), [6, 7, 8]);
  await f.tracking.flushLocationQueue();
  assert.deepEqual(f.sent.map(s => s.payload.sequence), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('ACK incompleto ou de outra amostra mantém todos os pontos para reenvio', async () => {
  for (const ack of [() => [], acks => acks.map(a => ({ ...a, sampleId: 'outra-amostra' }))]) {
    const f = trackingFixture({ ack });
    await f.tracking.sendLocation(location(1), 'active_route');
    assert.equal(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')).length, 1);
    assert.equal(f.secure.has('tracking.sent.v3.turno-qa.4'), false);
  }
});

test('pontos rejeitados ou anteriores saem só após confirmação individual da API', async () => {
  const f = trackingFixture({ ack: acks => acks.map((a, i) => ({ ...a,
    outcome: i === 0 ? 'rejected' : i === 1 ? 'stale' : 'accepted', code: i === 0 ? 'LOCATION_INVALID' : undefined })) });
  f.fail(true);
  for (let i = 0; i < 3; i++) await f.tracking.sendLocation(location(i), 'active_route', { force: true });
  f.fail(false); await f.tracking.flushLocationQueue();
  assert.deepEqual(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')), []);
  assert.equal(JSON.parse(f.secure.get('tracking.sent.v3.turno-qa.4')).sequence, 3);
});

test('sem contador local usa próxima sequência confirmada pelo servidor', async () => {
  const f = trackingFixture(); f.secure.set('operationalSession', JSON.stringify({ ...session, nextLocationSequence: 50 }));
  await f.tracking.sendLocation(location(1), 'active_route');
  assert.equal(f.sent[0].payload.sequence, 50);
});

test('sensores indisponíveis -1 viram null antes do envio', async () => {
  const f = trackingFixture(), point = location(1);
  await f.tracking.sendLocation({ ...point, coords: { ...point.coords, speed: -1, heading: -1, accuracy: -1 } });
  assert.equal(f.sent[0].payload.speedMps, null); assert.equal(f.sent[0].payload.headingDegrees, null);
  assert.equal(f.sent[0].payload.accuracyMeters, null);
});
test('limpeza aguarda renovação headless e impede que ACK antigo restaure credenciais', async () => {
  const wait = deferred(), f = trackingFixture({ heartbeat: () => wait.promise });
  const renewing = f.tracking.maintainOperationalPresence(); await settle();
  const clearing = f.tracking.clearCurrentTrackingData(); await settle();
  wait.resolve(turn); assert.equal(await renewing, false); await clearing;
  assert.equal(f.secure.get('operationalAccessToken'), 'token-qa');
  assert.equal(f.secure.has('tracking.heartbeat.v3.turno-qa.4'), false);
  await f.tracking.sendLocation(location(1)); assert.equal(f.sent.length, 0);
});
test('fix de GPS atrasado não envia amostra de outro turno', async () => {
  const wait = deferred(), f = trackingFixture({ currentPosition: () => wait.promise });
  const reading = f.tracking.sendCurrentLocation(); await settle();
  f.secure.set('operationalSession', JSON.stringify({ ...session, sessionId: 'outra-sessao' }));
  f.secure.set('operationalAccessToken', 'novo-token'); wait.resolve(location(1)); await reading;
  assert.equal(f.sent.length, 0);
});
test('iniciar monitoramento confirma serviço sem esperar primeira posição e HTTP', async () => {
  const wait = deferred(); let running = false, firstPosition = 0;
  const setup = load('components/locationSetup.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-location': { Accuracy: { Balanced: 3 }, getForegroundPermissionsAsync: async () => ({ granted: true }), getBackgroundPermissionsAsync: async () => ({ granted: true }), hasServicesEnabledAsync: async () => true, hasStartedLocationUpdatesAsync: async () => running, startLocationUpdatesAsync: async () => { running = true; } },
    '../utils/secureStorage': { getSecureItem: async key => key === 'operationalSession' ? JSON.stringify(session) : 'token-qa' },
    '../services/trackingService': { setTrackingMode: async () => {}, sendCurrentLocation: () => { firstPosition++; return wait.promise; } },
  });
  assert.equal(await setup.iniciarMonitoramentoLocalizacao(), true); assert.equal(firstPosition, 1);
  wait.resolve();
});
test('tarefa nativa envia GPS enquanto heartbeat lento permanece em andamento', async () => {
  const wait = deferred(); let task, sent = 0;
  load('components/locationTask.ts', {
    'expo-task-manager': { defineTask: (_name, handler) => { task = handler; } },
    '../services/trackingService': { getTrackingMode: async () => 'active_route', maintainOperationalPresence: () => wait.promise, sendLocation: async () => { sent++; } },
  });
  const callback = task({ data: { locations: [location(1)] } }); await settle();
  assert.equal(sent, 1); wait.resolve(true); await callback;
});

test('SDK SignalR real conecta, recebe mudança e reconcilia após reconexão', async () => {
  const http = require('node:http'), { WebSocketServer } = require(require.resolve('ws', { paths: [require('node:path').resolve(__dirname, '../../../node_modules')] }));
  const server = http.createServer(), sockets = new Set();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const wsServer = new WebSocketServer({ server });
  let connects = 0, reads = 0, version = 1, latest, stop;
  wsServer.on('connection', (socket, req) => {
    connects++; sockets.add(socket); latest = socket;
    assert.equal(req.headers.authorization, 'Bearer token-ficticio'); assert.equal(req.url, '/hubs/delivery');
    socket.on('close', () => sockets.delete(socket));
    socket.on('message', data => {
      const messages = data.toString().split('\x1e').filter(Boolean).map(JSON.parse);
      if (messages.some(msg => msg.protocol === 'json')) socket.send('{}\x1e');
    });
  });
  const waitUntil = async predicate => {
    for (let i = 0; i < 250 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(predicate(), 'A conexão/evento deve completar');
  };
  try {
    const { startOperationalRealtime } = load('services/operationalRealtime.ts', {
      '../config/apiConfig': { API_CONFIG: { BASE_URL: `http://127.0.0.1:${server.address().port}/api` } },
    });
    stop = startOperationalRealtime({ token: async () => 'token-ficticio', refresh: async () => { reads++; version = Math.max(3, version); return true; }, version: () => version, scope: () => ({ establishmentId: 'loja', motoboyId: 22 }) });
    await waitUntil(() => reads === 1);
    latest.send(JSON.stringify({ type: 1, target: 'delivery.queue.updated', arguments: [{ estabelecimentoId: 'loja', motoboyId: 22, version: 4 }] }) + '\x1e');
    await waitUntil(() => reads === 2);
    latest.terminate(); await waitUntil(() => connects === 2 && reads === 3);
    assert.equal(connects, 2); assert.equal(reads, 3);
  } finally {
    if (stop) stop();
    for (const socket of sockets) socket.terminate();
    await new Promise(resolve => wsServer.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
});

function syncFixture(overrides = {}) {
  let version = 1, reads = 0, serial = 0; const timers = new Map();
  const sync = createOperationalQueueSync({
    refresh: async () => { reads++; return true; }, version: () => version,
    scope: () => ({ establishmentId: 'LOJA', motoboyId: 22 }),
    setTimer: (callback, delay) => { timers.set(++serial, { callback, delay }); return serial; },
    clearTimer: id => timers.delete(id), ...overrides,
  });
  async function fire(delay) {
    const match = [...timers].find(([, task]) => task.delay === delay); assert.ok(match, 'Timer ' + delay);
    timers.delete(match[0]); match[1].callback(); await settle();
  }
  return { sync, timers, fire, reads: () => reads, version: next => { version = next; } };
}
const event = version => ({ estabelecimentoId: 'loja', motoboyId: 22, version });
test('conectado reduz radar de 15 para 60 segundos, sem ignorar eventos', async () => {
  const f = syncFixture(); assert.ok([...f.timers.values()].some(x => x.delay === 15000));
  f.sync.connection(true); await f.fire(180); assert.equal(f.reads(), 1);
  assert.ok([...f.timers.values()].some(x => x.delay === 60000));
  f.sync.event(event(2)); await f.fire(180); assert.equal(f.reads(), 2);
  f.sync.connection(false); await f.fire(15000); assert.equal(f.reads(), 3); f.sync.stop();
});
test('cem eventos da mesma versão geram uma consulta; tenant estranho é ignorado', async () => {
  const f = syncFixture();
  f.sync.event({ ...event(2), estabelecimentoId: 'outra-loja' }); f.sync.event({ ...event(2), motoboyId: 23 });
  assert.equal([...f.timers.values()].filter(x => x.delay === 180).length, 0);
  for (let i = 0; i < 100; i++) f.sync.event(event(2));
  assert.equal([...f.timers.values()].filter(x => x.delay === 180).length, 1);
  await f.fire(180); assert.equal(f.reads(), 1); f.sync.stop();
});
test('evento mais novo durante consulta não é perdido nem cria consultas paralelas', async () => {
  let reads = 0, version = 1; const wait = deferred();
  const f = syncFixture({ version: () => version, refresh: async () => { reads++; if (reads === 1) await wait.promise; return true; } });
  f.sync.event(event(2)); await f.fire(180); f.sync.event(event(3)); assert.equal(reads, 1);
  version = 2; wait.resolve(); await settle(); await f.fire(180); assert.equal(reads, 2); f.sync.stop();
});
test('snapshot que já contém a rajada evita uma segunda leitura', async () => {
  let version = 1; const wait = deferred();
  const f = syncFixture({ version: () => version, refresh: () => wait.promise });
  f.sync.event(event(2)); await f.fire(180); f.sync.event(event(3)); version = 3; wait.resolve(true); await settle();
  assert.equal([...f.timers.values()].filter(x => x.delay === 180).length, 0); f.sync.stop();
});
test('falhas aplicam espera progressiva; desconectar/desmontar limpa timers', async () => {
  const f = syncFixture({ refresh: async () => false });
  await f.fire(15000); await f.fire(30000); await f.fire(60000);
  f.sync.connection(true); assert.ok([...f.timers.values()].some(x => x.delay === 180));
  f.sync.stop(); assert.equal(f.timers.size, 0); f.sync.event(event(4)); assert.equal(f.timers.size, 0);
});

async function withAdapter(fetchMock, work) {
  const originalFetch = global.fetch, originalWarn = console.warn, originalError = console.error;
  const logs = [], failures = [];
  try {
    global.fetch = fetchMock; console.warn = (...args) => logs.push(args); console.error = (...args) => logs.push(args);
    const config = { BASE_URL: 'https://api.exemplo.invalid/api', TIMEOUT: 25, DEFAULT_HEADERS: {}, ENDPOINTS: { LOGIN: '/auth/login', REFRESH_TOKEN: '/auth/refresh' } };
    const secure = new Map(['authToken', 'operationalAccessToken', 'refreshToken'].map(key => [key, 'credencial-ficticia']));
    const api = load('services/apiService.ts', {
      '../config/apiConfig': { API_CONFIG: config, getApiUrl: path => config.BASE_URL + path, validateApiConfig: () => true },
      '../utils/secureStorage': { getSecureItem: async key => secure.get(key) ?? null, setSecureItem: async (key, value) => secure.set(key, value), deleteSecureItem: async key => secure.delete(key) },
      './sessionEvents': { reportOperationalFailure: failure => failures.push(failure) },
    });
    await work(api.apiClient, logs, failures, secure);
  } finally { global.fetch = originalFetch; console.warn = originalWarn; console.error = originalError; }
}
const stalledFetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
test('timeout gera um aviso, preserva código e não expõe headers ou credencial', async () => {
  await withAdapter(stalledFetch, async (api, logs) => {
    await assert.rejects(api.get('/v2/motoboys/me/session/queue'), error => error.code === 'ECONNABORTED');
    assert.equal(logs.length, 1); assert.match(logs[0][0], /aguarda conexão/);
    assert.doesNotMatch(JSON.stringify(logs), /credencial-ficticia|Authorization|headers/);
  });
});
test('cancelamento solicitado é diferente de timeout e não dispara LogBox', async () => {
  await withAdapter(stalledFetch, async (api, logs) => {
    const controller = new AbortController();
    const request = api.get('/v2/motoboys/me/session/queue', { signal: controller.signal, timeout: 1000 });
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(request, error => error.code === 'ERR_CANCELED'); assert.equal(logs.length, 0);
  });
});
test('erro de rede não é 401; 500 mantém HTTP e falha uma única vez', async () => {
  await withAdapter(async () => { throw new Error('Failed to fetch'); }, async (api, logs, failures) => {
    await assert.rejects(api.get('/v2/motoboys/me/session/queue'), error => error.code === 'ERR_NETWORK');
    assert.equal(failures.length, 0); assert.equal(logs.length, 1);
  });
  await withAdapter(async () => new Response('{}', { status: 500 }), async (api, logs) => {
    await assert.rejects(api.get('/v2/motoboys/me/session/queue'), error => error.response.status === 500);
    assert.equal(logs.length, 1);
  });
});
test('timeout não repete confirmação de entrega automaticamente', async () => {
  let writes = 0;
  await withAdapter((url, opts) => { writes++; return stalledFetch(url, opts); }, async api => {
    await assert.rejects(api.post('/v2/motoboys/me/session/stops/current/deliver', { codigo: '1234' }));
    assert.equal(writes, 1);
  });
});
test('401 operacional não renova login; reporta exatamente o token dessa chamada', async () => {
  let reads = 0;
  await withAdapter(async () => { reads++; return new Response(JSON.stringify({ success: false, code: 'SESSION_EXPIRED' }), { status: 401 }); }, async (api, logs, failures) => {
    await api.get('/v2/motoboys/me/session/queue');
    assert.equal(reads, 1); assert.equal(failures.length, 1); assert.equal(failures[0].token, 'credencial-ficticia'); assert.equal(logs.length, 0);
  });
});
test('503 preserva mensagem do servidor para retry sem triplicar LogBox', async () => {
  await withAdapter(async () => new Response(JSON.stringify({ error: 'Lista temporariamente indisponível.' }), { status: 503 }), async (api, logs) => {
    await assert.rejects(api.get('/motoboys/me/vinculos'), error => error.response.status === 503 && error.message === 'Lista temporariamente indisponível.');
    assert.equal(logs.length, 1); assert.match(logs[0][0], /aguarda conexão/);
  });
});
test('401 principal concorrente compartilha refresh e repete cada leitura uma vez', async () => {
  let refreshes = 0; const wait = deferred();
  await withAdapter(async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; await wait.promise; return new Response(JSON.stringify({ success: true, data: { accessToken: 'novo-principal' } })); }
    const headers = options.headers;
    return new Response('{}', { status: headers.Authorization === 'Bearer novo-principal' ? 200 : 401 });
  }, async api => {
    const reads = Array.from({ length: 8 }, () => api.get('/motoboys/me/vinculos'));
    await settle(); assert.equal(refreshes, 1); wait.resolve();
    assert.ok((await Promise.all(reads)).every(response => response.status === 200)); assert.equal(refreshes, 1);
  });
});

test('503 na renovação preserva o erro de infraestrutura e as credenciais', async () => {
  await withAdapter(async url => new Response(JSON.stringify({ error: 'Banco temporariamente indisponível.' }), { status: url.endsWith('/auth/refresh') ? 503 : 401 }), async (api, logs, failures, secure) => {
    await assert.rejects(api.get('/motoboys/me/vinculos'), error => error.response?.status === 503);
    assert.equal(secure.get('refreshToken'), 'credencial-ficticia');
    assert.equal(secure.get('authToken'), 'credencial-ficticia');
    assert.equal(failures.length, 0); assert.equal(logs.length, 1);
    assert.match(logs[0][0], /aguarda conexão/);
  });
});

test('rede e timeout no refresh não viram 401 nem removem credenciais', async () => {
  for (const code of ['ERR_NETWORK', 'ECONNABORTED']) {
    await withAdapter(async (url, options) => {
      if (!url.endsWith('/auth/refresh')) return new Response('{}', { status: 401 });
      if (code === 'ECONNABORTED') return stalledFetch(url, options);
      throw new TypeError('Failed to fetch');
    }, async (api, logs, failures, secure) => {
      await assert.rejects(api.get('/motoboys/me/vinculos'), error => error.code === code && !error.response);
      assert.equal(secure.get('refreshToken'), 'credencial-ficticia');
      assert.equal(secure.get('authToken'), 'credencial-ficticia');
      assert.equal(failures.length, 0); assert.equal(logs.length, 1);
      assert.doesNotMatch(JSON.stringify(logs), /credencial-ficticia|Authorization/);
    });
  }
});

test('refresh recusado mantém 401 definitivo sem repetição infinita', async () => {
  let reads = 0;
  await withAdapter(async () => { reads++; return new Response('{}', { status: 401 }); }, async (api, logs, failures, secure) => {
    assert.equal((await api.get('/motoboys/me/vinculos')).status, 401);
    assert.equal(reads, 2); assert.equal(secure.has('refreshToken'), false);
    assert.equal(secure.get('operationalAccessToken'), 'credencial-ficticia');
    assert.equal(failures.length, 0); assert.equal(logs.length, 0);
  });
});

test('acesso legado sem refresh exige novo login sem inventar uma renovação', async () => {
  let reads = 0;
  await withAdapter(async () => { reads++; return new Response('{}', { status: 401 }); }, async (api, logs, failures, secure) => {
    secure.delete('refreshToken');
    assert.equal((await api.get('/motoboys/me/vinculos')).status, 401);
    assert.equal(reads, 1); assert.equal(failures.length, 0);
  });
});

test('resposta inválida de refresh conserva o acesso para tentar novamente', async () => {
  await withAdapter(async url => new Response('invalid-json', { status: url.endsWith('/auth/refresh') ? 200 : 401 }), async (api, logs, failures, secure) => {
    await assert.rejects(api.get('/motoboys/me/vinculos'), error => error.code === 'ERR_BAD_RESPONSE' && error.response?.status === 200);
    assert.equal(secure.get('authToken'), 'credencial-ficticia');
    assert.equal(secure.get('refreshToken'), 'credencial-ficticia');
    assert.equal(failures.length, 0);
  });
});

test('refresh atrasado não sobrescreve nem apaga o acesso de outro login', async () => {
  for (const status of [200, 401]) {
    const wait = deferred();
    await withAdapter(async url => {
      if (!url.endsWith('/auth/refresh')) return new Response('{}', { status: 401 });
      await wait.promise;
      return new Response(JSON.stringify({ accessToken: 'renovado-antigo', refreshToken: 'refresh-antigo' }), { status });
    }, async (api, logs, failures, secure) => {
      const read = api.get('/motoboys/me/vinculos');
      const rejected = assert.rejects(read, error => error.code === 'ERR_CANCELED');
      await settle();
      secure.set('authToken', 'outro-login'); secure.set('refreshToken', 'outro-refresh');
      wait.resolve(); await rejected;
      assert.equal(secure.get('authToken'), 'outro-login');
      assert.equal(secure.get('refreshToken'), 'outro-refresh');
      assert.equal(logs.length, 0); assert.equal(failures.length, 0);
    });
  }
});

test('401 persistente após renovar repete a consulta somente uma vez', async () => {
  let reads = 0, refreshes = 0;
  await withAdapter(async url => {
    if (url.endsWith('/auth/refresh')) { refreshes++; return new Response(JSON.stringify({ accessToken: 'novo' })); }
    reads++; return new Response('{}', { status: 401 });
  }, async api => {
    assert.equal((await api.get('/motoboys/me/vinculos')).status, 401);
    assert.equal(reads, 2); assert.equal(refreshes, 1);
  });
});
