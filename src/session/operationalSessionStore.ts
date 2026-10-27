import type { MotoboyQueue, OperationalActivityAck, OperationalHeartbeatResponse, OperationalSession, OperationalTokenResponse } from '../../services/mobileApi';
import type { OperationalPermissions } from '../../services/operationalPermissions';

type Identity = { userId: string; establishmentId: string };
type Stored = { token: string; userId: string | null; establishmentId: string | null; session: OperationalSession | null };
export type OperationalPhase = 'restoring' | 'offline' | 'starting' | 'online' | 'ending' | 'reconnecting' | 'permission-required' | 'expired' | 'error';
export type OperationalState = {
  phase: OperationalPhase; session: OperationalSession | null; queue: MotoboyQueue | null;
  permissions: OperationalPermissions | null; error: string | null;
  conflict: { sessionId: string } | null;
  // Por que o turno acabou (ex.: inatividade); permite explicar o encerramento em vez de uma mensagem genérica.
  endReason: string | null;
  // Turno aberto sem GPS (navegador sem permissão, página oculta). Não é erro: a operação segue.
  locationLimited: boolean;
  // O servidor recusou o encerramento por haver pedidos (409 MOTOBOY_HAS_PENDING_WORK); só repetir com confirmação explícita.
  pendingWorkEnd: boolean;
};
export type OperationalPorts = {
  stored: () => Promise<Stored | null>;
  attempt: (identity: Identity) => Promise<string>;
  clearAttempt: () => Promise<void>;
  start: (attemptId: string) => Promise<OperationalTokenResponse>;
  recover?: (attemptId: string, sessionId: string) => Promise<OperationalTokenResponse>;
  switchSession?: (attemptId: string, expectedSessionId: string, establishmentId: string) => Promise<OperationalTokenResponse>;
  current: () => Promise<OperationalSession | null>;
  heartbeat: (force?: boolean) => Promise<OperationalHeartbeatResponse>;
  queue: () => Promise<MotoboyQueue>;
  save: (data: OperationalTokenResponse, identity: Identity) => Promise<void>;
  clear: () => Promise<void>;
  end: (reason: string, confirmPendingWork: boolean) => Promise<void>;
  permissions: () => Promise<OperationalPermissions>;
  monitor: (mode: 'online_idle' | 'active_route') => Promise<boolean>;
  stopMonitor: () => Promise<void>;
  locationOptional?: boolean;
};
export function operationalError(error: unknown): { message: string; status?: number; code?: string; details?: { sessionId?: string } } {
  const value = error as { message?: string; status?: number; code?: string; details?: { sessionId?: string }; response?: { status?: number; data?: { code?: string; error?: string; details?: { sessionId?: string } } } };
  const rawMessage = value?.response?.data?.error || value?.message;
  const message = value?.code === 'ERR_NETWORK' || rawMessage && /^(Failed to fetch|Network request failed|Network Error)$/i.test(rawMessage)
    ? 'Não foi possível conectar. Reconecte e tente novamente; seus dados foram preservados.'
    : rawMessage || 'Não foi possível atualizar o turno. Tente novamente.';
  return { message, status: value?.status ?? value?.response?.status, code: value?.code ?? value?.response?.data?.code, details: value?.details ?? value?.response?.data?.details };
}
export function isInactivityEnd(reason?: string | null): boolean {
  return !!reason && /inactiv|idle/i.test(reason);
}
// O prazo e o destino dos pedidos são decididos pelo servidor; aqui só se explica o resultado.
export const INACTIVITY_END_MESSAGE = 'Seu turno foi encerrado por inatividade (7 horas sem uso do aplicativo). Os pedidos que estavam com você ficaram sob gestão do estabelecimento; fale com a loja para saber o andamento.';
export function endedMessage(reason: string | null | undefined, fallback: string): string {
  return isInactivityEnd(reason) ? INACTIVITY_END_MESSAGE : fallback;
}
export const PENDING_WORK_END_MESSAGE = 'Você ainda tem pedidos com você. Se confirmar o encerramento, eles ficam sob responsabilidade operacional do estabelecimento e saem da sua rota.';
export function isPendingWorkRefusal(error: unknown): boolean {
  return operationalError(error).code === 'MOTOBOY_HAS_PENDING_WORK';
}
const instant = (value?: string | null) => { const parsed = value ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : -Infinity; };
/** Uma resposta mais antiga (ex.: heartbeat iniciado antes do toque) não pode recuar o prazo de inatividade já confirmado. */
export function keepLatestActivity(incoming: OperationalSession, current: OperationalSession | null): OperationalSession {
  if (!current || current.sessionId !== incoming.sessionId || current.epoch !== incoming.epoch) return incoming;
  if (instant(current.lastHumanActivityAtUtc) <= instant(incoming.lastHumanActivityAtUtc)) return incoming;
  return { ...incoming, lastHumanActivityAtUtc: current.lastHumanActivityAtUtc, inactivityExpiresAtUtc: current.inactivityExpiresAtUtc, inactivityRemainingSeconds: current.inactivityRemainingSeconds };
}
export function queueTrackingMode(queue: MotoboyQueue): 'online_idle' | 'active_route' {
  return queue.current || ['retornando', 'returning'].includes(queue.routeState) ? 'active_route' : 'online_idle';
}
export function hasOperationalWork(queue: MotoboyQueue): boolean {
  return !!queue.current || !!queue.next?.length || ['retornando', 'returning'].includes(queue.routeState);
}

// Chamadas nativas (GPS, permissões) não têm tempo limite próprio; sem isso uma delas travada prende o turno inteiro.
const PERMISSIONS_TIMEOUT_MS = 10000, MONITOR_TIMEOUT_MS = 15000, IDLE_WAIT_MS = 25000;
function bounded<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

// Máquina compartilhada de sessão. Os ports permitem verificar concorrência sem GPS/API reais.
export function createOperationalSessionStore(ports: OperationalPorts) {
  const initial = (): OperationalState => ({ phase: 'offline', session: null, queue: null, permissions: null, error: null, conflict: null, endReason: null, locationLimited: false, pendingWorkEnd: false });
  let state = initial(), identity: Identity | null = null, epoch = 0;
  let operation: Promise<boolean> | null = null, operationKind = '', queueOperation: Promise<boolean> | null = null, monitorMode: string | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<OperationalState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const matches = (version: number) => version === epoch && identity !== null;
  const assertCurrent = (version: number) => { if (!matches(version)) throw new Error('O contexto mudou.'); };

  async function invalidate(message: string, version = epoch, endReason: string | null = null) {
    if (!matches(version)) return;
    ++epoch; const nextVersion = epoch;
    update({ phase: 'expired', error: endedMessage(endReason, message), endReason, session: null, queue: null, conflict: null, locationLimited: false });
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
      await invalidate(failure.message, version, isInactivityEnd(failure.code) ? failure.code! : null);
      return;
    }
    if (failure.code === 'SESSION_CONFLICT' && failure.details?.sessionId) {
      update({ phase: 'error', error: failure.message, conflict: { sessionId: failure.details.sessionId } });
      return;
    }
    const phase = !state.session ? 'error'
      : state.permissions && !state.permissions.ready && !ports.locationOptional ? 'permission-required'
      : failure.status && failure.status >= 400 && failure.status < 500 ? 'online'
      : 'reconnecting';
    update({ phase, error: failure.message });
  }
  function run(action: (version: number, owner: Identity) => Promise<boolean>, kind = ''): Promise<boolean> {
    if (operation) return Promise.resolve(false);
    if (!identity) return Promise.resolve(false);
    const version = epoch, owner = identity;
    const pending = (async () => {
      try { return await action(version, owner); }
      catch (error) { await handleError(error, version); return false; }
    })();
    operation = pending; operationKind = kind;
    const release = () => { if (operation === pending) { operation = null; operationKind = ''; } };
    void pending.then(release, release);
    return pending;
  }
  // Ações pedidas pela pessoa ou pela retomada não podem sumir em silêncio só porque o batimento está em andamento:
  // reaproveita a mesma ação se já estiver rodando; senão espera (com limite) a operação atual acabar.
  function runAfterIdle(action: (version: number, owner: Identity) => Promise<boolean>, kind: string): Promise<boolean> {
    if (!operation) return run(action, kind);
    if (operationKind === kind) return operation;
    const version = epoch, previous = operation;
    let timer: ReturnType<typeof setTimeout>;
    const limit = new Promise<void>(resolve => { timer = setTimeout(resolve, IDLE_WAIT_MS); });
    return Promise.race([previous.then(() => undefined, () => undefined), limit]).finally(() => clearTimeout(timer))
      .then(() => version === epoch ? run(action, kind) : false);
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
  const readPermissions = () => bounded(ports.permissions(), PERMISSIONS_TIMEOUT_MS, 'Não foi possível conferir as permissões agora.');
  async function enableMonitoring(queue: MotoboyQueue, version: number, known?: OperationalPermissions): Promise<boolean> {
    const permissions = known ?? await readPermissions(); assertCurrent(version);
    update({ permissions });
    if (!permissions.ready) {
      await ports.stopMonitor(); assertCurrent(version); monitorMode = null;
      if (ports.locationOptional) {
        // Sem GPS o turno continua: a loja vê a última posição confirmada e o aparelho tenta de novo a cada retomada.
        update({ phase: 'online', error: null, locationLimited: true });
        return true;
      }
      update({ phase: 'permission-required', error: permissions.locationConsentGranted === false
        ? 'Revise o uso da localização para acompanhar seu turno.'
        : 'Permita a localização e confira o GPS para acompanhar seu turno.' });
      return false;
    }
    const mode = queueTrackingMode(queue);
    if (monitorMode !== mode) {
      const started = await bounded(ports.monitor(mode), MONITOR_TIMEOUT_MS, 'O GPS demorou para iniciar. Tentaremos novamente; sua rota foi preservada.'); assertCurrent(version);
      if (!started) { update({ phase: 'reconnecting', error: 'O GPS ainda não iniciou. Tentaremos novamente; sua rota foi preservada.' }); return false; }
      monitorMode = mode;
    }
    update({ phase: 'online', error: null, locationLimited: false });
    return true;
  }
  async function restore(version: number, owner: Identity): Promise<boolean> {
    const saved = await ports.stored(); assertCurrent(version);
    if (!saved) {
      await ports.stopMonitor(); assertCurrent(version); monitorMode = null;
      const permissions = await readPermissions(); assertCurrent(version);
      update({ ...initial(), permissions }); return false;
    }
    if (saved.userId !== owner.userId || saved.establishmentId !== owner.establishmentId) {
      await ports.stopMonitor(); assertCurrent(version);
      update({ phase: 'error', error: 'O turno salvo pertence a outro acesso ou estabelecimento. Entre com o acesso desse turno para recuperá-lo.', session: null, queue: null });
      return false;
    }
    const warm = state.session?.sessionId === saved.session?.sessionId && !!state.queue;
    update({ session: saved.session, phase: warm ? state.phase : 'restoring', error: null });
    // Permissões são locais e não dependem da rede: lidas junto com o GET da sessão em vez de depois da fila.
    const permissionsRead = readPermissions().catch(() => null);
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
    if (!session || session.isEnded) { await invalidate('Seu turno foi encerrado. Confira a operação antes de retomar.', version, session?.endReason ?? null); return false; }
    if (saved.session && (session.sessionId !== saved.session.sessionId || session.epoch !== saved.session.epoch)) {
      await invalidate('Seu turno mudou. Confira a sessão atual antes de continuar.', version); return false;
    }
    const heartbeat = await ports.heartbeat(true); assertCurrent(version);
    if (heartbeat.session.isEnded || heartbeat.session.sessionId !== session.sessionId || heartbeat.session.epoch !== session.epoch) {
      await invalidate('A sessão do turno mudou.', version, heartbeat.session.isEnded ? heartbeat.session.endReason ?? null : null); return false;
    }
    await ports.save({ ...heartbeat, establishmentId: owner.establishmentId, motoboy: {} }, owner); assertCurrent(version);
    update({ session: keepLatestActivity(heartbeat.session, state.session) });
    const queue = await ports.queue(); assertCurrent(version);
    const permissions = await permissionsRead; assertCurrent(version);
    // Libera o app assim que a fila chega; o GPS inicia em seguida sem segurar a navegação.
    update(permissions?.ready ? { queue, permissions, phase: 'online', error: null } : { queue });
    return enableMonitoring(queue, version, permissions ?? undefined);
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
    restore: () => runAfterIdle(restore, 'restore'),
    whenIdle: () => Promise.all([operation, queueOperation]).then(results => results.some(Boolean)),
    refreshQueue,
    refreshPermissions: async () => {
      const version = epoch, permissions = await ports.permissions();
      if (matches(version)) update({ permissions });
      return permissions;
    },
    start: () => runAfterIdle(async (version, owner) => {
      update({ phase: 'starting', error: null, conflict: null, pendingWorkEnd: false });
      const permissions = await readPermissions(); assertCurrent(version); update({ permissions });
      // Na Web o turno começa sem GPS (a limitação é informada); no app nativo a permissão continua obrigatória.
      if (!permissions.ready && !ports.locationOptional) { update({ phase: 'permission-required', error: permissions.locationConsentGranted === false
        ? 'Revise o uso da localização antes de iniciar o turno.'
        : 'A localização com o app aberto, em segundo plano e o GPS precisam estar permitidos.' }); return false; }
      if (await ports.stored()) { assertCurrent(version); return restore(version, owner); }
      assertCurrent(version);
      const attemptId = await ports.attempt(owner); assertCurrent(version);
      let data: OperationalTokenResponse;
      try {
        data = await ports.start(attemptId);
      } catch (error) {
        assertCurrent(version);
        // Uma resposta do servidor encerra esta tentativa (sucesso, recusa ou conflito);
        // só a ausência de resposta (falha de rede) justifica repetir com o mesmo id depois.
        if (operationalError(error).status !== undefined) await ports.clearAttempt();
        throw error;
      }
      assertCurrent(version);
      if (!data.accessToken || data.establishmentId !== owner.establishmentId || data.session?.isEnded || !data.session?.sessionId) throw new Error('O servidor não confirmou o turno neste estabelecimento.');
      await ports.save(data, owner); assertCurrent(version);
      update({ session: data.session });
      await ports.clearAttempt(); assertCurrent(version);
      const queue = await ports.queue(); assertCurrent(version); update({ queue });
      return enableMonitoring(queue, version);
    }, 'start'),
    confirmSwitch: () => runAfterIdle(async (version, owner) => {
      const sessionId = state.conflict?.sessionId;
      if (!sessionId || !ports.switchSession) return false;
      update({ phase: 'starting', error: null });
      const attemptId = await ports.attempt(owner); assertCurrent(version);
      let data: OperationalTokenResponse;
      try {
        data = await ports.switchSession(attemptId, sessionId, owner.establishmentId);
      } catch (error) {
        assertCurrent(version);
        if (operationalError(error).status !== undefined) await ports.clearAttempt();
        throw error;
      }
      assertCurrent(version);
      if (!data.accessToken || data.establishmentId !== owner.establishmentId || data.session?.isEnded || !data.session?.sessionId) throw new Error('O servidor não confirmou a troca de turno.');
      await ports.save(data, owner); assertCurrent(version);
      update({ session: data.session, conflict: null });
      await ports.clearAttempt(); assertCurrent(version);
      const queue = await ports.queue(); assertCurrent(version); update({ queue });
      return enableMonitoring(queue, version);
    }, 'switch'),
    cancelConflict: () => { update({ conflict: null, error: null }); void ports.clearAttempt(); },
    tick: () => run(async (version, owner) => {
      if (!state.session || state.phase === 'expired') return false;
      const reconcileQueue = !state.queue || state.phase === 'reconnecting';
      const heartbeat = await ports.heartbeat(); assertCurrent(version);
      if (heartbeat.session.isEnded || heartbeat.session.sessionId !== state.session.sessionId || heartbeat.session.epoch !== state.session.epoch) {
        await invalidate('Seu turno foi encerrado ou mudou em outro aparelho.', version, heartbeat.session.isEnded ? heartbeat.session.endReason ?? null : null); return false;
      }
      await ports.save({ ...heartbeat, establishmentId: owner.establishmentId, motoboy: {} }, owner); assertCurrent(version);
      if (heartbeat.session.version >= state.session.version) update({ session: keepLatestActivity(heartbeat.session, state.session) });
      if (reconcileQueue) {
        const queue = await ports.queue(); assertCurrent(version);
        if (!state.queue || queue.version >= state.queue.version) update({ queue });
      }
      return enableMonitoring(state.queue!, version);
    }, 'tick'),
    // Um único encerramento por vez: um segundo toque reaproveita a solicitação em andamento.
    end: (reason = 'motoboy_offline', options: { confirmPendingWork?: boolean } = {}) => runAfterIdle(async (version) => {
      const saved = await ports.stored(); assertCurrent(version);
      if (!saved) { update(initial()); return true; }
      if (saved.userId !== identity?.userId || saved.establishmentId !== identity?.establishmentId) throw new Error('Recupere o acesso do turno salvo antes de encerrá-lo.');
      update({ phase: 'ending', error: null });
      // O servidor decide se o turno pode acabar com pedidos em andamento; nada local é limpo antes da resposta dele.
      try { await ports.end(reason, options.confirmPendingWork === true); }
      catch (error) {
        assertCurrent(version);
        if (!isPendingWorkRefusal(error)) throw error;
        // Recusa esperada: turno, fila e dados locais seguem intactos até a pessoa confirmar explicitamente.
        update({ phase: 'online', error: PENDING_WORK_END_MESSAGE, pendingWorkEnd: true });
        void refreshQueue();
        return false;
      }
      assertCurrent(version);
      await ports.stopMonitor(); assertCurrent(version); monitorMode = null;
      await ports.clear(); assertCurrent(version);
      await ports.clearAttempt(); assertCurrent(version);
      update({ ...initial(), permissions: state.permissions }); return true;
    }, 'end'),
    cancelEnd: () => { if (state.pendingWorkEnd) update({ pendingWorkEnd: false, error: null }); },
    /** Aplica o prazo confirmado por POST /activity sem trocar o resto da sessão (identidade, versão, token, fila). */
    applyActivity(ack: OperationalActivityAck, expectedSessionId: string) {
      const current = state.session;
      if (!current || current.isEnded || current.sessionId !== expectedSessionId || ['expired', 'ending'].includes(state.phase)) return;
      if (instant(ack.lastHumanActivityAtUtc) < instant(current.lastHumanActivityAtUtc)) return;
      update({ session: { ...current, lastHumanActivityAtUtc: ack.lastHumanActivityAtUtc || current.lastHumanActivityAtUtc,
        inactivityExpiresAtUtc: ack.inactivityExpiresAtUtc, inactivityRemainingSeconds: ack.inactivityRemainingSeconds } });
    },
    updateSession(session: OperationalSession) {
      const current = state.session;
      if (current && !session.isEnded && session.sessionId === current.sessionId && session.epoch === current.epoch && session.version >= current.version) update({ session });
    },
    updateQueue(queue: MotoboyQueue, expectedSessionId: string) {
      if (state.session?.sessionId === expectedSessionId && (!state.queue || queue.version >= state.queue.version)) update({ queue });
    },
    invalidate,
  };
}
