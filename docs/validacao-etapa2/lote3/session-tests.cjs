// Testes das regras reais do lote 2.3, sem chamadas ao backend ou ao GPS.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '../../..'), ts = require(path.join(root, 'node_modules/typescript'));
function load(relative, mocks = {}) {
  const file = path.join(root, relative), mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    const local = path.resolve(path.dirname(file), name + '.ts');
    if (name.startsWith('.') && fs.existsSync(local)) return load(path.relative(root, local), mocks);
    return original(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
  return mod.exports;
}
const { createOperationalSessionStore } = load('src/session/operationalSessionStore.ts');
const owner = { userId: 'qa', establishmentId: 'loja-qa' };
const session = { sessionId: 'turno-qa', epoch: 4, isEnded: false, heartbeatIntervalSeconds: 20, version: 1 };
const token = { accessToken: 'operacional-qa', establishmentId: owner.establishmentId, session, motoboy: {} };
const blankQueue = { version: 1, current: null, next: [], routeState: 'idle' };
const permissions = { ready: true, services: true, foreground: { granted: true }, background: { granted: true }, notifications: { granted: false } };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function fixture(savedInitially = true, overrides = {}) {
  const log = []; let saved = savedInitially ? { token: token.accessToken, session, ...owner, establishmentId: owner.establishmentId } : null;
  let attemptId = null;
  const ports = {
    stored: async () => saved,
    attempt: async () => { attemptId ??= 'attempt-qa'; log.push(['attempt', attemptId]); return attemptId; },
    clearAttempt: async () => { log.push(['clearAttempt']); attemptId = null; },
    start: async id => { log.push(['start', id]); return token; },
    current: async () => { log.push(['current']); return session; },
    heartbeat: async () => { log.push(['heartbeat']); return { accessToken: token.accessToken, session }; },
    queue: async () => { log.push(['queue']); return blankQueue; },
    save: async data => { log.push(['save']); saved = { token: data.accessToken, session: data.session, ...owner }; },
    clear: async () => { log.push(['clear']); saved = null; },
    end: async reason => { log.push(['end', reason]); },
    permissions: async () => permissions,
    monitor: async mode => { log.push(['monitor', mode]); return true; },
    stopMonitor: async () => { log.push(['stopMonitor']); },
    ...overrides,
  };
  const store = createOperationalSessionStore(ports); store.bind(owner);
  return { store, ports, log, saved: () => saved, count: name => log.filter(item => item[0] === name).length };
}
test('permissões incompletas não enviam início; notificações negadas são opcionais', async () => {
  const denied = fixture(false, { permissions: async () => ({ ...permissions, ready: false }) });
  assert.equal(await denied.store.start(), false); assert.equal(denied.count('start'), 0);
  assert.equal(denied.store.getSnapshot().phase, 'permission-required');
  const allowed = fixture(false); assert.equal(await allowed.store.start(), true); assert.equal(allowed.count('start'), 1);
});
test('repetição após timeout reutiliza attemptId e mantém tentativa recuperável', async () => {
  let attempts = 0; const received = [];
  const f = fixture(false, { start: async id => { received.push(id); if (++attempts === 1) throw new Error('Sem rede'); return token; } });
  assert.equal(await f.store.start(), false); assert.equal(f.saved(), null);
  assert.equal(await f.store.start(), true); assert.deepEqual(received, ['attempt-qa', 'attempt-qa']);
});
test('início duplicado e logout durante início não compartilham a operação', async () => {
  const wait = deferred(); const f = fixture(false, { start: async () => wait.promise });
  const first = f.store.start(); await new Promise(setImmediate);
  assert.equal(await f.store.start(), false); assert.equal(await f.store.end('logout'), false);
  wait.resolve(token); assert.equal(await first, true); assert.equal(f.count('end'), 0);
});
test('resposta atrasada de outro contexto não salva token nem inicia GPS', async () => {
  const wait = deferred(); const f = fixture(false, { start: async () => wait.promise });
  const first = f.store.start(); await new Promise(setImmediate);
  f.store.bind({ userId: 'outro', establishmentId: 'outra-loja' }); wait.resolve(token);
  assert.equal(await first, false); assert.equal(f.count('save'), 0); assert.equal(f.count('monitor'), 0);
});
test('turno salvo de outro usuário/loja não consulta API com token alheio', async () => {
  const f = fixture(true, { stored: async () => ({ ...token, token: token.accessToken, userId: 'outro' }) });
  assert.equal(await f.store.restore(), false); assert.equal(f.count('current'), 0); assert.equal(f.count('clear'), 0);
  assert.equal(f.store.getSnapshot().phase, 'error');
});
test('restauração consulta fila e retoma modo de rota/retorno, nunca substitui por idle', async () => {
  for (const queue of [{ ...blankQueue, current: { pedido: { id: 'pedido-qa' } } }, { ...blankQueue, routeState: 'retornando' }]) {
    const f = fixture(true, { queue: async () => queue });
    assert.equal(await f.store.restore(), true);
    assert.deepEqual(f.log.filter(item => item[0] === 'monitor'), [['monitor', 'active_route']]);
    assert.equal(f.store.getSnapshot().queue, queue);
  }
});
test('falha de rede na restauração preserva turno e credencial', async () => {
  const f = fixture(true, { current: async () => { throw new Error('Sem rede'); } });
  assert.equal(await f.store.restore(), false); assert.equal(f.store.getSnapshot().phase, 'reconnecting');
  assert.ok(f.saved()); assert.equal(f.count('clear'), 0); assert.equal(f.count('end'), 0);
});
test('401 ou encerramento confirmado invalida somente o turno e interrompe monitoramento', async () => {
  for (const current of [async () => { throw { status: 401, message: 'Turno expirado' }; }, async () => { throw { status: 403, code: 'LINK_FORBIDDEN', message: 'Vínculo desativado' }; }, async () => null, async () => ({ ...session, isEnded: true })]) {
    const f = fixture(true, { current });
    assert.equal(await f.store.restore(), false); assert.equal(f.store.getSnapshot().phase, 'expired');
    assert.equal(f.saved(), null); assert.equal(f.count('stopMonitor'), 1); assert.equal(f.count('clear'), 1);
  }
});
test('permissão revogada pausa GPS, preservando operação e fila do servidor', async () => {
  const f = fixture(); await f.store.restore();
  f.ports.permissions = async () => ({ ...permissions, ready: false });
  assert.equal(await f.store.tick(), false); assert.equal(f.store.getSnapshot().phase, 'permission-required');
  assert.ok(f.saved()); assert.equal(f.count('end'), 0); assert.equal(f.count('clear'), 0);
});
test('pedidos atuais, próximos ou retorno bloqueiam encerramento sem DELETE', async () => {
  for (const queue of [{ ...blankQueue, current: {} }, { ...blankQueue, next: [{}] }, { ...blankQueue, routeState: 'retornando' }]) {
    const f = fixture(true, { queue: async () => queue });
    assert.equal(await f.store.end('logout'), false); assert.ok(f.saved()); assert.equal(f.count('end'), 0); assert.equal(f.count('clear'), 0);
  }
});
test('409 por transferência pendente ou timeout ao encerrar preservam token e monitoramento', async () => {
  for (const error of [{ status: 409, code: 'MOTOBOY_HAS_PENDING_WORK', message: 'Transferência pendente' }, new Error('Timeout')]) {
    const f = fixture(true, { end: async () => { throw error; } }); await f.store.restore();
    assert.equal(await f.store.end('logout'), false); assert.ok(f.saved()); assert.equal(f.count('clear'), 0); assert.equal(f.count('stopMonitor'), 0);
    assert.equal(f.store.getSnapshot().phase, error.status === 409 ? 'online' : 'reconnecting');
  }
});
test('saída só limpa o contexto depois do ACK do servidor', async () => {
  const wait = deferred(); const f = fixture(true, { end: async () => wait.promise }); await f.store.restore();
  const leaving = f.store.end('logout'); await new Promise(setImmediate);
  assert.ok(f.saved()); assert.equal(f.count('clear'), 0); assert.equal(f.count('stopMonitor'), 0);
  wait.resolve(); assert.equal(await leaving, true); assert.equal(f.saved(), null); assert.equal(f.store.getSnapshot().phase, 'offline');
});
test('fila atrasada ou de outra sessão não substitui a fila atual', async () => {
  const f = fixture(); await f.store.restore();
  f.store.updateQueue({ ...blankQueue, version: 3 }, session.sessionId);
  f.store.updateQueue({ ...blankQueue, version: 2 }, session.sessionId);
  f.store.updateQueue({ ...blankQueue, version: 10 }, 'outra-sessao');
  assert.equal(f.store.getSnapshot().queue.version, 3);
});
test('radar atualiza ofertas sem renovar heartbeat a cada consulta', async () => {
  const f = fixture(); await f.store.restore(); const heartbeats = f.count('heartbeat');
  f.ports.queue = async () => ({ ...blankQueue, version: 5, offer: { id: 'oferta-qa' } });
  assert.equal(await f.store.refreshQueue(), true);
  assert.equal(f.store.getSnapshot().queue.offer.id, 'oferta-qa'); assert.equal(f.count('heartbeat'), heartbeats);
});

function trackingFixture(options = {}) {
  const secure = new Map([['operationalAccessToken', 'token-qa'], ['operationalSession', JSON.stringify(session)], ['operationalUserId', owner.userId], ['operationalEstablishmentId', owner.establishmentId], ['zippygo.user', JSON.stringify({ id: owner.userId })], ['zippygo.estabelecimentoAtual', JSON.stringify({ id: owner.establishmentId })]]), queues = new Map(), sent = [], lifecycle = [];
  let failure = false; const requests = [];
  const storage = { getSecureItem: async k => secure.get(k) ?? null, setSecureItem: async (k, v) => secure.set(k, v), deleteSecureItem: async k => secure.delete(k) };
  const api = load('services/mobileApi.ts', {
    '../utils/secureStorage': storage,
    '../config/apiConfig': { API_CONFIG: { OPERATIONAL_SYNC_TIMEOUT: 20000, ENDPOINTS: { OPERATIONAL_HEARTBEAT: '/heartbeat', OPERATIONAL_LOCATION: '/location', OPERATIONAL_LOCATION_BATCH: '/location/batch' } } },
    './apiService': { apiClient: { post: async (endpoint, payload, config) => {
      if (endpoint === '/heartbeat') {
        lifecycle.push('heartbeat');
        return { status: 200, data: { success: true, data: options.heartbeat ? await options.heartbeat() : { accessToken: 'token-renovado', session: { ...session, version: 2 } } } };
      }
      requests.push({ endpoint, payload });
      if (endpoint === '/location/batch' && options.legacy) return { status: 404 };
      const samples = endpoint === '/location/batch' ? payload.samples : [payload];
      for (const sample of samples) {
        sent.push({ payload: sample, token: config.headers.Authorization.replace(/^Bearer /, '') });
        if (options.location) await options.location(sample);
      }
      if (failure) throw new Error('Sem rede');
      const acks = samples.map(sample => ({ sampleId: sample.sampleId, sequence: sample.sequence,
        outcome: 'accepted', updatedCurrent: true, sessionVersion: 2, receivedAtUtc: new Date().toISOString() }));
      return { status: 200, data: { success: true, data: endpoint === '/location/batch'
        ? { samples: options.ack ? options.ack(acks) : acks } : acks[0] } };
    } } },
  });
  const tracking = load('services/trackingService.ts', {
    '@react-native-async-storage/async-storage': { getItem: async k => queues.get(k) ?? null, setItem: async (k, v) => queues.set(k, v), removeItem: async k => queues.delete(k) },
    'expo-location': { Accuracy: { Balanced: 3 }, getCurrentPositionAsync: async () => options.currentPosition ? options.currentPosition() : location(0), hasStartedLocationUpdatesAsync: async () => true, stopLocationUpdatesAsync: async () => lifecycle.push('stop') },
    '../utils/secureStorage': storage,
    './mobileApi': api,
    'react-native': { Platform: { OS: 'android' }, Linking: {} },
  });
  return { tracking, api, secure, queues, sent, requests, lifecycle, fail: value => { failure = value; } };
}
const location = index => ({ timestamp: Date.now() + index * 1000, coords: { latitude: -23.5 + index * .001, longitude: -46.6, accuracy: 8 } });
test('fila de GPS preserva todas as amostras depois de uma falha e reenvia na ordem', async () => {
  const f = trackingFixture(), key = 'tracking.queue.v3.turno-qa.4'; f.fail(true);
  for (let i = 0; i < 3; i++) await f.tracking.sendLocation(location(i), 'online_idle', { force: true });
  assert.deepEqual(JSON.parse(f.queues.get(key)).map(x => x.sequence), [1, 2, 3]);
  await assert.rejects(f.tracking.flushLocationQueue());
  assert.equal(JSON.parse(f.queues.get(key)).length, 3);
  f.fail(false); f.sent.length = 0; await f.tracking.flushLocationQueue();
  assert.deepEqual(f.sent.map(x => x.payload.sequence), [1, 2, 3]); assert.deepEqual(JSON.parse(f.queues.get(key)), []);
});
test('envios concorrentes têm sequências únicas e filas não atravessam sessões', async () => {
  const f = trackingFixture(); f.fail(true);
  await Promise.all([0, 1, 2].map(i => f.tracking.sendLocation(location(i), 'active_route', { force: true })));
  assert.deepEqual(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')).map(x => x.sequence), [1, 2, 3]);
  f.secure.set('operationalSession', JSON.stringify({ ...session, sessionId: 'novo-turno', epoch: 5 }));
  f.secure.set('operationalAccessToken', 'novo-token'); f.fail(false); f.sent.length = 0;
  await f.tracking.sendLocation(location(5), 'online_idle', { force: true });
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].token, 'novo-token'); assert.equal(f.sent[0].payload.sequence, 1);
  assert.equal(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')).length, 3);
});
test('tarefa em segundo plano renova token/presença respeitando intervalo do servidor', async () => {
  const f = trackingFixture(); assert.equal(await f.tracking.maintainOperationalPresence(), true);
  assert.equal(f.secure.get('operationalAccessToken'), 'token-renovado');
  assert.equal(await f.tracking.maintainOperationalPresence(), true);
  assert.deepEqual(f.lifecycle, ['heartbeat']);
});
test('heartbeat headless atrasado não sobrescreve nova sessão', async () => {
  const wait = deferred(), f = trackingFixture({ heartbeat: () => wait.promise });
  const renewing = f.tracking.maintainOperationalPresence(); await new Promise(setImmediate);
  f.secure.set('operationalSession', JSON.stringify({ ...session, sessionId: 'novo-turno', epoch: 9 }));
  f.secure.set('operationalAccessToken', 'novo-token'); wait.resolve({ accessToken: 'token-antigo', session });
  assert.equal(await renewing, false); assert.equal(f.secure.get('operationalAccessToken'), 'novo-token');
});
test('headless pausa GPS após 401 confirmado; erro de rede mantém envio para fila', async () => {
  const expired = trackingFixture({ heartbeat: async () => { throw { status: 401 }; } });
  assert.equal(await expired.tracking.maintainOperationalPresence(), false); assert.deepEqual(expired.lifecycle, ['heartbeat', 'stop']);
  assert.ok(expired.secure.get('zippygo.user'));
  const offline = trackingFixture({ heartbeat: async () => { throw new Error('Sem rede'); } });
  assert.equal(await offline.tracking.maintainOperationalPresence(), true); assert.deepEqual(offline.lifecycle, ['heartbeat']);
});
test('GPS headless não envia posição nem heartbeat com usuário/loja diferentes', async () => {
  const f = trackingFixture(); f.secure.set('zippygo.user', JSON.stringify({ id: 'outra-pessoa' }));
  assert.equal(await f.tracking.maintainOperationalPresence(), false);
  await f.tracking.sendLocation(location(1), 'online_idle', { force: true });
  assert.equal(f.sent.length, 0); assert.deepEqual(f.lifecycle, []);
});

test('API preserva data:null para sessão encerrada e código de erro HTTP', async () => {
  let response = { status: 200, data: { success: true, data: null } };
  const api = load('services/mobileApi.ts', {
    './apiService': { apiClient: { get: async () => response } }, '../config/apiConfig': { API_CONFIG: { ENDPOINTS: { OPERATIONAL_SESSION: '/session' } } },
    '../utils/secureStorage': { getSecureItem: async () => null },
  });
  assert.equal(await api.getOperationalSession(), null);
  response = { status: 401, data: { success: false, error: 'Turno expirado', code: 'SESSION_EXPIRED' } };
  await assert.rejects(api.getOperationalSession(), error => error.status === 401 && error.code === 'SESSION_EXPIRED');
});
test('fallback sem crypto.randomUUID gera Guid válido para início e amostras', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
    const api = load('services/mobileApi.ts', { './apiService': { apiClient: {} }, '../config/apiConfig': { API_CONFIG: {} }, '../utils/secureStorage': {} });
    assert.match(api.createIdentifier(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});

module.exports = { load, fixture, trackingFixture, deferred, session, blankQueue, location };
