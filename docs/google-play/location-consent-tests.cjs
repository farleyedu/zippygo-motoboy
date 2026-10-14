const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, fixture, trackingFixture, location } = require('../validacao-etapa2/lote3/session-tests.cjs');
const React = require('react'), renderer = require('react-test-renderer');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), vm = require('node:vm');
global.IS_REACT_ACT_ENVIRONMENT = true;

function consentFixture(options = {}) {
  const values = new Map([['zippygo.user', JSON.stringify({ id: 'qa' })]]), calls = [];
  const storage = { getSecureItem: async key => values.get(key) ?? null,
    secureStorage: { setItemAsync: async (key, value) => {
      if (options.writeFailure) throw new Error('Armazenamento indisponível');
      values.set(key, value); options.afterWrite?.(values);
    } } };
  const consent = load('services/locationDisclosureConsent.ts', {
    'react-native': { Platform: { OS: options.platform || 'android' } },
    '../utils/secureStorage': storage, './expoGo': { expoGo: !!options.expoGo },
  });
  const permission = { granted: options.granted ?? true, canAskAgain: true };
  const permissions = load('services/operationalPermissions.ts', {
    'react-native': { Platform: { OS: options.platform || 'android' } },
    'expo-location': { getForegroundPermissionsAsync: async () => permission,
      getBackgroundPermissionsAsync: async () => permission, hasServicesEnabledAsync: async () => true,
      requestForegroundPermissionsAsync: async () => { calls.push('foreground'); return permission; },
      requestBackgroundPermissionsAsync: async () => { calls.push('background'); return permission; } },
    'expo-notifications': { getPermissionsAsync: async () => permission },
    './locationDisclosureConsent': consent,
    './browserNativeTest': { browserNativeTest: false }, './expoGo': { expoGo: false },
    './webOfferPush': { webNotificationPermission: () => ({ granted: false, canAskAgain: false, supported: false }) },
    './webLocationPermission': { readWebLocationPermission: async () => permission, webLocationAvailable: () => true },
    './notificationPermissionPrompt': { markNotificationPermissionRequested: async () => {} },
  });
  return { consent, permissions, values, calls };
}

test('Android com permissões concedidas permanece sem GPS até aceitar o aviso', async () => {
  const f = consentFixture();
  assert.equal((await f.permissions.readOperationalPermissions()).ready, false);
  for (const kind of ['foreground', 'background'])
    assert.equal(await f.permissions.askOperationalPermission(kind), 'consent-required');
  assert.deepEqual(f.calls, []);
  const p = await f.permissions.readOperationalPermissions();
  const fresh = fixture(false, { permissions: async () => p });
  assert.equal(await fresh.store.start(), false); assert.equal(fresh.count('start'), 0);
  const restored = fixture(true, { permissions: async () => p });
  assert.equal(await restored.store.restore(), false); assert.equal(restored.count('monitor'), 0);
  assert.equal(restored.count('clear'), 0); assert.equal(restored.saved().session.sessionId, 'turno-qa');
});

test('Aceitação explícita persiste versão/dono e libera as solicitações e a retomada', async () => {
  const f = consentFixture(); await f.consent.acceptLocationDisclosure('qa');
  const stored = JSON.parse(f.values.get(f.consent.LOCATION_DISCLOSURE_KEY));
  assert.equal(stored.version, f.consent.LOCATION_DISCLOSURE_VERSION); assert.equal(stored.userId, 'qa');
  assert.ok(Number.isFinite(Date.parse(stored.acceptedAtUtc)));
  assert.equal(await f.consent.hasLocationDisclosureConsent(), true);
  assert.equal((await f.permissions.readOperationalPermissions()).ready, true);
  for (const kind of ['foreground', 'background']) assert.equal(await f.permissions.askOperationalPermission(kind), 'requested');
  assert.deepEqual(f.calls, ['foreground', 'background']);
  const p = await f.permissions.readOperationalPermissions(), restored = fixture(true, { permissions: async () => p });
  assert.equal(await restored.store.restore(), true); assert.equal(restored.count('monitor'), 1);
  await restored.store.end(); assert.ok(restored.count('stopMonitor') > 0);
});

test('Recusar/fechar sem aceitar não grava consentimento nem solicita permissão', async () => {
  const f = consentFixture({ granted: false });
  await f.permissions.askOperationalPermission('foreground');
  assert.equal(f.values.has(f.consent.LOCATION_DISCLOSURE_KEY), false);
  assert.equal(await f.consent.hasLocationDisclosureConsent(), false); assert.deepEqual(f.calls, []);
});

test('Versão antiga, corrupção, data inválida e consentimento de outra conta bloqueiam GPS', async () => {
  const f = consentFixture(), key = f.consent.LOCATION_DISCLOSURE_KEY;
  for (const raw of ['{', JSON.stringify({ version: 0, userId: 'qa', acceptedAtUtc: new Date().toISOString() }),
    JSON.stringify({ version: 1, userId: 'outro', acceptedAtUtc: new Date().toISOString() }),
    JSON.stringify({ version: 1, userId: 'qa', acceptedAtUtc: 'inválida' })]) {
    f.values.set(key, raw); assert.equal(await f.consent.hasLocationDisclosureConsent(), false);
    assert.equal((await f.permissions.readOperationalPermissions()).ready, false);
  }
  await f.consent.acceptLocationDisclosure('qa');
  f.values.set('zippygo.user', JSON.stringify({ id: 'outro' }));
  assert.equal(await f.consent.hasLocationDisclosureConsent(), false);
});

test('Erro de gravação e troca de conta durante aceite não liberam monitoramento', async () => {
  const failure = consentFixture({ writeFailure: true });
  await assert.rejects(failure.consent.acceptLocationDisclosure('qa'), /salvar seu consentimento/);
  assert.equal((await failure.permissions.readOperationalPermissions()).ready, false);
  const changed = consentFixture({ afterWrite: values => values.set('zippygo.user', JSON.stringify({ id: 'outro' })) });
  await assert.rejects(changed.consent.acceptLocationDisclosure('qa'), /confirmar/);
  assert.equal((await changed.permissions.readOperationalPermissions()).ready, false);
  await assert.rejects(changed.consent.acceptLocationDisclosure('qa'), /acesso mudou/);
});

test('Web/iOS/Expo Go preservam seus fluxos sem exigir declaração Android', async () => {
  for (const options of [{ platform: 'web' }, { platform: 'ios' }, { expoGo: true }]) {
    const f = consentFixture(options); f.values.clear();
    assert.equal(await f.consent.hasLocationDisclosureConsent(), true);
    await f.consent.acceptLocationDisclosure('qa'); assert.equal(f.values.size, 0);
  }
});

test('Sem consentimento, coleta pontual, transmissão e fila antiga não enviam localização', async () => {
  let readings = 0;
  const f = trackingFixture({ currentPosition: async () => { readings++; return location(1); } });
  f.secure.delete('zippyboy.locationDisclosureConsent');
  f.queues.set('tracking.queue.v3.turno-qa.4', JSON.stringify([{ sampleId: 'antiga', sequence: 1 }]));
  await f.tracking.sendCurrentLocation(); await f.tracking.sendLocation(location(1), 'active_route');
  await f.tracking.flushLocationQueue();
  assert.equal(readings, 0); assert.equal(f.sent.length, 0); assert.equal(f.requests.length, 0);
  assert.equal(JSON.parse(f.queues.get('tracking.queue.v3.turno-qa.4')).length, 1);
});

test('Inicializador nativo e tarefa headless param serviço antigo sem consentimento', async () => {
  let stops = 0, requests = 0, started = 0, task, sends = 0;
  const noConsent = { hasLocationDisclosureConsent: async () => false };
  const lifecycle = { stopBackgroundLocation: async () => { stops++; }, restartBackgroundLocation: async () => { started++; return true; } };
  const setup = load('components/locationSetup.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-location': { requestForegroundPermissionsAsync: async () => { requests++; },
      getForegroundPermissionsAsync: async () => ({ granted: true }), getBackgroundPermissionsAsync: async () => ({ granted: true }) },
    '../utils/secureStorage': { getSecureItem: async () => 'token' },
    '../services/locationDisclosureConsent': noConsent,
    '../services/backgroundLocationLifecycle': lifecycle,
    '../services/trackingService': {},
  });
  assert.equal(await setup.requestForegroundLocationPermission(), false);
  assert.equal(await setup.iniciarMonitoramentoLocalizacao(), false);
  load('components/locationTask.ts', {
    'expo-task-manager': { defineTask: (_name, handler) => { task = handler; } },
    '../services/locationDisclosureConsent': noConsent, '../services/backgroundLocationLifecycle': lifecycle,
    '../services/trackingService': { sendLocation: async () => { sends++; } },
  });
  await task({ data: { locations: [location(1)] } });
  assert.equal(stops, 2); assert.equal(requests, 0); assert.equal(started, 0); assert.equal(sends, 0);
});

function loadScreen(file, mocks) {
  const compiled = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => name in mocks ? mocks[name] : require(name), console });
  return exports;
}

async function screenFixture(options = {}) {
  const f = consentFixture(options), session = fixture(false, { permissions: f.permissions.readOperationalPermissions });
  const navigation = [], colors = { ink: '#fff', muted: '#aaa', accent: '#2872e3' };
  await session.store.restore();
  const { default: Screen } = loadScreen('app/permissoes.tsx', {
    'react-native': { Platform: { OS: 'android' }, Text: 'Text', View: 'View' },
    'expo-router': { useRouter: () => ({ push: value => navigation.push(value), replace: value => navigation.push(value) }), useLocalSearchParams: () => ({}) },
    'expo-router/react-navigation': { useIsFocused: () => true },
    'lucide-react-native': { Bell: 'Icon', LocateFixed: 'Icon', MapPin: 'Icon', Navigation: 'Icon', ShieldCheck: 'Icon' },
    '../src/contexts/AuthContext': { useAuth: () => ({ user: { id: 'qa' }, estabelecimentoAtual: { id: 'loja-qa', nome: 'Loja teste' } }) },
    '../src/contexts/OperationalSessionContext': { useOperationalSession: () => ({
      ...React.useSyncExternalStore(session.store.subscribe, session.store.getSnapshot), store: session.store, busy: false,
    }) },
    '../src/hooks/useOperationalAccess': { useOperationalAccess: () => true },
    '../services/operationalPermissions': f.permissions,
    '../src/ui/Kit': { Button: 'Button', Entrance: 'Entrance', Feedback: 'Feedback', Header: 'Header', Pill: 'Pill', Screen: 'Screen', Surface: 'Surface', type: { title: {}, body: {}, small: {} } },
    '../src/ui/LogoutAction': { LogoutAction: 'Logout' }, '../src/ui/theme': { useZippyTheme: () => ({ colors }) },
    '../services/browserNativeTest': { browserNativeTest: false },
    '../services/webLocationPermission': { WebLocationPermissionError: class extends Error {} },
    '../src/delivery/operationalDestination': { permissionIntent: () => 'start', permissionReturn: () => '/', operationalDestination: () => '/home' },
    '../services/locationDisclosureConsent': f.consent,
    '../src/ui/LocationDisclosureDialog': { LocationDisclosureDialog: 'DisclosureDialog' },
  });
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(Screen)); });
  const click = async callback => { await renderer.act(async () => { callback(); await new Promise(setImmediate); }); };
  return { ...f, session, navigation, tree, Screen, click,
    button: title => tree.root.findAllByType('Button').find(button => button.props.children === title),
    dialog: () => tree.root.findByType('DisclosureDialog') };
}

test('Tela: Agora não e Voltar fecham o aviso sem iniciar turno nem abrir permissão negada', async () => {
  const f = await screenFixture({ granted: false });
  await f.click(f.button('Permitir localização').props.onPress);
  assert.equal(f.dialog().props.visible, true); assert.deepEqual(f.calls, []);
  await f.click(f.dialog().props.onCancel);
  assert.equal(f.dialog().props.visible, false); assert.equal(await f.consent.hasLocationDisclosureConsent(), false);
  assert.deepEqual(f.calls, []); assert.deepEqual(f.navigation, []); assert.equal(f.session.count('start'), 0);
  await renderer.act(async () => f.tree.unmount());
});

test('Tela: aceitar continua na permissão escolhida sem repetir o diálogo por estado antigo', async () => {
  const f = await screenFixture({ granted: false });
  await f.click(f.button('Revisar e continuar').props.onPress);
  assert.equal(f.dialog().props.visible, true);
  await f.click(f.dialog().props.onContinue);
  assert.equal(await f.consent.hasLocationDisclosureConsent(), true);
  assert.deepEqual(f.calls, ['foreground']); assert.equal(f.dialog().props.visible, false);
  assert.equal(f.navigation[0].pathname, '/permissaoNegada'); assert.equal(f.session.count('start'), 0);
  await renderer.act(async () => f.tree.unmount());
});

test('Tela: permissões antigas exigem aceite; reabrir com consentimento válido não repete aviso', async () => {
  const f = await screenFixture();
  assert.equal(f.session.count('start'), 0);
  await f.click(f.button('Revisar e continuar').props.onPress);
  await f.click(f.dialog().props.onContinue);
  assert.equal(f.session.count('start'), 1); assert.equal(f.session.count('monitor'), 1); assert.deepEqual(f.calls, []);
  await renderer.act(async () => f.tree.unmount());
  await renderer.act(async () => { f.tree = renderer.create(React.createElement(f.Screen)); });
  assert.equal(f.tree.root.findAllByType('DisclosureDialog').filter(dialog => dialog.props.visible).length, 0);
  assert.equal(f.session.count('start'), 1);
  await renderer.act(async () => f.tree.unmount());
});

test('Diálogo contém coleta, segundo plano e turno; Voltar cancela somente fora da gravação', async () => {
  const f = consentFixture(), colors = { ink: '#fff', muted: '#aaa', accent: '#2872e3', paper: '#10192b', line: '#33445b' };
  const { LocationDisclosureDialog } = loadScreen('src/ui/LocationDisclosureDialog.tsx', {
    'react-native': { Modal: 'Modal', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    'lucide-react-native': { MapPin: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../../services/locationDisclosureConsent': f.consent,
    './Kit': { Button: 'Button', Feedback: 'Feedback', type: { title: {}, body: {} } },
    './theme': { useZippyTheme: () => ({ colors }) },
  });
  let tree, cancelled = 0;
  const props = { visible: true, busy: false, onCancel: () => { cancelled++; }, onContinue: () => {} };
  await renderer.act(async () => { tree = renderer.create(React.createElement(LocationDisclosureDialog, props)); });
  const body = tree.root.findAllByType('Text').map(node => node.props.children).join(' ');
  assert.match(body, /ZippyBoy coleta sua localização/); assert.match(body, /segundo plano/); assert.match(body, /turno online/);
  tree.root.findByType('Modal').props.onRequestClose(); assert.equal(cancelled, 1);
  await renderer.act(async () => tree.update(React.createElement(LocationDisclosureDialog, { ...props, busy: true })));
  tree.root.findByType('Modal').props.onRequestClose(); assert.equal(cancelled, 1);
  await renderer.act(async () => tree.unmount());
});
