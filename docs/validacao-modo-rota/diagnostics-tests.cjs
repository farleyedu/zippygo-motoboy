const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
function fixture(fetchImpl = async () => ({ status: 204 }), timers = {}) {
  const records = [], exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../../src/delivery/navigationDiagnostics.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, Promise, Error, AbortController, setTimeout, clearTimeout, ...timers, fetch: fetchImpl, console: { log: (...r) => records.push(r), warn: (...r) => records.push(r) } });
  return { ...exports, records };
}

test('Diagnóstico remove chave, JWT, URL e coordenadas dos textos nativos', () => {
  const { safeNavigationMessage } = fixture();
  const result = safeNavigationMessage('AIzaFAKE_SECRET_123 eyJtest.payload.signature https://example.com/?token=secret lat=-18.912345 lng=-48.234567 Bearer private-secret');
  for (const secret of ['AIzaFAKE', 'eyJtest', 'example.com', '-18.912345', '-48.234567', 'private-secret']) assert.equal(result.includes(secret), false);
  assert.equal(safeNavigationMessage('NETWORK_ERROR'), 'NETWORK_ERROR');
});

test('Operações lentas são rastreadas e os timers são removidos ao concluir ou sair', () => {
  const pending = new Map(); let id = 0;
  const f = fixture(undefined, { setTimeout: cb => { pending.set(++id, cb); return id; }, clearTimeout: key => pending.delete(key) });
  const disabled = new f.NavigationDiagnostics(false);
  disabled.operation('route')(); assert.equal(pending.size, 0);
  const log = new f.NavigationDiagnostics(true), finish = log.operation('route');
  assert.equal(pending.size, 3);
  [...pending.values()][0]();
  finish({ status: 'NETWORK_ERROR' }, true); finish();
  assert.equal(pending.size, 0);
  const rows = f.records.map(row => JSON.parse(row[1]));
  assert.deepEqual(rows.map(row => row.phase), ['route.begin', 'route.pending', 'route.end']);
  assert.ok(rows.every(row => row.operationId === rows[0].operationId));
  log.operation('reset'); log.close();
  assert.equal(pending.size, 0);
  assert.equal(JSON.parse(f.records.at(-1)[1]).interruptedByLifecycle, true);
});

test('Logs são desligados fora do diagnóstico e tentativas têm identificação própria', () => {
  const f = fixture();
  new f.NavigationDiagnostics(false).event('route.begin');
  assert.equal(f.records.length, 0);
  const a = new f.NavigationDiagnostics(true), b = new f.NavigationDiagnostics(true);
  a.event('route.result', { status: 'NETWORK_ERROR' }, true); b.event('sdk.init.result', { status: 'ok' });
  const first = JSON.parse(f.records[0][1]), second = JSON.parse(f.records[1][1]);
  assert.notEqual(first.attemptId, second.attemptId);
  assert.equal(first.phase, 'route.result'); assert.equal(first.status, 'NETWORK_ERROR');
});

test('Probes públicos não enviam credenciais e são limitados por voo e intervalo', async () => {
  const calls = [];
  const f = fixture(async (url, options) => { calls.push({ url, options }); return { status: url.includes('clients4') ? 204 : 400 }; });
  const disabled = new f.NavigationDiagnostics(false);
  f.diagnoseNavigationConnection(disabled); assert.equal(calls.length, 0);
  const log = new f.NavigationDiagnostics(true);
  f.diagnoseNavigationConnection(log); f.diagnoseNavigationConnection(log);
  await new Promise(resolve => setImmediate(resolve));
  f.diagnoseNavigationConnection(log);
  assert.equal(calls.length, 2);
  for (const call of calls) { assert.equal(call.options.method, 'HEAD'); assert.equal(call.options.headers, undefined); }
  assert.equal(f.records.length, 2);
  assert.ok(f.records.every(row => JSON.parse(row[1]).testsNavigationAuthorization === false));
});
