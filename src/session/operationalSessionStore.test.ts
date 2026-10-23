import { createOperationalSessionStore, type OperationalPorts } from './operationalSessionStore';

const identity = { userId: 'u1', establishmentId: 'e1' };
const session = { sessionId: 's1', epoch: 1, version: 1, isEnded: false, heartbeatIntervalSeconds: 240 } as any;
const queue = { motoboyId: 1, estabelecimentoId: 'e1', version: 1, next: [], routeState: 'idle', current: null } as any;
const ready = { ready: true } as any;
const never = <T,>() => new Promise<T>(() => {});

function ports(over: Partial<OperationalPorts> = {}): OperationalPorts {
  return {
    stored: async () => ({ token: 't', userId: 'u1', establishmentId: 'e1', session }),
    attempt: async () => 'a', clearAttempt: async () => {}, start: async () => ({}) as any,
    current: async () => session, heartbeat: async () => ({ session, accessToken: 't' }) as any,
    queue: async () => queue, save: async () => {}, clear: async () => {}, end: async () => {},
    permissions: async () => ready, monitor: async () => true, stopMonitor: async () => {},
    ...over,
  };
}
const boot = (over?: Partial<OperationalPorts>) => { const store = createOperationalSessionStore(ports(over)); store.bind(identity); return store; };

describe('restore do turno', () => {
  it('libera o app quando a fila chega, sem esperar o GPS iniciar', async () => {
    const store = boot({ monitor: () => never<boolean>() });
    void store.restore();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(store.getSnapshot().phase).toBe('online');
    expect(store.getSnapshot().queue).toEqual(queue);
  });

  it('lê as permissões enquanto a sessão ainda é consultada', async () => {
    const order: string[] = [];
    const store = boot({
      current: async () => { order.push('current:start'); await Promise.resolve(); order.push('current:end'); return session; },
      permissions: async () => { order.push('permissions'); return ready; },
    });
    await store.restore();
    expect(order.indexOf('permissions')).toBeLessThan(order.indexOf('current:end'));
  });

  it('sem permissão pronta mantém o turno bloqueado pela permissão, não online', async () => {
    const store = boot({ permissions: async () => ({ ready: false, locationConsentGranted: true }) as any });
    await store.restore();
    expect(store.getSnapshot().phase).toBe('permission-required');
  });
});

describe('tempo limite do GPS', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('GPS que não responde vira reconexão e solta a operação', async () => {
    const store = boot({ monitor: () => never<boolean>() });
    const pending = store.restore();
    await jest.advanceTimersByTimeAsync(16000);
    await expect(pending).resolves.toBe(false);
    expect(store.getSnapshot().phase).toBe('reconnecting');
    expect(store.getSnapshot().queue).toEqual(queue);
  });
});

describe('operações concorrentes', () => {
  it('start espera o batimento em andamento em vez de retornar false em silêncio', async () => {
    let releaseHeartbeat: () => void = () => {};
    let calls = 0;
    const store = boot({
      stored: async () => ({ token: 't', userId: 'u1', establishmentId: 'e1', session }),
      heartbeat: () => { calls++; return calls > 1 ? Promise.resolve({ session, accessToken: 't' } as any) : new Promise(resolve => { releaseHeartbeat = () => resolve({ session, accessToken: 't' } as any); }); },
    });
    const ticking = store.tick();                       // sem sessão ainda: encerra imediatamente
    await ticking;
    const restoring = store.restore();                  // o primeiro heartbeat fica pendurado
    await new Promise(resolve => setTimeout(resolve, 5));
    const starting = store.start();                     // chega com a operação ocupada
    releaseHeartbeat();
    await expect(restoring).resolves.toBe(true);
    await expect(starting).resolves.toBe(true);
  });

  it('restore repetido reaproveita a execução em andamento', async () => {
    let currentCalls = 0;
    const store = boot({ current: async () => { currentCalls++; await new Promise(resolve => setTimeout(resolve, 10)); return session; } });
    const [a, b] = await Promise.all([store.restore(), store.restore()]);
    expect(a).toBe(true); expect(b).toBe(true);
    expect(currentCalls).toBe(1);
  });
});
