const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/delivery/navigationJourney.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported, Date, Promise });
const { NavigationJourney, journeySummary } = exported;
const external = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/delivery/externalRoute.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: external });
const { googleMapsRoute, uniqueNavigationStops } = external;

function externalNavigator(platform, installed = true) {
  const probes = [], opened = [], exported = {};
  const compiledNavigation = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../services/navigation.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiledNavigation, { exports: exported, require: name => {
    if (name === 'react-native') return { Platform: { OS: platform }, Linking: { canOpenURL: async url => { probes.push(url); return installed; }, openURL: async url => { opened.push(url); } } };
    if (name === '@react-native-async-storage/async-storage') return { default: { getItem: async () => null } };
    if (name === './browserNativeTest') return { browserNativeTest: false };
    if (name === '../src/delivery/externalRoute') return external;
    throw new Error('Importação inesperada: ' + name);
  } });
  return { ...exported, probes, opened };
}

test('Waze web usa link universal com endereço, sem depender de esquema nativo', async () => {
  const nav = externalNavigator('web');
  await nav.openPreferredNavigation({ address: 'Rua São João, 123' }, 'Waze');
  assert.equal(nav.probes.length, 0);
  const url = new URL(nav.opened[0]);
  assert.equal(url.host, 'waze.com'); assert.equal(url.searchParams.get('q'), 'Rua São João, 123');
  assert.equal(url.searchParams.get('navigate'), 'yes');
});

test('Maps instalado é consultado pelo esquema da plataforma e recebe dez destinos', async () => {
  const stops = Array.from({ length: 12 }, (_, i) => ({ address: 'Rua Teste, ' + i }));
  for (const platform of ['android', 'ios']) {
    const nav = externalNavigator(platform), route = await nav.openGoogleMapsRoute(stops);
    assert.equal(nav.probes[0], platform === 'android' ? 'google.navigation:q=0,0' : 'comgooglemaps://');
    assert.equal(route.sent, 10); assert.equal(route.remaining, 2);
    assert.equal(new URL(nav.opened[0]).searchParams.get('destination'), 'Rua Teste, 9');
  }
});

test('Maps ausente usa quatro destinos; Waze nativo sem coordenadas mantém a escolha do usuário', async () => {
  const absent = externalNavigator('android', false);
  const route = await absent.openGoogleMapsRoute(Array.from({ length: 8 }, (_, i) => ({ address: 'Rua Teste, ' + i })));
  assert.equal(route.sent, 4); assert.equal(route.remaining, 4);
  const waze = externalNavigator('android');
  await waze.openPreferredNavigation({ address: 'Rua A, 9' }, 'Waze');
  assert.equal(waze.opened.length, 1); assert.equal(new URL(waze.opened[0]).protocol, 'waze:');
  assert.equal(new URL(waze.opened[0]).searchParams.get('q'), 'Rua A, 9');
});

test('Mesmo endereço gera um destino e preserva os objetos de todos os pedidos', () => {
  const stops = [{ address: 'Rua São João, 123, Centro', latitude: -18.9, longitude: -48.2 }, { address: ' RUA SAO JOAO 123 CENTRO ', latitude: -18.91, longitude: -48.21 }, { address: 'Rua São João, 124, Centro' }];
  const route = googleMapsRoute(stops);
  assert.equal(route.sent, 2); assert.equal(route.duplicates, 1); assert.equal(stops.length, 3);
  assert.equal(uniqueNavigationStops(stops)[0], stops[0]);
  const coordinates = [{ latitude: 1, longitude: 2 }, { latitude: 1, longitude: 2 }, { latitude: 1.000001, longitude: 2 }];
  assert.equal(uniqueNavigationStops(coordinates).length, 2);
});

test('Maps usa 4 destinos no navegador e até 10 no app, respeitando a ordem e o limite do URL', () => {
  const stops = Array.from({ length: 12 }, (_, i) => ({ address: 'Rua Teste, ' + i }));
  const browser = googleMapsRoute(stops), native = googleMapsRoute(stops, 10);
  assert.equal(browser.sent, 4); assert.equal(browser.remaining, 8);
  assert.equal(native.sent, 10); assert.equal(native.remaining, 2);
  const params = new URL(browser.url).searchParams;
  assert.equal(params.get('destination'), 'Rua Teste, 3'); assert.equal(params.get('waypoints'), 'Rua Teste, 0|Rua Teste, 1|Rua Teste, 2');
  assert.equal(params.get('dir_action'), 'navigate');
  const long = googleMapsRoute(Array.from({ length: 10 }, (_, i) => ({ address: ('Endereço ' + i).repeat(40) })), 10);
  assert.ok(long.url.length <= 2048); assert.ok(long.remaining > 0);
});

test('Endereço ausente não faz Maps pular uma entrega', () => {
  assert.equal(googleMapsRoute([{}, { address: 'Rua B, 5' }]), null);
  const result = googleMapsRoute([{ address: 'Rua A, 10' }, {}, { address: 'Rua B, 5' }]);
  assert.equal(result.sent, 1); assert.equal(result.skipped, 1); assert.equal(result.remaining, 2);
});
const request = (changes = {}) => ({ key: 'store', destinations: [{ position: { lat: -18.9, lng: -48.2 }, title: 'Rua A, 10' }], enabled: true, follow: true, cameraToken: '1', muted: false, ...changes });
function fixture(changes = {}) {
  const calls = [], states = [];
  const bridge = Object.fromEntries(['prepare', 'start', 'stop', 'navigationUI', 'follow', 'overview'].map(name => [name, async () => { calls.push(name); }]));
  bridge.audio = () => calls.push('audio');
  return { calls, states, journey: new NavigationJourney({ ...bridge, ...changes }, s => states.push(s)) };
}
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r; }), release: () => resolve() }; };
test('Inicialização iniciada pelo filho espera limpeza registrada pelo provedor no mesmo ciclo', async () => {
  const barrier = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/delivery/navigationReset.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: barrier, Promise });
  const gate = deferred(); let initialized = false;
  const initializing = barrier.waitForNavigationReset().then(() => { initialized = true; });
  barrier.queueNavigationReset(() => gate.promise);
  await new Promise(setImmediate); assert.equal(initialized, false);
  gate.release(); await initializing; assert.equal(initialized, true);
});

test('Guidance confirmado precede acompanhamento; não há overview concorrente', async () => {
  const f = fixture(); await f.journey.sync(request());
  assert.ok(f.calls.indexOf('prepare') < f.calls.indexOf('start'));
  assert.ok(f.calls.indexOf('start') < f.calls.indexOf('follow'));
  assert.equal(f.calls.includes('overview'), false);
  assert.equal(f.states.at(-1).status, 'guiding');
});
test('Explorar mantém orientação; centralizar não recalcula nem reinicia guidance', async () => {
  const f = fixture(); await f.journey.sync(request()); f.calls.length = 0;
  await f.journey.sync(request({ follow: false }));
  assert.equal(f.calls.includes('stop'), false); assert.equal(f.calls.includes('follow'), false);
  await f.journey.sync(request({ cameraToken: '2' }));
  assert.equal(f.calls.includes('follow'), true); assert.equal(f.calls.includes('start'), false); assert.equal(f.calls.includes('prepare'), false);
});

test('Ver rota completa e fechar detalhes não reinicia nem interrompe guidance', async () => {
  const f = fixture(); await f.journey.sync(request()); f.calls.length = 0;
  const overview = request({ follow: false, overview: true, cameraToken: '2' });
  await f.journey.sync(overview);
  await f.journey.sync(overview);
  assert.equal(f.calls.filter(c => c === 'overview').length, 1);
  assert.equal(f.calls.includes('stop'), false);
  assert.equal(f.calls.includes('start'), false);
  assert.equal(f.calls.includes('prepare'), false);
  await f.journey.sync(request({ cameraToken: '3' }));
  assert.equal(f.calls.filter(c => c === 'follow').length, 1);
  assert.equal(f.states.at(-1).status, 'guiding');
});
test('Sair durante cálculo pendente não inicia orientação depois', async () => {
  const gate = deferred(), entered = deferred();
  const f = fixture({ prepare: async () => { entered.release(); await gate.promise; } });
  const first = f.journey.sync(request()); await entered.promise;
  const exit = f.journey.sync(request({ enabled: false })); gate.release();
  await Promise.all([first, exit]);
  assert.equal(f.calls.includes('start'), false); assert.equal(f.states.at(-1).status, 'ready');
});
test('Sair durante start pendente não recentraliza; para ao terminar', async () => {
  const gate = deferred(), entered = deferred();
  const f = fixture({ start: async () => { entered.release(); await gate.promise; } });
  const first = f.journey.sync(request()); await entered.promise;
  const exit = f.journey.sync(request({ enabled: false })); gate.release(); await Promise.all([first, exit]);
  assert.equal(f.calls.includes('follow'), false); assert.equal(f.calls.filter(c => c === 'stop').length, 2);
  assert.equal(f.states.some(s => s.status === 'guiding'), false);
});
test('Falha de percurso nunca anuncia orientação; callback de ETA não encobre erro', async () => {
  const f = fixture({ prepare: async () => { throw new Error('Sem caminho'); } });
  await f.journey.sync(request()); f.journey.remaining(500, 20);
  assert.equal(f.calls.includes('start'), false); assert.equal(f.states.at(-1).status, 'error');
});
test('Chegada interrompe orientação; som ou centralizar não pula para próximo pedido', async () => {
  const f = fixture(); await f.journey.sync(request()); f.journey.arrival(); f.calls.length = 0;
  await f.journey.sync(request({ cameraToken: '2', muted: true }));
  assert.equal(f.calls.includes('start'), false); assert.equal(f.states.at(-1).status, 'arrived');
  await f.journey.sync(request({ key: 'customer', cameraToken: '3' }));
  assert.equal(f.calls.includes('prepare'), true); assert.equal(f.states.at(-1).status, 'guiding');
});
test('Desmontar durante start pendente para guidance, sem emitir sucesso atrasado', async () => {
  const gate = deferred(), entered = deferred();
  const f = fixture({ start: async () => { entered.release(); await gate.promise; } });
  const work = f.journey.sync(request()); await entered.promise; f.journey.dispose(); gate.release(); await work; await new Promise(r => setImmediate(r));
  assert.equal(f.calls.at(-1), 'stop'); assert.equal(f.states.some(s => s.status === 'guiding'), false);
});
test('Resumo diferencia menos de um minuto, metros e dados indisponíveis', () => {
  assert.equal(journeySummary(30, 85).duration, '< 1 min'); assert.equal(journeySummary(30, 85).distance, '85 m');
  assert.equal(journeySummary(61, 2500).duration, '2 min'); assert.equal(journeySummary(61, 2500).distance, '2,5 km');
  assert.equal(journeySummary(undefined, undefined).arrival, '—:—'); assert.equal(journeySummary(-5, -10).distance, '— km');
});
