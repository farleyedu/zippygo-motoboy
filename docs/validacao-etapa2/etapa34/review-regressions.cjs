const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const tick = () => new Promise(resolve => setImmediate(resolve));

// Executa os hooks reais com portas simuladas, sem GPS, API ou renderizador nativo.
function harness(relative, mocks = {}) {
  const states = [], refs = [], memo = [], effects = [];
  let si = 0, ri = 0, mi = 0, ei = 0;
  const equal = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) {
      const i = si++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useRef(initial) { const i = ri++; return refs[i] ||= { current: initial }; },
    useMemo(fn, deps) { const i = mi++; if (!equal(memo[i]?.deps, deps)) memo[i] = { deps, value: fn() }; return memo[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = ei++;
      if (!equal(effects[i]?.deps, deps)) {
        effects[i]?.cleanup?.(); effects[i] = { deps, fn, pending: true };
      }
    },
  };
  const native = {
    Platform: { OS: 'android' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    StyleSheet: { create: x => x, absoluteFill: {} }, useWindowDimensions: () => ({ width: 390 }),
    Animated: { Value: class {}, View: 'AnimatedView' },
  };
  const file = path.join(root, relative), mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod.require = name => {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name === '@react-navigation/native' || name === 'expo-router/react-navigation') return { useIsFocused: () => true, useFocusEffect: fn => react.useEffect(fn, [fn]) };
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.includes('/ui/Kit') || name === './Kit') return { Button: 'Button', Screen: 'Screen', type: {}, money: String };
    if (name.endsWith('/theme')) return { useZippyTheme: () => ({ colors: {}, dark: false, reducedMotion: true }) };
    if (name.startsWith('.') || name === 'lucide-react-native' || name === '@expo/vector-icons' || name === 'react-native-maps') return {};
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, file);
  return {
    states, refs,
    render(name = 'default', props = {}) { si = ri = mi = ei = 0; return mod.exports[name](props); },
    effects() { effects.forEach(e => { if (e.pending) { e.pending = false; e.cleanup = e.fn(); } }); },
    close() { effects.forEach(e => e.cleanup?.()); },
  };
}

test('Conferencia ilegivel continua bloqueando a rota mesmo apos limpar o aviso', async () => {
  const h = harness('src/contexts/DeliveryCompletionContext.tsx', {
    './AuthContext': { useAuth: () => ({ user: { id: 'qa' } }) },
    './OperationalSessionContext': { useOperationalSession: () => ({ store: { getSnapshot: () => ({}) } }) },
    '../../utils/secureStorage': { secureStorage: { getItemAsync: async () => '{ilegivel' } },
    '../../services/sessionEvents': { registerLogoutPrecondition: () => () => {} },
  });
  h.render('DeliveryCompletionProvider'); h.effects(); await tick();
  let value = h.render('DeliveryCompletionProvider').props.value;
  assert.equal(value.loading, false);
  assert.throws(value.assertRouteMutationAllowed, /verificada/);
  value.clearError(); value = h.render('DeliveryCompletionProvider').props.value;
  assert.equal(value.error, '');
  assert.throws(value.assertRouteMutationAllowed, /verificada/);
  h.close();
});

test('Recuperacao assincrona bloqueia alteracoes ate confirmar que nao ha registro', async () => {
  let resolve;
  const h = harness('src/contexts/DeliveryCompletionContext.tsx', {
    './AuthContext': { useAuth: () => ({ user: { id: 'qa' } }) },
    './OperationalSessionContext': { useOperationalSession: () => ({ store: { getSnapshot: () => ({}) } }) },
    '../../utils/secureStorage': { secureStorage: { getItemAsync: () => new Promise(r => { resolve = r; }) } },
    '../../services/sessionEvents': { registerLogoutPrecondition: () => () => {} },
  });
  const before = h.render('DeliveryCompletionProvider').props.value;
  h.effects(); assert.throws(before.assertRouteMutationAllowed, /verificada/);
  resolve(null); await tick();
  assert.doesNotThrow(h.render('DeliveryCompletionProvider').props.value.assertRouteMutationAllowed);
  h.close();
});

test('Acao de rota nao chama a API quando a recuperacao esta bloqueada', async () => {
  let calls = 0;
  const h = harness('src/hooks/useRouteAction.ts', {
    '../contexts/DeliveryCompletionContext': { useDeliveryCompletion: () => ({ assertRouteMutationAllowed() { throw new Error('Registro ilegivel'); } }) },
    '../contexts/OperationalSessionContext': { useOperationalSession: () => ({ store: { getSnapshot: () => ({}) } }) },
  });
  await h.render('useRouteAction').run(async () => { calls++; });
  assert.equal(calls, 0); assert.equal(h.render('useRouteAction').error, 'Registro ilegivel');
});

test('Mapa legado: Centrar e consumido uma vez; novo GPS nao centraliza; outro toque centraliza', () => {
  const h = harness('components/LegacyMapa.tsx', { 'expo-location': { getForegroundPermissionsAsync: async () => ({ granted: false }) } });
  const calls = [];
  h.render('default', { pedidos: [], emEntrega: true });
  h.refs[0].current = { animateToRegion: coords => calls.push(coords), animateCamera() {} };
  h.states[0] = { latitude: 1, longitude: 2 }; h.states[1] = true;
  h.render('default', { pedidos: [], emEntrega: true, recenterToken: 1 }); h.effects();
  const initial = calls.length;
  h.states[0] = { latitude: 3, longitude: 4 };
  h.render('default', { pedidos: [], emEntrega: true, recenterToken: 1 }); h.effects();
  assert.equal(calls.length, initial);
  h.render('default', { pedidos: [], emEntrega: true, recenterToken: 2 }); h.effects();
  assert.equal(calls.length, initial + 1); assert.equal(calls.at(-1).latitude, 3);
  h.close();
});

test('Mapa legado: Modo rota continua acompanhando cada posicao do GPS', () => {
  const h = harness('components/LegacyMapa.tsx', { 'expo-location': { getForegroundPermissionsAsync: async () => ({ granted: false }) } });
  const calls = [];
  h.render('default', { pedidos: [], emEntrega: true, routeMode: true });
  h.refs[0].current = { animateCamera: camera => calls.push(camera) };
  const map = h.render('default', { pedidos: [], emEntrega: true, routeMode: true });
  map.props.onUserLocationChange({ nativeEvent: { coordinate: { latitude: 1, longitude: 2, heading: 90, speed: 2 } } });
  map.props.onUserLocationChange({ nativeEvent: { coordinate: { latitude: 3, longitude: 4, heading: 100, speed: 2 } } });
  assert.equal(calls.at(-1).center.latitude, 3);
  assert.equal(calls.at(-1).heading, 100);
  assert.ok(calls.some(c => c.center.latitude === 1));
  h.close();
});

function orderFixture({ changedSession = false, blocked = false } = {}) {
  let session = { sessionId: 'turno', epoch: 1 }, queue = { current: { pedidoId: 23 } }, calls = [];
  const order = { id: 23, isCurrent: true, pickedUpAtUtc: 'agora', itens: [] };
  const h = harness('app/pedido/[id].tsx', {
    'expo-router': { useLocalSearchParams: () => ({ id: '23' }), useRouter: () => ({ push: route => calls.push(['push', route]) }), Stack: {} },
    '../../src/contexts/AuthContext': { useAuth: () => ({}) },
    '../../src/hooks/useOrderChecklists': { useOrderChecklists: () => ({
      loading: false, error: '', confirmations: [], primaryReady: false, ready: false,
      toggle: async () => {},
    }) },
    '../../src/contexts/DeliveryCompletionContext': { useDeliveryCompletion: () => ({ assertRouteMutationAllowed() { if (blocked) throw new Error('Registro ilegivel'); } }) },
    '../../src/contexts/OperationalSessionContext': { useOperationalSession: () => ({ store: {
      getSnapshot: () => ({ session, queue }), updateQueue: saved => { queue = saved; calls.push(['queue', saved]); },
    } }) },
    '../../services/mobileApi': {
      getOperationalOrder: async () => { calls.push(['detail']); return { ...order, arrivedAtUtc: calls.some(c => c[0] === 'arrive') ? 'agora' : null }; },
      arriveCurrent: async () => { calls.push(['arrive']); if (changedSession) session = { sessionId: 'outro', epoch: 2 }; return { current: { pedidoId: 23, arrivedAtUtc: 'agora' } }; },
    },
  });
  return { h, calls };
}

test('Chegada atualiza fila compartilhada antes de consultar detalhe e navegar', async () => {
  const { h, calls } = orderFixture(); h.render(); h.effects(); await tick();
  h.render().props.footer.props.onPress(); await tick();
  assert.deepEqual(calls.map(c => c[0]), ['detail', 'arrive', 'queue', 'detail', 'push']);
  assert.equal(calls.at(-1)[1], '/chegadaEntrega'); h.close();
});

test('Resposta de chegada de outra sessao nao altera fila nem navega', async () => {
  const { h, calls } = orderFixture({ changedSession: true }); h.render(); h.effects(); await tick();
  h.render().props.footer.props.onPress(); await tick();
  assert.deepEqual(calls.map(c => c[0]), ['detail', 'arrive']); h.close();
});

test('Conferencia ilegivel impede registrar chegada', async () => {
  const { h, calls } = orderFixture({ blocked: true }); h.render(); h.effects(); await tick();
  h.render().props.footer.props.onPress(); await tick();
  assert.deepEqual(calls.map(c => c[0]), ['detail']); h.close();
});

test('Conferencia ilegivel impede encerrar turno', async () => {
  let calls = 0;
  const h = harness('app/turno.tsx', {
    'expo-router': { useRouter: () => ({ replace() { calls++; } }) },
    '../src/contexts/AuthContext': { useAuth: () => ({}) },
    '../src/contexts/OperationalSessionContext': { useOperationalSession: () => ({ store: { end: async () => { calls++; return true; } } }) },
    '../src/contexts/DeliveryCompletionContext': { useDeliveryCompletion: () => ({ assertRouteMutationAllowed() { throw new Error('Registro ilegivel'); } }) },
    '../src/hooks/useRouteAction': { useRouteAction: () => ({}) },
  });
  h.render(); h.states[2] = true;
  const tree = h.render();
  const buttons = [];
  const walk = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); if (node.type === 'Button') buttons.push(node); walk(node.props?.children); };
  walk(tree);
  buttons.find(b => b.props.children[0] === 'Confirmar encerramento').props.onPress(); await tick();
  assert.equal(calls, 0); h.close();
});
