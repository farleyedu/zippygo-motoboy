import type { MotoboyQueue, OperationalHeartbeatResponse, OperationalSession, OperationalTokenResponse } from '../../services/mobileApi';
import type { OperationalPermissions } from '../../services/operationalPermissions';

type Identity = { userId: string; establishmentId: string };
type Stored = { token: string; userId: string | null; establishmentId: string | null; session: OperationalSession | null };
export type OperationalPhase = 'restoring' | 'offline' | 'starting' | 'online' | 'ending' | 'reconnecting' | 'permission-required' | 'expired' | 'error';
export type OperationalState = {
  phase: OperationalPhase; session: OperationalSession | null; queue: MotoboyQueue | null;
  permissions: OperationalPermissions | null; error: string | null;
};
export type OperationalPorts = {
  stored: () => Promise<Stored | null>;
  attempt: (identity: Identity) => Promise<string>;
  clearAttempt: () => Promise<void>;
  start: (attemptId: string) => Promise<OperationalTokenResponse>;
  recover?: (attemptId: string, sessionId: string) => Promise<OperationalTokenResponse>;
  current: () => Promise<OperationalSession | null>;
  heartbeat: (force?: boolean) => Promise<OperationalHeartbeatResponse>;
  queue: () => Promise<MotoboyQueue>;
  save: (data: OperationalTokenResponse, identity: Identity) => Promise<void>;
  clear: () => Promise<void>;
  end: (reason: string) => Promise<void>;
  permissions: () => Promise<OperationalPermissions>;
  monitor: (mode: 'online_idle' | 'active_route') => Promise<boolean>;
  stopMonitor: () => Promise<void>;
  locationOptional?: boolean;
};
export function operationalError(error: unknown): { message: string; status?: number; code?: string } {
  const value = error as { message?: string; status?: number; code?: string; response?: { status?: number; data?: { code?: string; error?: string } } };
  const rawMessage = value?.response?.data?.error || value?.message;
  const message = value?.code === 'ERR_NETWORK' || rawMessage && /^(Failed to fetch|Network request failed|Network Error)$/i.test(rawMessage)
    ? 'Não foi possível conectar. Reconecte e tente novamente; seus dados foram preservados.'
    : rawMessage || 'Não foi possível atualizar o turno. Tente novamente.';
  return { message, status: value?.status ?? value?.response?.status, code: value?.code ?? value?.response?.data?.code };
}
export function queueTrackingMode(queue: MotoboyQueue): 'online_idle' | 'active_route' {
  return queue.current || ['retornando', 'returning'].includes(queue.routeState) ? 'active_route' : 'online_idle';
}
export function hasOperationalWork(queue: MotoboyQueue): boolean {
  return !!queue.current || !!queue.next?.length || ['retornando', 'returning'].includes(queue.routeState);
}

// Máquina compartilhada de sessão. Os ports permitem verificar concorrência sem GPS/API reais.
export function createOperationalSessionStore(ports: OperationalPorts) {
  const initial = (): OperationalState => ({ phase: 'offline', session: null, queue: null, permissions: null, error: null });
  let state = initial(), identity: Identity | null = null, epoch = 0;
  let operation: Promise<boolean> | null = null, queueOperation: Promise<boolean> | null = null, monitorMode: string | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<OperationalState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const matches = (version: number) => version === epoch && identity !== null;
  const assertCurrent = (version: number) => { if (!matches(version)) throw new Error('O contexto mudou.'); };

  async function invalidate(message: string, version = epoch) {
    if (!matches(version)) return;
    ++epoch; const nextVersion = epoch;
    update({ phase: 'expired', error: message, session: null, queue: null });
    await ports.stopMonitor();
    if (!matches(nextVersion)) return;
    monitorMode = null;
    await ports.clear();
    if (matches(nextVersion)) await ports.clearAttempt();
  }
  async function handleError(error: unknown, version: number, allowRecovery = true) {
    if (!matches(version)) return;
    const failure = operationalError(error);
    if (allowRecovery && ports.recover && identity && state.session && failure.status === 401 && (!failure.code || failure.code === 'SESSION_EXPIRED')) {
      try { await recoverSaved(state.session.sessionId, version, identity); }
      catch (recoveryError) { await handleError(recoveryError, version, false); }
      return;
    }
    if (failure.status === 401 || failure.code === 'SESSION_CHANGED' || failure.code === 'LINK_FORBIDDEN') {
      await invalidate(failure.message, version);
      return;
    }
    const phase = !state.session ? 'error'
      : state.permissions && !state.permissions.ready ? 'permission-required'
      : failure.status && failure.status >= 400 && failure.status < 500 ? 'online'
      : 'reconnecting';
    update({ phase, error: failure.message });
  }
  function run(action: (version: number, owner: Identity) => Promise<boolean>): Promise<boolean> {
    if (operation) return Promise.resolve(false);
    if (!identity) return Promise.resolve(false);
    const version = epoch, owner = identity;
    const pending = (async () => {
      try { return await action(version, owner); }
      catch (error) { await handleError(error, version); return false; }
    })();
    operation = pending;
    const release = () => { if (operation === pending) operation = null; };
    void pending.then(release, release);
    return pending;
  }
  function refreshQueue(): Promise<boolean> {
    if (queueOperation) return queueOperation;
    if (!identity || !state.session || !['online', 'reconnecting', 'permission-required'].includes(state.phase)) return Promise.resolve(false);
    const version = epoch;
    const pending = (async () => {
      try {
        const queue = await ports.queue();
        if (!matches(version) || !['online', 'reconnecting', 'permission-required'].includes(state.phase)) return false;
        if (!state.queue || queue.version >= state.queue.version) update({ queue });
        if (queueTrackingMode(state.queue!) !== monitorMode) await run(current => enableMonitoring(state.queue!, current));
        return true;
      } catch (error) {
        if (['online', 'reconnecting', 'permission-required'].includes(state.phase)) await handleError(error, version);
        return false;
      }
    })();
    queueOperation = pending;
    const release = () => { if (queueOperation === pending) queueOperation = null; };
    void pending.then(release, release);
    return pending;
  }
  async function enableMonitoring(queue: MotoboyQueue, version: number): Promise<boolean> {
    const permissions = await ports.permissions(); assertCurrent(version);
    update({ permissions });
    if (!permissions.ready) {
      await ports.stopMonitor(); assertCurrent(version); monitorMode = null;
      if (ports.locationOptional) {
        update({ phase: 'online', error: 'GPS indisponível. Sua entrega continua; a loja vê a última posição confirmada. Revise a permissão de localização.' });
        return true;
      }
      update({ phase: 'permission-required', error: permissions.locationConsentGranted === false
        ? 'Revise o uso da localização para acompanhar seu turno.'
        : 'Permita a localização e confira o GPS para acompanhar seu turno.' });
      return false;
    }
    const mode = queueTrackingMode(queue);
    if (monitorMode !== mode) {
      const started = await ports.monitor(mode); assertCurrent(version);
      if (!started) { update({ phase: 'reconnecting', error: 'O GPS ainda não iniciou. Tentaremos novamente; sua rota foi preservada.' }); return false; }
      monitorMode = mode;
    }
    update({ phase: 'online', error: null });
    return true;
  }
  async function restore(version: number, owner: Identity): Promise<boolean> {
    const saved = await ports.stored(); assertCurrent(version);
    if (!saved) {
      await ports.stopMonitor(); assertCurrent(version); monitorMode = null;
      const permissions = await ports.permissions(); assertCurrent(version);
      update({ ...initial(), permissions }); return false;
    }
    if (saved.userId !== owner.userId || saved.establishmentId !== owner.establishmentId) {
      await ports.stopMonitor(); assertCurrent(version);
      update({ phase: 'error', error: 'O turno salvo pertence a outro acesso ou estabelecimento. Entre com o acesso desse turno para recuperá-lo.', session: null, queue: null });
      return false;
    }
    const warm = state.session?.sessionId === saved.session?.sessionId && !!state.queue;
    update({ session: saved.session, phase: warm ? state.phase : 'restoring', error: null });
    let session: OperationalSession | null;
    try { session = await ports.current(); }
    catch (error) {
      const failure = operationalError(error);
      if (ports.recover && saved.session && failure.status === 401 && (!failure.code || failure.code === 'SESSION_EXPIRED'))
        return recoverSaved(saved.session.sessionId, version, owner);
      throw error;
    }
    assertCurrent(version);
    if (session?.isEnded && session.endReason === 'heartbeat_timeout' && ports.recover)
      return recoverSaved(session.sessionId, version, owner);
    if (!session || session.isEnded) { await invalidate('Seu turno foi encerrado. Confira a operação antes de retomar.', version); return false; }
    if (saved.session && (session.sessionId !== saved.session.sessionId || session.epoch !== saved.session.epoch)) {
      await invalidate('Seu turno mudou. Confira a sessão atual antes de continuar.', version); return false;
    }
    const heartbeat = await ports.heartbeat(true); assertCurrent(version);
    if (heartbeat.session.isEnded || heartbeat.session.sessionId !== session.sessionId || heartbeat.session.epoch !== session.epoch) {
      await invalidate('A sessão do turno mudou.', version); return false;
    }
    await ports.save({ ...heartbeat, establishmentId: owner.establishmentId, motoboy: {} }, owner); assertCurrent(version);
    update({ session: heartbeat.session });
    const queue = await ports.queue(); assertCurrent(version); update({ queue });
    return enableMonitoring(queue, version);
  }
  async function recoverSaved(sessionId: string, version: number, owner: Identity): Promise<boolean> {
    assertCurrent(version);
    const attemptId = await ports.attempt(owner); assertCurrent(version);
    // Renova o acesso do mesmo turno. Encerramento explícito não pode ser recuperado.
    const data = await ports.recover!(attemptId, sessionId); assertCurrent(version);
    if (!data.accessToken || data.establishmentId !== owner.establishmentId || data.session?.isEnded || !data.session?.sessionId)
      throw new Error('O servidor não confirmou a recuperação deste turno.');
    await ports.save(data, owner); assertCurrent(version);
    await ports.clearAttempt(); assertCurrent(version);
    monitorMode = null; update({ session: data.session });
    const queue = await ports.queue(); assertCurrent(version); update({ queue });
    return enableMonitoring(queue, version);
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    bind(next: Identity | null) {
      if (identity?.userId === next?.userId && identity?.establishmentId === next?.establishmentId) return;
      ++epoch; identity = next; operation = null; queueOperation = null; monitorMode = null;
      update({ ...initial(), phase: next ? 'restoring' : 'offline' });
      if (!next) void ports.stopMonitor();
    },
    restore: () => run(restore),
    whenIdle: () => Promise.all([operation, queueOperation]).then(results => results.some(Boolean)),
    refreshQueue,
    refreshPermissions: async () => {
      const version = epoch, permissions = await ports.permissions();
      if (matches(version)) update({ permissions });
      return permissions;
    },
    start: () => run(async (version, owner) => {
      update({ phase: 'starting', error: null });
      const permissions = await ports.permissions(); assertCurrent(version); update({ permissions });
      if (!permissions.ready) { update({ phase: 'permission-required', error: permissions.locationConsentGranted === false
        ? 'Revise o uso da localização antes de iniciar o turno.'
        : ports.locationOptional ? 'Permita a localização com o app aberto para iniciar o turno.' : 'A localização com o app aberto, em segundo plano e o GPS precisam estar permitidos.' }); return false; }
      if (await ports.stored()) { assertCurrent(version); return restore(version, owner); }
      assertCurrent(version);
      const attemptId = await ports.attempt(owner); assertCurrent(version);
      const data = await ports.start(attemptId); assertCurrent(version);
      if (!data.accessToken || data.establishmentId !== owner.establishmentId || data.session?.isEnded || !data.session?.sessionId) throw new Error('O servidor não confirmou o turno neste estabelecimento.');
      await ports.save(data, owner); assertCurrent(version);
      update({ session: data.session });
      await ports.clearAttempt(); assertCurrent(version);
      const queue = await ports.queue(); assertCurrent(version); update({ queue });
      return enableMonitoring(queue, version);
    }),
    tick: () => run(async (version, owner) => {
      if (!state.session || state.phase === 'expired') return false;
      const reconcileQueue = !state.queue || state.phase === 'reconnecting';
      const heartbeat = await ports.heartbeat(); assertCurrent(version);
      if (heartbeat.session.isEnded || heartbeat.session.sessionId !== state.session.sessionId || heartbeat.session.epoch !== state.session.epoch) {
        await invalidate('Seu turno foi encerrado ou mudou em outro aparelho.', version); return false;
      }
      await ports.save({ ...heartbeat, establishmentId: owner.establishmentId, motoboy: {} }, owner); assertCurrent(version);
      if (heartbeat.session.version >= state.session.version) update({ session: heartbeat.session });
      if (reconcileQueue) {
        const queue = await ports.queue(); assertCurrent(version);
        if (!state.queue || queue.version >= state.queue.version) update({ queue });
      }
      return enableMonitoring(state.queue!, version);
    }),
    end: (reason = 'motoboy_offline') => run(async (version) => {
      const saved = await ports.stored(); assertCurrent(version);
      if (!saved) { update(initial()); return true; }
      if (saved.userId !== identity?.userId || saved.establishmentId !== identity?.establishmentId) throw new Error('Recupere o acesso do turno salvo antes de encerrá-lo.');
      update({ phase: 'ending', error: null });
      const queue = await ports.queue(); assertCurrent(version); update({ queue });
      if (hasOperationalWork(queue)) throw { status: 409, code: 'MOTOBOY_HAS_PENDING_WORK', message: 'Conclua os pedidos e o retorno à loja antes de encerrar seu turno.' };
      await ports.end(reason); assertCurrent(version);
      await ports.stopMonitor(); assertCurrent(version); monitorMode = null;
      await ports.clear(); assertCurrent(version);
      await ports.clearAttempt(); assertCurrent(version);
      update({ ...initial(), permissions: state.permissions }); return true;
    }),
    updateQueue(queue: MotoboyQueue, expectedSessionId: string) {
      if (state.session?.sessionId === expectedSessionId && (!state.queue || queue.version >= state.queue.version)) update({ queue });
    },
    invalidate,
  };
}
