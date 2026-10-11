const { test } = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function moduleFor(file, mocks = {}, clock = Date) {
  const exported = {}, compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports: exported, Date: clock, require: name => { if (name in mocks) return mocks[name]; throw new Error('Importação inesperada: ' + name); } });
  return exported;
}
const policy = moduleFor('src/delivery/offerAttention.ts');
const notice = (changes = {}) => ({ offerId: 'oferta-qa', recipientSessionId: 'turno-qa', expiresAtUtc: new Date(Date.now() + 60000).toISOString(), ...changes });
function ledger(read = async () => null, write = async () => {}) { return moduleFor('src/delivery/offerNotices.ts', { '../../utils/secureStorage': { getSecureItem: read, setSecureItem: write } }); }

test('Aviso exige sessão correta e prazo finito; vencido ou malformado não aparece', () => {
  const data = notice(); assert.equal(policy.isCurrentOfferNotice(data, 'turno-qa'), true);
  for (const invalid of [null, {}, { ...data, offerId: '' }, { ...data, expiresAtUtc: undefined }, { ...data, expiresAtUtc: 'inválido' }, { ...data, recipientSessionId: 'outro' }, { ...data, expiresAtUtc: new Date(Date.now() - 1).toISOString() }])
    assert.equal(policy.isCurrentOfferNotice(invalid, 'turno-qa'), false);
  assert.equal(policy.isCurrentOfferNotice(data, undefined), false);
  assert.equal(policy.isCurrentOfferNotice(data, 'turno-qa', Date.parse(data.expiresAtUtc)), false);
});

test('Reserva é imediata mesmo com armazenamento travado e impede avisos concorrentes', () => {
  let reads = 0, writes = 0;
  const f = ledger(() => { reads++; return new Promise(() => {}); }, () => { writes++; return new Promise(() => {}); });
  assert.equal(f.reserveOfferNotice('turno', 'oferta'), true);
  assert.equal(f.reserveOfferNotice('turno', 'oferta'), false);
  assert.equal(reads, 0); assert.equal(writes, 0);
});

test('Falha/timeout da apresentação libera nova tentativa; apenas confirmação grava visto', async () => {
  const saved = []; const f = ledger(undefined, async (key, value) => saved.push([key, value]));
  assert.equal(f.reserveOfferNotice('turno', 'oferta'), true);
  f.releaseOfferNotice('turno', 'oferta');
  assert.equal(f.reserveOfferNotice('turno', 'oferta'), true); assert.equal(saved.length, 0);
  f.confirmOfferNotice('turno', 'oferta'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(saved.length, 1); assert.equal(f.reserveOfferNotice('turno', 'oferta'), false);
  assert.equal(f.reserveOfferNotice('turno', 'oferta-nova'), true);
  assert.equal(f.reserveOfferNotice('outro-turno', 'oferta'), true);
});

test('Persistência reconhece aviso já exibido; falha de leitura não perde oferta nova', async () => {
  const f = ledger(async () => 'oferta');
  assert.equal(await f.offerNoticeShown('turno', 'oferta'), true); assert.equal(f.reserveOfferNotice('turno', 'oferta'), false);
  const failed = ledger(async () => { throw new Error('armazenamento indisponível'); });
  assert.equal(await failed.offerNoticeShown('turno', 'nova'), false); assert.equal(failed.reserveOfferNotice('turno', 'nova'), true);
});

test('Confirmações concorrentes gravam em ordem, preservando o último aviso da sessão', async () => {
  const writes = []; let unlock;
  const hold = new Promise(resolve => { unlock = resolve; });
  const f = ledger(undefined, async (_, value) => { writes.push(value); if (value === 'primeira') await hold; });
  f.confirmOfferNotice('turno', 'primeira'); f.confirmOfferNotice('turno', 'segunda');
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(writes, ['primeira']);
  unlock(); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(writes, ['primeira', 'segunda']);
});

test('Ocultar na rota conserva o aviso na lista, sem novo banner/som; segundo plano continua prioritário', () => {
  const hidden = policy.offerNoticeBehavior(true, true, true);
  assert.equal(hidden.shouldShowList, true); assert.equal(hidden.shouldShowBanner, false); assert.equal(hidden.shouldPlaySound, false);
  const background = policy.offerNoticeBehavior(true, false, true);
  assert.equal(background.shouldShowBanner, true); assert.equal(background.shouldPlaySound, true);
  const duplicate = policy.offerNoticeBehavior(false, false, true);
  assert.equal(duplicate.shouldShowList, false); assert.equal(duplicate.shouldShowBanner, false);
});

test('Toque em oferta ocultada reabre imediatamente sem esperar conexão', async () => {
  const data = notice(); let shown = 0, requests = 0;
  const snapshot = { session: { sessionId: 'turno-qa' }, queue: { offer: data } };
  assert.equal(await policy.revealOfferNotice(data, () => snapshot, async () => { requests++; throw new Error('sem rede'); }, () => shown++), 'opened');
  assert.equal(shown, 1); assert.equal(requests, 0);
});

test('Falha ao carregar aviso não o consome; nova consulta abre sem trocar a página', async () => {
  const data = notice(); let shown = 0;
  const snapshot = { session: { sessionId: 'turno-qa' }, queue: null };
  assert.equal(await policy.revealOfferNotice(data, () => snapshot, async () => false, () => shown++), 'retry'); assert.equal(shown, 0);
  assert.equal(await policy.revealOfferNotice(data, () => snapshot, async () => { snapshot.queue = { offer: data }; return true; }, () => shown++), 'opened'); assert.equal(shown, 1);
});

test('Oferta vencida durante consulta ou sessão substituída não é aberta', async () => {
  let now = Date.now(); class Clock extends Date { static now() { return now; } }
  const p = moduleFor('src/delivery/offerAttention.ts', {}, Clock), data = notice(); let shown = 0;
  const snapshot = { session: { sessionId: 'turno-qa' }, queue: null };
  assert.equal(await p.revealOfferNotice(data, () => snapshot, async () => { now = Date.parse(data.expiresAtUtc); snapshot.queue = { offer: data }; return true; }, () => shown++), 'inactive');
  now = Date.now(); snapshot.queue = null;
  assert.equal(await p.revealOfferNotice(data, () => snapshot, async () => { snapshot.session = { sessionId: 'novo-turno' }; snapshot.queue = { offer: data }; return true; }, () => shown++), 'inactive');
  assert.equal(shown, 0);
});

test('Limpeza retira só aviso vencido ou oferta encerrada conhecida, preservando push novo que antecede a fila', () => {
  const data = notice(), closed = { offerId: 'outra', sessionId: 'turno-qa' };
  assert.equal(policy.offerNoticeShouldClose(data, null), false); assert.equal(policy.offerNoticeShouldClose(data, closed), false);
  assert.equal(policy.offerNoticeShouldClose(data, { offerId: data.offerId, sessionId: 'outro' }), false);
  assert.equal(policy.offerNoticeShouldClose(data, { offerId: data.offerId, sessionId: 'turno-qa' }), true);
  assert.equal(policy.offerNoticeShouldClose({ ...data, expiresAtUtc: new Date(Date.now() - 1).toISOString() }, null), true);
  assert.equal(policy.offerNoticeShouldClose({ chatMessageId: 'mensagem' }, closed), false);
});

test('GPS pendente libera apenas ações optadas de oferta; movimentação e conclusão pendente continuam bloqueadas', async () => {
  const { useRouteAction } = moduleFor('src/hooks/useRouteAction.ts', {
    react: { useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect: () => {} },
    '../../services/mobileApi': { MobileApiError: class extends Error {} },
    '../contexts/OperationalSessionContext': { useOperationalSession: () => ({ store: { getSnapshot: () => ({ phase: 'permission-required', session: { sessionId: 'turno', epoch: 1 } }), updateQueue: () => {} } }) },
    '../contexts/DeliveryCompletionContext': { useDeliveryCompletion: () => ({ assertRouteMutationAllowed: () => { if (pending) throw new Error('conclusão pendente'); } }) },
  });
  let calls = 0, pending = false; const operation = async () => { calls++; return { version: 2 }; };
  await useRouteAction().run(operation); assert.equal(calls, 0);
  await useRouteAction({ allowWithoutLocation: true }).run(operation); assert.equal(calls, 1);
  pending = true; await useRouteAction({ allowWithoutLocation: true }).run(operation); assert.equal(calls, 1);
});
