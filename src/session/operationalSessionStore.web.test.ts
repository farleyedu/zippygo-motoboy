import { createOperationalSessionStore, keepLatestActivity, PENDING_WORK_END_MESSAGE, type OperationalPorts } from './operationalSessionStore';

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
    expect(store.getSnapshot().error).toBe(PENDING_WORK_END_MESSAGE);
    expect(store.getSnapshot().pendingWorkEnd).toBe(true);
  });

  it('409 MOTOBOY_HAS_PENDING_WORK pede confirmação explícita e não reenvia sozinho', async () => {
    const end = jest.fn(async () => { throw { status: 409, code: 'MOTOBOY_HAS_PENDING_WORK', message: 'Há pedidos.' }; });
    const clear = jest.fn(async () => {}), stopMonitor = jest.fn(async () => {});
    const store = boot({ queue: async () => busyQueue, end, clear, stopMonitor });
    await store.restore(); stopMonitor.mockClear();
    await expect(store.end('client_end')).resolves.toBe(false);
    expect(end).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledWith('client_end', false);
    expect(store.getSnapshot()).toMatchObject({ phase: 'online', pendingWorkEnd: true });
    expect(store.getSnapshot().queue).toEqual(busyQueue);
    expect(clear).not.toHaveBeenCalled();
    expect(stopMonitor).not.toHaveBeenCalled();
  });

  it('com a confirmação explícita envia confirmPendingWork=true e só então limpa', async () => {
    const order: string[] = [];
    let calls = 0;
    const store = boot({ queue: async () => busyQueue, clear: async () => { order.push('clear'); },
      end: async (_reason, confirm) => { calls++; order.push(`end:${confirm}`); if (!confirm) throw { status: 409, code: 'MOTOBOY_HAS_PENDING_WORK' }; } });
    await store.restore();
    await store.end('client_end');
    await expect(store.end('client_end', { confirmPendingWork: true })).resolves.toBe(true);
    expect(calls).toBe(2);
    expect(order).toEqual(['end:false', 'end:true', 'clear']);
    expect(store.getSnapshot()).toMatchObject({ phase: 'offline', session: null, pendingWorkEnd: false });
  });

  it('desistir depois da recusa mantém o turno e apaga só o pedido de confirmação', async () => {
    const store = boot({ queue: async () => busyQueue, end: async () => { throw { status: 409, code: 'MOTOBOY_HAS_PENDING_WORK' }; } });
    await store.restore(); await store.end('client_end');
    store.cancelEnd();
    expect(store.getSnapshot()).toMatchObject({ phase: 'online', pendingWorkEnd: false, error: null });
    expect(store.getSnapshot().session).not.toBeNull();
  });

  it('erro do servidor (5xx) durante a confirmação mantém turno e dados, sem encerrar', async () => {
    const clear = jest.fn(async () => {});
    const store = boot({ queue: async () => busyQueue, clear, end: async () => { throw { status: 503, message: 'Indisponível' }; } });
    await store.restore();
    await expect(store.end('client_end', { confirmPendingWork: true })).resolves.toBe(false);
    expect(clear).not.toHaveBeenCalled();
    expect(store.getSnapshot().session).not.toBeNull();
    expect(store.getSnapshot().queue).toEqual(busyQueue);
  });

  it('dois toques seguidos geram uma única solicitação de encerramento', async () => {
    let release: () => void = () => {};
    const end = jest.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const store = boot({ end });
    await store.restore();
    const first = store.end('client_end'), second = store.end('client_end');
    await new Promise(resolve => setTimeout(resolve, 5));
    release();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(end).toHaveBeenCalledTimes(1);
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

describe('prazo de inatividade por atividade humana', () => {
  const tracked = { ...session, lastHumanActivityAtUtc: '2026-01-01T10:00:00Z', inactivityExpiresAtUtc: '2026-01-01T17:00:00Z', inactivityRemainingSeconds: 25200 };
  const ack = { recorded: true, serverTimeUtc: '2026-01-01T11:00:00Z', lastHumanActivityAtUtc: '2026-01-01T11:00:00Z', inactivityExpiresAtUtc: '2026-01-01T18:00:00Z', inactivityRemainingSeconds: 25200 };
  const restored = async (over: Partial<OperationalPorts> = {}) => {
    const store = boot({ current: async () => tracked, heartbeat: async () => ({ session: tracked, accessToken: 't' }) as any, ...over });
    await store.restore(); return store;
  };

  it('aplica só o prazo confirmado, preservando identidade, versão e fila', async () => {
    const store = await restored();
    const before = store.getSnapshot();
    store.applyActivity(ack, 's1');
    const after = store.getSnapshot();
    expect(after.session).toMatchObject({ sessionId: 's1', epoch: 1, version: 1, inactivityExpiresAtUtc: ack.inactivityExpiresAtUtc, lastHumanActivityAtUtc: ack.lastHumanActivityAtUtc });
    expect(after.queue).toBe(before.queue);
  });

  it('recorded=false aplica o prazo vigente devolvido pelo servidor, sem inventar outro', async () => {
    const store = await restored();
    store.applyActivity({ ...ack, recorded: false, lastHumanActivityAtUtc: tracked.lastHumanActivityAtUtc, inactivityExpiresAtUtc: tracked.inactivityExpiresAtUtc }, 's1');
    expect(store.getSnapshot().session?.inactivityExpiresAtUtc).toBe(tracked.inactivityExpiresAtUtc);
  });

  it('resposta de outro turno ou de turno encerrado é ignorada', async () => {
    const store = await restored();
    store.applyActivity(ack, 'outro');
    expect(store.getSnapshot().session?.inactivityExpiresAtUtc).toBe(tracked.inactivityExpiresAtUtc);
    await store.invalidate('fim');
    store.applyActivity(ack, 's1');
    expect(store.getSnapshot().session).toBeNull();
  });

  it('heartbeat não renova as 7 horas e uma resposta antiga não recua o prazo confirmado', async () => {
    const store = await restored({ locationOptional: true });
    store.applyActivity(ack, 's1');
    await store.tick(); // heartbeat devolve a sessão com o prazo anterior ao toque
    expect(store.getSnapshot().session?.inactivityExpiresAtUtc).toBe(ack.inactivityExpiresAtUtc);
  });

  it('heartbeat com atividade mais recente (outro aparelho/ação) passa a valer', () => {
    const newer = { ...tracked, lastHumanActivityAtUtc: '2026-01-01T12:00:00Z', inactivityExpiresAtUtc: '2026-01-01T19:00:00Z' };
    expect(keepLatestActivity(newer, { ...tracked, ...ack } as any).inactivityExpiresAtUtc).toBe('2026-01-01T19:00:00Z');
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
