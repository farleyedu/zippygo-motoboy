import { createOperationalSessionStore, type OperationalPorts } from './operationalSessionStore';

const identity = { userId: 'u1', establishmentId: 'e1' };
const session = { sessionId: 's1', epoch: 1, version: 1, isEnded: false, heartbeatIntervalSeconds: 240 } as any;
const queue = { motoboyId: 1, estabelecimentoId: 'e1', version: 1, next: [], routeState: 'idle', current: null } as any;
const ready = { ready: true } as any;
const noGps = { ready: false, locationConsentGranted: false, foreground: { granted: false } } as any;

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

describe('turno na Web sem GPS', () => {
  it('inicia o turno sem localização autorizada e marca a limitação, sem erro', async () => {
    const monitor = jest.fn(async () => true);
    const store = boot({ locationOptional: true, stored: async () => null, permissions: async () => noGps, monitor,
      start: async () => ({ accessToken: 't', establishmentId: 'e1', session, motoboy: {} }) as any });
    await expect(store.start()).resolves.toBe(true);
    expect(store.getSnapshot().phase).toBe('online');
    expect(store.getSnapshot().locationLimited).toBe(true);
    expect(store.getSnapshot().error).toBeNull();
    expect(monitor).not.toHaveBeenCalled();
  });

  it('no app nativo a permissão continua obrigatória para iniciar', async () => {
    const start = jest.fn();
    const store = boot({ stored: async () => null, permissions: async () => noGps, start: start as any });
    await expect(store.start()).resolves.toBe(false);
    expect(store.getSnapshot().phase).toBe('permission-required');
    expect(start).not.toHaveBeenCalled();
  });

  it('o GPS volta sozinho quando a permissão passa a valer, no próximo batimento', async () => {
    let granted = false;
    const monitor = jest.fn(async () => true);
    const store = boot({ locationOptional: true, permissions: async () => (granted ? ready : noGps), monitor });
    await store.restore();
    expect(store.getSnapshot().locationLimited).toBe(true);
    granted = true;
    await store.tick();
    expect(monitor).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().locationLimited).toBe(false);
  });

  it('erro de rede com GPS ausente vira reconexão, não bloqueio por permissão', async () => {
    let fail = false;
    const store = boot({ locationOptional: true, permissions: async () => noGps, heartbeat: async () => { if (fail) throw new Error('Network Error'); return { session, accessToken: 't' } as any; } });
    await store.restore();
    fail = true;
    await store.tick();
    expect(store.getSnapshot().phase).toBe('reconnecting');
    expect(store.getSnapshot().session).not.toBeNull();
  });
});

describe('encerramento do turno', () => {
  const busyQueue = { ...queue, current: { pedidoId: 9 } } as any;

  it('com pedidos pergunta ao servidor e só limpa os dados locais depois da resposta', async () => {
    const order: string[] = [];
    const store = boot({ queue: async () => busyQueue, end: async () => { order.push('end'); }, clear: async () => { order.push('clear'); } });
    await store.restore();
    await expect(store.end('client_end')).resolves.toBe(true);
    expect(order).toEqual(['end', 'clear']);
  });

  it('recusa do servidor mantém turno, fila e dados locais', async () => {
    const clear = jest.fn(async () => {});
    const store = boot({ queue: async () => busyQueue, clear, end: async () => { throw { status: 409, code: 'MOTOBOY_HAS_PENDING_WORK', message: 'Há pedidos.' }; } });
    await store.restore();
    await expect(store.end('client_end')).resolves.toBe(false);
    expect(clear).not.toHaveBeenCalled();
    expect(store.getSnapshot().session).not.toBeNull();
    expect(store.getSnapshot().error).toBe('Há pedidos.');
  });

  it('sem resposta (rede) mantém o turno e os dados locais', async () => {
    const clear = jest.fn(async () => {});
    const store = boot({ clear, end: async () => { throw new Error('Network Error'); } });
    await store.restore();
    await expect(store.end('logout')).resolves.toBe(false);
    expect(clear).not.toHaveBeenCalled();
    expect(store.getSnapshot().phase).toBe('reconnecting');
  });
});

describe('encerramento por inatividade', () => {
  it('batimento com turno encerrado por inatividade explica o motivo e o destino dos pedidos', async () => {
    const ended = { ...session, isEnded: true, endReason: 'inactivity_timeout' };
    const store = boot({ heartbeat: async () => ({ session: ended, accessToken: 't' }) as any });
    await store.restore();
    expect(store.getSnapshot().phase).toBe('expired');
    expect(store.getSnapshot().endReason).toBe('inactivity_timeout');
    expect(store.getSnapshot().error).toMatch(/inatividade/);
    expect(store.getSnapshot().error).toMatch(/gestão do estabelecimento/);
  });

  it('consulta da sessão já encerrada por inatividade também usa a explicação', async () => {
    const store = boot({ current: async () => ({ ...session, isEnded: true, endReason: 'inactivity_timeout' }) as any });
    await store.restore();
    expect(store.getSnapshot().error).toMatch(/gestão do estabelecimento/);
  });

  it('outros encerramentos mantêm a mensagem genérica', async () => {
    const store = boot({ current: async () => ({ ...session, isEnded: true, endReason: 'motoboy_offline' }) as any });
    await store.restore();
    expect(store.getSnapshot().error).toBe('Seu turno foi encerrado. Confira a operação antes de retomar.');
  });
});
