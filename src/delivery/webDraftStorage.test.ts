import { deleteWebDraft, readWebDraft, writeWebDraft, type WebDraftStore } from './webDraftStorage';
import { inactivityRemainingLabel } from '../session/inactivity';
import { createOperationalSessionStore, type OperationalPorts } from '../session/operationalSessionStore';

const memory = (over: Partial<WebDraftStore> = {}): WebDraftStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); }, ...over };
};

describe('rascunho de conclusão na Web', () => {
  it('grava no armazenamento durável e apaga a cópia da sessão', () => {
    const durable = memory(), session = memory(); session.data.set('k', 'velho');
    writeWebDraft('k', 'novo', { durable, session });
    expect(durable.data.get('k')).toBe('novo');
    expect(session.data.has('k')).toBe(false);
  });
  it('lê o durável primeiro e ainda lê rascunhos antigos da sessão', () => {
    const durable = memory(), session = memory();
    session.data.set('k', 'legado');
    expect(readWebDraft('k', { durable, session })).toBe('legado');
    durable.data.set('k', 'atual');
    expect(readWebDraft('k', { durable, session })).toBe('atual');
  });
  it('cota ou modo privado: cai para a sessão em vez de perder a conferência', () => {
    const durable = memory({ setItem: () => { throw new Error('quota'); } }), session = memory();
    writeWebDraft('k', 'v', { durable, session });
    expect(session.data.get('k')).toBe('v');
  });
  it('sem nenhum armazenamento falha de forma explícita', () => {
    expect(() => writeWebDraft('k', 'v', { durable: null, session: null })).toThrow(/não permite guardar/);
  });
  it('apagar remove das duas camadas', () => {
    const durable = memory(), session = memory();
    durable.data.set('k', 'a'); session.data.set('k', 'b');
    deleteWebDraft('k', { durable, session });
    expect(readWebDraft('k', { durable, session })).toBeNull();
  });
});

describe('prazo de inatividade', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  it('mostra horas e minutos restantes informados pelo servidor', () => {
    expect(inactivityRemainingLabel('2026-01-01T16:12:00Z', now)).toMatch(/6 h 12 min/);
  });
  it('sem prazo do servidor não inventa um', () => {
    expect(inactivityRemainingLabel(null, now)).toBeNull();
    expect(inactivityRemainingLabel('lixo', now)).toBeNull();
  });
});

describe('encerramento do turno não perde conclusão pendente', () => {
  const draftKey = 'zippygo.completion.u1';
  const session = { sessionId: 's1', epoch: 1, version: 1, isEnded: false, heartbeatIntervalSeconds: 240 } as any;
  const queue = { motoboyId: 1, estabelecimentoId: 'e1', version: 1, next: [], routeState: 'idle', current: { pedidoId: 9 } } as any;
  const boot = (durable: ReturnType<typeof memory>, end: OperationalPorts['end']) => {
    const store = createOperationalSessionStore({
      stored: async () => durable.data.has('operationalSession') ? { token: 't', userId: 'u1', establishmentId: 'e1', session } : null,
      attempt: async () => 'a', clearAttempt: async () => {}, start: async () => ({}) as any,
      current: async () => session, heartbeat: async () => ({ session, accessToken: 't' }) as any,
      queue: async () => queue, save: async () => {}, end,
      // Mesmo limpeza usada pelo app: só as chaves do turno, nunca a conferência.
      clear: async () => { ['operationalAccessToken', 'operationalSession', 'operationalEstablishmentId', 'operationalUserId'].forEach(k => durable.removeItem(k)); },
      permissions: async () => ({ ready: true }) as any, monitor: async () => true, stopMonitor: async () => {},
    });
    store.bind({ userId: 'u1', establishmentId: 'e1' });
    return store;
  };
  const withDraft = () => {
    const durable = memory(), session = memory();
    durable.data.set('operationalSession', '{}');
    writeWebDraft(draftKey, JSON.stringify({ phase: 'sending', operationId: 'op1' }), { durable, session });
    return { durable, session };
  };

  it('recusa por pedidos mantém o rascunho e a sessão local', async () => {
    const stores = withDraft();
    const store = boot(stores.durable, async () => { throw { status: 409, code: 'MOTOBOY_HAS_PENDING_WORK' }; });
    await store.restore();
    await expect(store.end('client_end')).resolves.toBe(false);
    expect(readWebDraft(draftKey, stores)).toMatch(/op1/);
    expect(stores.durable.data.has('operationalSession')).toBe(true);
  });

  it('falha de rede mantém o rascunho e a sessão local', async () => {
    const stores = withDraft();
    const store = boot(stores.durable, async () => { throw new Error('Network Error'); });
    await store.restore();
    await expect(store.end('client_end', { confirmPendingWork: true })).resolves.toBe(false);
    expect(readWebDraft(draftKey, stores)).toMatch(/op1/);
    expect(stores.durable.data.has('operationalSession')).toBe(true);
  });

  it('encerramento confirmado limpa o turno sem apagar a conclusão enviada', async () => {
    const stores = withDraft();
    const store = boot(stores.durable, async () => {});
    await store.restore();
    await expect(store.end('client_end', { confirmPendingWork: true })).resolves.toBe(true);
    expect(stores.durable.data.has('operationalSession')).toBe(false);
    expect(readWebDraft(draftKey, stores)).toMatch(/op1/);
  });
});
