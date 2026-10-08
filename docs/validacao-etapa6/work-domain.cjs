const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), ts = require('typescript');
const calls = [], results = [];
let response = { status: 200, data: { success: true, data: { entries: [] } } };
const moduleFixture = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, '../../services/workApi.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const apiClient = { get: async (...args) => { calls.push(args); return response; }, post: async (...args) => { calls.push(args); return response; } };
new Function('module', 'exports', 'require', js)(moduleFixture, moduleFixture.exports, name => name === './apiService' ? { apiClient } : { MobileApiError: Error });
const api = moduleFixture.exports;
async function test(name, fn) { await fn(); results.push(name); console.log('OK ' + name); }
(async () => {
  await test('Janelas de hoje e semana respeitam Brasilia e virada UTC', () => {
    const now = new Date('2026-10-05T02:30:00Z');
    assert.equal(api.workWindow('today', now).from, '2026-10-04T03:00:00.000Z');
    assert.equal(api.workWindow('week', now).from, '2026-09-28T03:00:00.000Z');
    assert.equal(api.workWindow('90', now).from, '2026-07-07T03:00:00.000Z');
  });
  await test('Historico personalizado inclui o ultimo dia e aceita ano bissexto', () => {
    assert.deepEqual(api.historyWindow('2024-02-29', '2024-02-29'), { from: '2024-02-29T03:00:00.000Z', to: '2024-03-01T03:00:00.000Z' });
    const custom = api.historyWindow('2026-01-01', '2026-04-03');
    assert.deepEqual(api.workWindow(custom), custom);
  });
  await test('Historico rejeita datas inexistentes, intervalo invertido e mais de 93 dias', () => {
    for (const pair of [['2026-02-29', '2026-03-01'], ['2026-02-31', '2026-03-01'], ['2026-01-02', '2026-01-01'], ['2026-01-01', '2026-04-04'], ['01/01/2026', '2026-01-02']]) assert.throws(() => api.historyWindow(...pair));
  });
  await test('Consulta financeira passa loja, janela e AbortSignal sem token operacional', async () => {
    const signal = new AbortController().signal, period = api.historyWindow('2026-01-01', '2026-01-02');
    await api.getWork('store', period, signal);
    assert.deepEqual(calls.at(-1), ['/motoboys/me/work', { params: { store: 'store', ...period }, signal }]);
  });
  await test('Respostas nulas, sem ACK ou falha nao sao tratadas como sucesso', async () => {
    for (const invalid of [{ status: 200, data: { success: true, data: null } }, { status: 200, data: { data: true } }, { status: 409, data: { success: false, error: 'Conflito' } }]) {
      response = invalid; await assert.rejects(() => api.settlementAction('store', 'id', 'review'));
    }
  });
  await test('Suporte preserva identificador e corpo em repeticao', async () => {
    response = { status: 200, data: { success: true, data: 'request-id' } };
    await api.sendSupport('store', 'request-id', 'security', 'Local inseguro');
    const first = calls.at(-1); await api.sendSupport('store', 'request-id', 'security', 'Local inseguro');
    assert.deepEqual(calls.at(-1), first);
  });
  fs.writeFileSync(path.join(__dirname, 'work-domain-results.json'), JSON.stringify({ results, scope: 'Funcoes reais transpiladas; HTTP controlado, sem API externa.' }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
