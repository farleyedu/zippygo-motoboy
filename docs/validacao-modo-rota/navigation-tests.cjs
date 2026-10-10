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
const request = (changes = {}) => ({ key: 'store', destinations: [{ position: { lat: -18.9, lng: -48.2 }, title: 'Rua A, 10' }], enabled: true, follow: true, cameraToken: '1', muted: false, ...changes });
function fixture(changes = {}) {
  const calls = [], states = [];
  const bridge = Object.fromEntries(['prepare', 'start', 'stop', 'navigationUI', 'follow', 'overview'].map(name => [name, async () => { calls.push(name); }]));
  bridge.audio = () => calls.push('audio');
  return { calls, states, journey: new NavigationJourney({ ...bridge, ...changes }, s => states.push(s)) };
}
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r; }), release: () => resolve() }; };

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
