import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from './AuthContext';
import { createOperationalSessionStore, OperationalPorts } from '../session/operationalSessionStore';
import { clearOperationalSession, createIdentifier, endOperationalSession, getOperationalQueue, getOperationalSession, heartbeatOperationalSession, saveOperationalSession, startOperationalSession } from '../../services/mobileApi';
import { readOperationalPermissions } from '../../services/operationalPermissions';
import { registerOperationalLogoutGuard, subscribeOperationalFailures } from '../../services/sessionEvents';
import { clearCurrentTrackingData, clearTrackingMode } from '../../services/trackingService';
import { iniciarMonitoramentoLocalizacao, pararMonitoramentoLocalizacao } from '../../components/locationSetup';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../../utils/secureStorage';
import { startOperationalRealtime } from '../../services/operationalRealtime';

const ATTEMPT_KEY = 'operationalStartAttempt';
async function stored() {
  const [token, raw, establishmentId, storedOwner] = await Promise.all(['operationalAccessToken', 'operationalSession', 'operationalEstablishmentId', 'operationalUserId'].map(getSecureItem));
  if (!token) return null;
  let userId = storedOwner;
  if (!userId) { try { userId = jwtDecode<{ sub?: string }>(token).sub || null; } catch { /* Um token legado sem identidade exige recuperação. */ } }
  let session = null;
  try { session = raw ? JSON.parse(raw) : null; } catch { /* Reconciliar com a API. */ }
  return { token, session, establishmentId, userId };
}

function createPorts(): OperationalPorts {
  return {
    stored,
    attempt: async identity => {
      const raw = await getSecureItem(ATTEMPT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { attemptId: string; userId: string; establishmentId: string };
        if (saved.userId !== identity.userId || saved.establishmentId !== identity.establishmentId) throw new Error('Existe um início de turno pendente em outro contexto. Recupere esse acesso primeiro.');
        return saved.attemptId;
      }
      const attemptId = createIdentifier();
      await setSecureItem(ATTEMPT_KEY, JSON.stringify({ ...identity, attemptId }));
      return attemptId;
    },
    clearAttempt: () => deleteSecureItem(ATTEMPT_KEY),
    start: attemptId => startOperationalSession({ attemptId, persist: false }),
    current: getOperationalSession,
    heartbeat: force => heartbeatOperationalSession({ persist: false, force }),
    queue: getOperationalQueue,
    save: async (data, identity) => {
      const rawUser = await getSecureItem('zippygo.user');
      const rawStore = await getSecureItem('zippygo.estabelecimentoAtual');
      const user = rawUser ? JSON.parse(rawUser) as { id: string } : null;
      const store = rawStore ? JSON.parse(rawStore) as { id?: string; estabelecimentoId?: string } : null;
      if (String(user?.id) !== identity.userId || (store?.estabelecimentoId ?? store?.id) !== identity.establishmentId) throw new Error('O acesso mudou antes de confirmar o turno.');
      await saveOperationalSession(data);
      await setSecureItem('operationalUserId', identity.userId);
    },
    clear: async () => { await clearCurrentTrackingData(); await clearOperationalSession(); await clearTrackingMode(); },
    end: reason => endOperationalSession(reason, { clear: false }),
    permissions: readOperationalPermissions,
    monitor: iniciarMonitoramentoLocalizacao,
    stopMonitor: pararMonitoramentoLocalizacao,
  };
}
type Store = ReturnType<typeof createOperationalSessionStore>;
type RouteNotice = { kind: 'cancelled' | 'changed'; pedidoId?: number; version: number };
type Value = ReturnType<Store['getSnapshot']> & { store: Store; online: boolean; busy: boolean; routeNotice: RouteNotice | null; clearRouteNotice: () => void };
const OperationalContext = createContext<Value | null>(null);

export function OperationalSessionProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const store = useMemo(() => createOperationalSessionStore(createPorts()), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [appState, setAppState] = useState(AppState.currentState);
  const [routeNotice, setRouteNotice] = useState<RouteNotice | null>(null);
  useEffect(() => setRouteNotice(null), [state.session?.sessionId]);
  const establishmentId = auth.estabelecimentoAtual && ('estabelecimentoId' in auth.estabelecimentoAtual ? auth.estabelecimentoAtual.estabelecimentoId : auth.estabelecimentoAtual.id);
  const userId = auth.user?.id;
  const queueSyncEnabled = !!state.session && ['online', 'reconnecting'].includes(state.phase);
  useEffect(() => {
    if (auth.isLoading) return;
    store.bind(userId && establishmentId ? { userId, establishmentId } : null);
    if (userId && establishmentId) void store.restore();
  }, [store, auth.isLoading, userId, establishmentId]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => {
      setAppState(next);
      if (next === 'active') void store.restore();
    });
    return () => listener.remove();
  }, [store]);
  useEffect(() => {
    if (!state.session || appState !== 'active' || state.phase === 'expired') return;
    const seconds = Math.max(5, Math.min(state.session.heartbeatIntervalSeconds || 20, 60));
    const timer = setInterval(() => { void store.tick(); }, seconds * 1000);
    return () => clearInterval(timer);
  }, [store, state.session?.sessionId, state.session?.heartbeatIntervalSeconds, appState, state.phase === 'expired']);
  useEffect(() => {
    if (!queueSyncEnabled || appState !== 'active' || !state.session) return;
    const sessionId = state.session.sessionId, sessionEpoch = state.session.epoch;
    return startOperationalRealtime({
      onRouteEvent: event => {
        if (['canceled', 'auto_closed'].includes(event.action || '')) setRouteNotice({ kind: 'cancelled', pedidoId: event.pedidoId, version: event.version });
        else if (['assigned', 'reordered', 'transferred', 'transfer_completed'].includes(event.action || '')) setRouteNotice({ kind: 'changed', pedidoId: event.pedidoId, version: event.version });
      },
      token: async () => {
        const saved = await stored();
        if (!saved || saved.userId !== userId || saved.establishmentId !== establishmentId || saved.session?.sessionId !== sessionId || saved.session.epoch !== sessionEpoch) throw new Error('O contexto do turno mudou.');
        return saved.token;
      },
      refresh: async () => { await store.whenIdle(); return store.refreshQueue(); },
      version: () => store.getSnapshot().queue?.version ?? -1,
      scope: () => {
        const snapshot = store.getSnapshot();
        return snapshot.session?.sessionId === sessionId && snapshot.session.epoch === sessionEpoch && snapshot.queue
          ? { establishmentId: snapshot.queue.estabelecimentoId, motoboyId: snapshot.queue.motoboyId } : null;
      },
    });
  }, [store, state.session?.sessionId, state.session?.epoch, appState, queueSyncEnabled, userId, establishmentId]);
  useEffect(() => subscribeOperationalFailures(failure => {
    void (async () => {
      if (failure.token && failure.token === await getSecureItem('operationalAccessToken')) await store.invalidate(failure.message);
    })().catch(() => { /* A tela mantém o estado de recuperação. */ });
  }), [store]);
  useEffect(() => registerOperationalLogoutGuard(async () => {
    const snapshot = store.getSnapshot();
    if (['restoring', 'starting', 'ending'].includes(snapshot.phase)) throw new Error('Aguarde a atualização do turno antes de sair.');
    await store.whenIdle();
    const saved = await stored();
    if (!saved) {
      if (await getSecureItem(ATTEMPT_KEY)) throw new Error('Há um início de turno pendente. Reconecte e recupere o turno antes de sair.');
      await pararMonitoramentoLocalizacao();
      await clearTrackingMode();
      return;
    }
    if (!(await store.end('logout'))) throw new Error(store.getSnapshot().error || 'Não foi possível encerrar o turno. Seu acesso foi mantido.');
  }), [store]);
  const value: Value = { ...state, store, routeNotice, clearRouteNotice: () => setRouteNotice(null), online: !!state.session && ['online', 'reconnecting'].includes(state.phase), busy: ['restoring', 'starting', 'ending'].includes(state.phase) };
  return <OperationalContext.Provider value={value}>{children}</OperationalContext.Provider>;
}
export function useOperationalSession() {
  const value = useContext(OperationalContext);
  if (!value) throw new Error('Use OperationalSessionProvider para acessar o turno.');
  return value;
}
