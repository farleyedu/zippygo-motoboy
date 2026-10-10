const test = require('node:test'), assert = require('node:assert/strict');
const { load, fixture, trackingFixture, blankQueue, location } = require('../validacao-etapa2/lote3/session-tests.cjs');
const { createWebForegroundLocation } = load('services/webForegroundLocation.ts');
const settle = () => new Promise(setImmediate);
function gpsFixture() {
  let now = 100000, visible = true, listener, watcher, current, timer;
  const calls = [], sent = [], permissions = [];
  const stop = createWebForegroundLocation({
    now: () => now, visible: () => visible,
    geolocation: {
      watchPosition: (success, failure, options) => { watcher = { success, failure }; calls.push(['watch', options]); return calls.length; },
      getCurrentPosition: (success, failure, options) => { current = { success, failure }; calls.push(['current', options]); },
      clearWatch: id => calls.push(['clear', id]),
    },
    subscribe: callback => { listener = callback; return () => { listener = null; }; },
    interval: callback => { timer = callback; return () => { timer = null; }; },
    permission: granted => permissions.push(granted),
    send: async (position, force) => sent.push({ at: position.timestamp, force }),
  });
  return { calls, sent, permissions, stop, watcher: () => watcher, current: () => current,
    tick: () => timer?.(), advance: ms => { now += ms; }, resume: () => listener?.(),
    hide: () => { visible = false; listener?.(); }, show: () => { visible = true; listener?.(); },
    position: offset => ({ timestamp: now + (offset || 0), coords: { latitude: -18.9, longitude: -48.2, accuracy: 5 } }),
  };
}

test('abre com GPS novo, força o primeiro envio e une callbacks duplicados de foco', async () => {
  const f = gpsFixture(); f.resume(); f.resume();
  assert.equal(f.calls.filter(c => c[0] === 'watch').length, 1);
  assert.equal(f.calls[0][1].maximumAge, 0);
  f.watcher().success(f.position()); f.current().success(f.position()); await settle();
  assert.deepEqual(f.sent, [{ at: 100000, force: true }]); f.stop();
});
test('Maps/tela bloqueada param watcher e timer; retorno força uma nova posição', async () => {
  const f = gpsFixture(), old = f.watcher();
  old.success(f.position()); f.hide(); f.advance(180000);
  old.success(f.position()); f.tick(); await settle(); assert.equal(f.sent.length, 1);
  f.show(); f.current().success(f.position()); await settle();
  assert.deepEqual(f.sent, [{ at: 100000, force: true }, { at: 280000, force: true }]);
  assert.equal(f.calls.filter(c => c[0] === 'clear').length, 1); f.stop();
});
test('cache antigo, data inválida e callback de watcher removido não renovam GPS', async () => {
  const f = gpsFixture(), old = f.current(); f.hide(); f.advance(60000); f.show();
  old.success(f.position()); f.current().success(f.position(-10000));
  f.watcher().success({ ...f.position(), timestamp: NaN }); await settle();
  assert.equal(f.sent.length, 0); f.watcher().success(f.position()); await settle(); assert.equal(f.sent.length, 1);
  f.stop(); f.watcher().success(f.position(1000)); await settle(); assert.equal(f.sent.length, 1);
});
test('parado consulta GPS periodicamente; permissão negada/timeout não viram posição', async () => {
  const f = gpsFixture(); f.current().failure({ code: 3 });
  f.advance(15000); f.tick(); f.current().success(f.position()); await settle();
  assert.equal(f.sent.length, 1); f.watcher().failure({ code: 1 });
  assert.deepEqual(f.permissions, [true, false]); f.stop();
});
test('permissão web de GPS não exige background, enquanto nativo continua exigindo', async () => {
  const mocks = os => ({ 'react-native': { Platform: { OS: os } }, 'expo-location': {
    getForegroundPermissionsAsync: async () => ({ granted: true, canAskAgain: true }), hasServicesEnabledAsync: async () => true,
    getBackgroundPermissionsAsync: async () => ({ granted: false, canAskAgain: true }),
  }, 'expo-notifications': { getPermissionsAsync: async () => ({ granted: false, canAskAgain: true }) },
  './browserNativeTest': { browserNativeTest: false }, './expoGo': { expoGo: false },
  './webLocationPermission': { readWebLocationPermission: async () => ({ granted: true, supported: true }), webLocationAvailable: () => true }, });
  const web = await load('services/operationalPermissions.ts', mocks('web')).readOperationalPermissions();
  assert.equal(web.ready, true); assert.equal(web.background.granted, false); assert.equal(web.background.supported, false);
  assert.equal((await load('services/operationalPermissions.ts', mocks('ios')).readOperationalPermissions()).ready, false);
});
test('turno web já aberto mantém a entrega se o GPS for revogado; início exige permissão', async () => {
  const permissions = async () => ({ ready: false, foreground: { granted: false }, background: { supported: false }, services: true });
  const route = { ...blankQueue, current: { pedidoId: 99 }, version: 5 };
  const f = fixture(true, { locationOptional: true, permissions, queue: async () => route });
  assert.equal(await f.store.restore(), true); assert.equal(f.store.getSnapshot().phase, 'online');
  assert.equal(f.store.getSnapshot().queue.current.pedidoId, 99); assert.equal(f.count('clear'), 0);
  const start = fixture(false, { locationOptional: true, permissions });
  assert.equal(await start.store.start(), false); assert.equal(start.count('start'), 0);
});
test('callback antigo não envia GPS no turno de outra conta', async () => {
  const f = trackingFixture();
  await f.tracking.sendLocation(location(1), 'active_route', { force: true, expectedScopeId: 'outra-sessao.4' });
  assert.equal(f.sent.length, 0); assert.equal(f.queues.size, 0);
});

test('Safari sem consulta de permissão só solicita GPS na ação explícita e respeita recusa', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator'), oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let requested = 0, denied = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    getCurrentPosition: (success, failure, options) => { requested++; assert.equal(options.maximumAge, 0); if (denied) failure({ code: 1 }); else success({}); },
  } } });
  try {
    const permission = load('services/webLocationPermission.ts');
    assert.equal((await permission.readWebLocationPermission()).granted, false); assert.equal(requested, 0);
    await permission.requestWebLocationPermission(); assert.equal((await permission.readWebLocationPermission()).granted, true);
    denied = true; await assert.rejects(permission.requestWebLocationPermission()); assert.equal((await permission.readWebLocationPermission()).granted, false);
    assert.equal(requested, 2);
  } finally {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window;
  }
});

test('posição enfileirada com erro não altera o GPS confirmado; reenvio conserva a captura', async () => {
  const f = trackingFixture();
  await f.tracking.sendLocation(location(1), 'active_route', { force: true });
  const key = 'tracking.sent.v3.turno-qa.4', previous = f.secure.get(key);
  const next = location(2);
  f.fail(true); await f.tracking.sendLocation(next, 'active_route', { force: true });
  assert.equal(f.secure.get(key), previous);
  f.fail(false); await f.tracking.flushLocationQueue();
  assert.equal(JSON.parse(f.secure.get(key)).capturedAtUtc, new Date(next.timestamp).toISOString());
});
