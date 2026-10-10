const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
function fixture(location) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../../services/backgroundLocationLifecycle.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: () => location, Error, Promise, console, __DEV__: false });
  return exports;
}

test('Paradas concorrentes removem a tarefa uma vez; ausente já está encerrada', async () => {
  let running = true, stops = 0;
  const f = fixture({ hasStartedLocationUpdatesAsync: async () => running, stopLocationUpdatesAsync: async () => { stops++; running = false; } });
  await Promise.all(Array.from({ length: 8 }, () => f.stopBackgroundLocation()));
  assert.equal(stops, 1);
  await f.stopBackgroundLocation(); assert.equal(stops, 1);
});

test('Remoção externa entre consulta e parada é confirmada sem falhar o callback', async () => {
  let running = true;
  const f = fixture({ hasStartedLocationUpdatesAsync: async () => running, stopLocationUpdatesAsync: async () => {
    running = false;
    throw new Error("TaskNotFoundException: Task 'background-location-task' not found for app ID 'app'.");
  } });
  await f.stopBackgroundLocation();
});

test('Erros reais e tarefa ainda ativa continuam rejeitando; fila se recupera', async () => {
  const failure = new Error('Permission denied'); let running = true;
  const native = { hasStartedLocationUpdatesAsync: async () => running, stopLocationUpdatesAsync: async () => { throw failure; } };
  const f = fixture(native);
  await assert.rejects(f.stopBackgroundLocation(), error => error === failure);
  native.stopLocationUpdatesAsync = async () => { throw new Error("Task 'background-location-task' not found"); };
  await assert.rejects(f.stopBackgroundLocation(), /not found/);
  native.stopLocationUpdatesAsync = async () => { running = false; };
  await f.stopBackgroundLocation();
});

test('Parada aguarda reinício completo e remove a tarefa recém-registrada', async () => {
  let running = false, release; const gate = new Promise(resolve => { release = resolve; }), calls = [];
  const f = fixture({ hasStartedLocationUpdatesAsync: async () => running,
    startLocationUpdatesAsync: async () => { calls.push('start'); await gate; running = true; },
    stopLocationUpdatesAsync: async () => { calls.push('stop'); running = false; } });
  const restart = f.restartBackgroundLocation({}), stop = f.stopBackgroundLocation();
  await new Promise(setImmediate); assert.deepEqual(calls, ['start']);
  release(); assert.equal(await restart, true); await stop;
  assert.deepEqual(calls, ['start', 'stop']); assert.equal(running, false);
});
