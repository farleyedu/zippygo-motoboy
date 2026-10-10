import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { stopBackgroundLocation } from './backgroundLocationLifecycle';
import { browserNativeTest } from './browserNativeTest';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secureStorage';
import { createIdentifier, heartbeatOperationalSession, OperationalLocationPayload, sendOperationalLocations } from './mobileApi';

export type TrackingMode = 'online_idle' | 'active_route';

const TRACKING_MODE_KEY = 'trackingMode';
const MAX_QUEUE_SIZE = 100;
const MAX_FLUSH_SAMPLES = 20;
const FLUSH_BUDGET_MS = 8000;
type TrackingScope = { id: string; token: string; queueKey: string; sequenceKey: string; sentKey: string; heartbeatKey: string; heartbeatInterval: number; nextSequence: number };
type LocationPoint = Omit<OperationalLocationPayload, 'sampleId' | 'sequence'>;
let trackingWork: Promise<unknown> = Promise.resolve();
let presenceWork: { id: string; promise: Promise<boolean> } | null = null;
const retries = new Map<string, { failures: number; after: number }>();
const closingScopes = new Set<string>();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = trackingWork.then(work, work);
  trackingWork = next.catch(() => undefined);
  return next;
}
async function scope(): Promise<TrackingScope | null> {
  const [token, raw, ownerId, establishmentId, rawUser, rawStore] = await Promise.all(['operationalAccessToken', 'operationalSession', 'operationalUserId', 'operationalEstablishmentId', 'zippygo.user', 'zippygo.estabelecimentoAtual'].map(getSecureItem));
  if (!token || !raw) return null;
  try {
    const user = rawUser ? JSON.parse(rawUser) as { id: string } : null;
    const store = rawStore ? JSON.parse(rawStore) as { id?: string; estabelecimentoId?: string } : null;
    if (!ownerId || String(user?.id) !== ownerId || !establishmentId || (store?.estabelecimentoId ?? store?.id) !== establishmentId) return null;
    const session = JSON.parse(raw) as { sessionId: string; epoch: number; isEnded: boolean; heartbeatIntervalSeconds?: number; nextLocationSequence?: number };
    if (!session.sessionId || session.isEnded || !Number.isFinite(session.epoch)) return null;
    const id = `${session.sessionId}.${session.epoch}`;
    return { id, token, queueKey: `tracking.queue.v3.${id}`, sequenceKey: `tracking.sequence.v3.${id}`, sentKey: `tracking.sent.v3.${id}`, heartbeatKey: `tracking.heartbeat.v3.${id}`, heartbeatInterval: Math.max(5, Math.min(session.heartbeatIntervalSeconds || 25, 60)), nextSequence: Number.isSafeInteger(session.nextLocationSequence) && session.nextLocationSequence! > 0 ? session.nextLocationSequence! : 1 };
  } catch { return null; }
}
async function stillCurrent(context: TrackingScope) { return !closingScopes.has(context.id) && (await scope())?.id === context.id; }
export async function clearCurrentTrackingData(): Promise<void> {
  const context = await scope();
  if (!context) return;
  if (closingScopes.size >= 64) closingScopes.clear();
  closingScopes.add(context.id);
  // Depois do DELETE confirmado, impedir que um ACK headless pendente volte
  // a gravar credenciais ou timestamp enquanto limpamos a sessão.
  if (presenceWork?.id === context.id) await presenceWork.promise.catch(() => undefined);
  await serialize(async () => {
    await AsyncStorage.removeItem(context.queueKey);
    await deleteSecureItem(context.sentKey);
    await deleteSecureItem(context.sequenceKey);
    await deleteSecureItem(context.heartbeatKey);
    retries.delete(context.id);
  });
}

// A tarefa nativa também renova presença: timers React não continuam com a tela apagada.
export async function maintainOperationalPresence(): Promise<boolean> {
  const context = await scope();
  if (!context) return false;
  if (presenceWork?.id === context.id) return presenceWork.promise;
  // A presença não entra no mutex do GPS: um reenvio lento não pode expirar o turno.
  const pending = (async () => {
    if (!(await stillCurrent(context))) return false;
    const previous = Number(await getSecureItem(context.heartbeatKey));
    if (previous && Date.now() - previous < context.heartbeatInterval * 1000) return true;
    try {
      const response = await heartbeatOperationalSession({ persist: false, token: context.token });
      if (!(await stillCurrent(context))) return false;
      if (`${response.session.sessionId}.${response.session.epoch}` !== context.id || response.session.isEnded) {
        await stopBackgroundLocation();
        return false;
      }
      const raw = await getSecureItem('operationalSession');
      const latest = raw ? JSON.parse(raw) as { version?: number } : null;
      // Um heartbeat concorrente mais novo pode já ter renovado token e versão.
      if ((latest?.version ?? 0) <= response.session.version) {
        await setSecureItem('operationalAccessToken', response.accessToken);
        await setSecureItem('operationalSession', JSON.stringify(response.session));
      }
      // mobileApi compartilha a confirmação real com o heartbeat do foreground.
      return true;
    } catch (error) {
      const failure = error as { status?: number; code?: string; response?: { status?: number } };
      if ((failure.status === 401 || failure.response?.status === 401 || ['SESSION_CHANGED', 'LINK_FORBIDDEN'].includes(failure.code || '')) && (await scope())?.token === context.token) {
        // Sem provider React no headless: parar GPS e reconciliar a sessão ao reabrir.
        await stopBackgroundLocation();
        return false;
      }
      // Falha de rede mantém a amostra na fila; não equivale a turno encerrado.
      return true;
    }
  })();
  presenceWork = { id: context.id, promise: pending };
  const release = () => { if (presenceWork?.promise === pending) presenceWork = null; };
  void pending.then(release, release);
  return pending;
}

export async function getTrackingMode(): Promise<TrackingMode> {
  const stored = await getSecureItem(TRACKING_MODE_KEY);
  return stored === 'active_route' ? 'active_route' : 'online_idle';
}

export async function setTrackingMode(mode: TrackingMode): Promise<void> {
  await setSecureItem(TRACKING_MODE_KEY, mode);
}

export async function clearTrackingMode(): Promise<void> {
  await deleteSecureItem(TRACKING_MODE_KEY);
}

export async function sendCurrentLocation(mode?: TrackingMode): Promise<void> {
  if (browserNativeTest) return;
  const context = await scope();
  if (!context || closingScopes.has(context.id)) return;
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  if (await stillCurrent(context)) await sendLocation(location, mode);
}

export async function sendLocation(
  location: Location.LocationObject,
  mode?: TrackingMode,
  options: { force?: boolean; expectedScopeId?: string } = {},
): Promise<void> {
  if (browserNativeTest) return;
  const context = await scope();
  if (!context || options.expectedScopeId && options.expectedScopeId !== context.id) return;
  return serialize(async () => {
    if (!(await stillCurrent(context))) return;
    const trackingMode = mode ?? (await getTrackingMode());
    const point = locationPoint(location, trackingMode);
    if (options.force || await shouldSend(point, context)) {
      await enqueueLocation({ ...point, sampleId: createIdentifier(), sequence: await nextSequence(context) }, context);
    }
    if (Date.now() < (retries.get(context.id)?.after ?? 0)) return;
    try {
      await flushQueue(context);
    } catch { /* A fila já foi persistida, inclusive a amostra que falhou. */ }
  });
}

export async function flushLocationQueue(): Promise<void> {
  if (browserNativeTest) return;
  const context = await scope();
  if (context) await serialize(() => flushQueue(context));
}

async function flushQueue(context: TrackingScope): Promise<void> {
  let queued = await readQueue(context);
  if (queued.length === 0) return;
  const started = Date.now();
  while (queued.length && Date.now() - started < FLUSH_BUDGET_MS) {
    if (!(await stillCurrent(context))) return;
    try {
      const samples = queued.slice(0, MAX_FLUSH_SAMPLES);
      const acknowledgments = await sendOperationalLocations(samples, context.token);
      if (!(await stillCurrent(context))) return;
      const confirmed = new Set<string>();
      let latest: OperationalLocationPayload | undefined;
      for (const ack of acknowledgments) {
        const sample = samples.find(s => s.sampleId === ack?.sampleId && s.sequence === ack.sequence);
        if (!sample || confirmed.has(sample.sampleId) ||
            !(['accepted', 'duplicate', 'stale'].includes(ack.outcome) || (ack.outcome === 'rejected' && ack.code === 'LOCATION_INVALID')))
          throw new Error('Confirmação de localização inválida.');
        confirmed.add(sample.sampleId);
        if (ack.outcome === 'accepted' || ack.outcome === 'duplicate') {
          if (!latest || sample.sequence > latest.sequence) latest = sample;
        }
      }
      if (!confirmed.size) throw new Error('Localizações ainda sem confirmação.');
      if (latest) await setSecureItem(context.sentKey, JSON.stringify(latest));
      queued = queued.filter(s => !confirmed.has(s.sampleId));
      await AsyncStorage.setItem(context.queueKey, JSON.stringify(queued));
      retries.delete(context.id);
      if (acknowledgments.length < samples.length) break;
    } catch {
      // ACK perdido pode ser reenviado: UUID e sequence continuam os mesmos.
      const failures = (retries.get(context.id)?.failures ?? 0) + 1;
      if (retries.size >= 64) retries.clear();
      retries.set(context.id, { failures, after: Date.now() + Math.min(60000, 15000 * 2 ** Math.min(failures - 1, 2)) });
      throw new Error('Localizações aguardam conexão.');
    }
  }
}

function locationPoint(location: Location.LocationObject, trackingMode: TrackingMode): LocationPoint {
  return {
    capturedAtUtc: new Date(location.timestamp || Date.now()).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: toNumberOrNull(location.coords.accuracy),
    speedMps: toNumberOrNull(location.coords.speed),
    headingDegrees: location.coords.heading != null && location.coords.heading >= 360 ? null : toNumberOrNull(location.coords.heading),
    trackingMode,
  };
}

async function nextSequence(context: TrackingScope): Promise<number> {
  const current = Number(await getSecureItem(context.sequenceKey));
  const next = Math.max(Number.isSafeInteger(current) && current >= 0 ? current + 1 : 1, context.nextSequence);
  await setSecureItem(context.sequenceKey, String(next));
  return next;
}

async function shouldSend(next: LocationPoint, context: TrackingScope): Promise<boolean> {
  const [queued, raw] = await Promise.all([readQueue(context), getSecureItem(context.sentKey)]);
  if (!raw && !queued.length) return true;
  try {
    // Offline, comparar também com a última amostra pendente evita guardar
    // posições idênticas a cada callback enquanto o último ACK está distante.
    const previous = queued.length ? queued[queued.length - 1] : JSON.parse(raw!) as OperationalLocationPayload;
    const seconds = Math.abs(
      (new Date(next.capturedAtUtc).getTime() - new Date(previous.capturedAtUtc).getTime()) / 1000,
    );
    const distance = distanceMeters(previous.latitude, previous.longitude, next.latitude, next.longitude);
    return next.trackingMode === 'active_route'
      ? distance >= 10 || seconds >= 10
      : distance >= 50 || seconds >= 60;
  } catch {
    return true;
  }
}

async function readQueue(context: TrackingScope): Promise<OperationalLocationPayload[]> {
  const raw = await AsyncStorage.getItem(context.queueKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function enqueueLocation(payload: OperationalLocationPayload, context: TrackingScope): Promise<void> {
  const queued = await readQueue(context);
  queued.push(payload);
  await AsyncStorage.setItem(context.queueKey, JSON.stringify(queued.slice(-MAX_QUEUE_SIZE)));
}

function toNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
