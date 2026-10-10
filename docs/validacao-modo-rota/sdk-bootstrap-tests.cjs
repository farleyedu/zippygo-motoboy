const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), React = require('react'), renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '../..');
function load(file, mocks) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => name in mocks ? mocks[name] : require(name), console, setTimeout, clearTimeout, Promise, Date, Error, __DEV__: false });
  return exports;
}
const theme = { useZippyTheme: () => ({ dark: true, sound: true }) };
const safe = { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
const native = { View: 'View', StyleSheet: { absoluteFill: {} } };

test('Rodapé reserva a altura física no Android e pontos no iOS, inclusive após redimensionar', async () => {
  for (const [platform, density, expected] of [['android', 1, 154], ['android', 2.625, 404], ['android', 3, 462], ['ios', 3, 154]]) {
    const { default: Map } = load('components/SdkMapa.tsx', {
      'react-native': { ...native, Platform: { OS: platform }, PixelRatio: { getPixelSizeForLayoutSize: size => Math.round(size * density) } },
      'expo-router/react-navigation': { useIsFocused: () => true },
      'react-native-safe-area-context': safe, 'expo-location': {},
      '@googlemaps/react-native-navigation-sdk': { useNavigation: () => ({ navigationController: {} }), NavigationView: 'NavigationView', MapColorScheme: {}, NavigationNightMode: {}, NavigationUIEnabledPreference: {} },
      '../src/ui/theme': theme,
      '../src/delivery/NativeNavigationProvider': {},
      '../src/delivery/navigationJourney': {},
      '../src/delivery/navigationDiagnostics': load('src/delivery/navigationDiagnostics.ts', {}),
    });
    const props = { navigationEnabled: true, routeMode: true, pedidos: [], navigationBottomInset: 154 };
    let tree;
    await renderer.act(async () => { tree = renderer.create(React.createElement(Map, props)); });
    const padding = () => tree.root.findByType('NavigationView').props.mapPadding;
    assert.equal(padding().bottom, expected, `${platform}, densidade ${density}`);
    assert.equal(padding().left, platform === 'android' ? Math.round(12 * density) : 12);
    assert.equal(padding().right, padding().left);
    await renderer.act(async () => tree.update(React.createElement(Map, { ...props, navigationBottomInset: 173.5 })));
    assert.equal(padding().bottom, platform === 'android' ? Math.round(173.5 * density) : 173.5);
    await renderer.act(async () => tree.update(React.createElement(Map, { ...props, routeMode: false, navigationBottomInset: 0 })));
    assert.equal(padding().bottom, 0, 'Prévia libera o espaço do rodapé da navegação');
    await renderer.act(async () => tree.unmount());
  }
});

test('GPS nativo é iniciado após init; GPS bruto desbloqueia o cálculo mesmo parado', async () => {
  const calls = [], states = [], listeners = {};
  const engine = {
    areTermsAccepted: async () => true,
    init: async () => { calls.push('init'); return 'OK'; },
    startUpdatingLocation: () => { calls.push('gps:start'); listeners.raw?.({ lat: -18.9, lng: -48.2 }); },
    stopUpdatingLocation: () => calls.push('gps:stop'),
    stopGuidance: async () => calls.push('stop'),
    setDestinations: async destinations => { calls.push('route'); assert.equal(destinations.length, 1); return 'OK'; },
    startGuidance: async () => calls.push('guide'),
    setAudioGuidanceType: () => {},
  };
  const nav = { navigationController: engine };
  nav.setLogDebugInfo = () => {};
  for (const [setter, key] of [['setOnLocationChanged', 'snapped'], ['setOnRawLocationChanged', 'raw'], ['setOnArrival', 'arrival'], ['setOnReroutingRequestedByOffRoute', 'reroute'], ['setOnRemainingTimeOrDistanceChanged', 'remaining']]) nav[setter] = cb => { listeners[key] = cb; };
  const sdk = { useNavigation: () => nav, NavigationView: 'NavigationView', NavigationSessionStatus: { OK: 'OK' }, RouteStatus: { OK: 'OK' }, TravelMode: { TWO_WHEELER: 3 }, AudioGuidance: {}, CameraPerspective: {}, MapColorScheme: {}, NavigationNightMode: {}, NavigationUIEnabledPreference: {} };
  const journey = load('src/delivery/navigationJourney.ts', {});
  const { default: Map } = load('components/SdkMapa.tsx', {
    'react-native': { ...native, Platform: { OS: 'android' }, PixelRatio: { getPixelSizeForLayoutSize: size => Math.round(size * 2.625) } },
    'expo-router/react-navigation': { useIsFocused: () => true },
    'react-native-safe-area-context': safe, 'expo-location': {},
    '@googlemaps/react-native-navigation-sdk': sdk,
    '../src/ui/theme': theme,
    '../src/delivery/NativeNavigationProvider': { waitForNavigationReset: async () => {}, waitForNavigationStop: () => {} },
    '../src/delivery/navigationJourney': journey,
    '../src/delivery/navigationDiagnostics': load('src/delivery/navigationDiagnostics.ts', {}),
  });
  const props = { navigationEnabled: true, routeMode: true, pedidos: [{ id: 87, enderecoEntrega: 'Rua A, 10', coordinates: { lat: -18.9, lng: -48.2 } }], onNavigationState: state => states.push(state) };
  const view = { setNavigationUIEnabled: async () => {}, setFollowingPerspective: async () => calls.push('follow'), showRouteOverview: async () => {} };
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(Map, props)); });
  await renderer.act(async () => {
    const mounted = tree.root.findByType('NavigationView');
    mounted.props.onNavigationViewControllerCreated(view);
    mounted.props.onMapReady();
  });
  assert.ok(calls.indexOf('init') < calls.indexOf('gps:start'));
  assert.ok(calls.indexOf('gps:start') < calls.indexOf('route'));
  assert.ok(calls.includes('guide'));
  assert.equal(states.at(-1).status, 'guiding');
  // Changing operational props must not reinitialize or restart the GPS feed.
  await renderer.act(async () => tree.update(React.createElement(Map, { ...props, selectedPedidoId: 87 })));
  assert.equal(calls.filter(c => c === 'init').length, 1);
  engine.setDestinations = async () => 'NETWORK_ERROR';
  await renderer.act(async () => tree.update(React.createElement(Map, { ...props, retryToken: 1 })));
  assert.equal(states.at(-1).status, 'error');
  assert.ok(states.at(-1).message.includes('conexão'));
  assert.equal(calls.filter(c => c === 'guide').length, 1, 'Falha da nova rota não inicia guidance');
  await renderer.act(async () => tree.unmount());
  assert.ok(calls.includes('gps:stop'));
  assert.equal(listeners.raw, null);
});

test('Provider mantém referência dos termos entre atualizações, preservando controller do SDK', async () => {
  const options = [];
  const sdk = {
    NavigationProvider: props => { options.push(props.termsAndConditionsDialogOptions); return React.createElement(React.Fragment, null, props.children); },
    TaskRemovedBehavior: { CONTINUE_SERVICE: 1 },
    useNavigation: () => ({ navigationController: engine }),
  };
  const engine = { stopGuidance: async () => {}, clearDestinations: async () => {}, cleanup: async () => {} };
  const { NativeNavigationProvider } = load('src/delivery/NativeNavigationProvider.tsx', {
    '../../services/nativeNavigation': { nativeNavigationAvailable: true },
    '../contexts/OperationalSessionContext': { useOperationalSession: () => ({ session: { sessionId: 'test' } }) },
    '@googlemaps/react-native-navigation-sdk': sdk,
  });
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(NativeNavigationProvider, null, 'first')); });
  await renderer.act(async () => tree.update(React.createElement(NativeNavigationProvider, null, 'updated')));
  assert.equal(options.length, 2);
  assert.equal(options[0], options[1]);
  await renderer.act(async () => tree.unmount());
});
