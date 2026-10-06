import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secureStorage';
import { OperationalLocationPayload, sendOperationalLocation } from './mobileApi';

export type TrackingMode = 'online_idle' | 'active_route';

const TRACKING_MODE_KEY = 'trackingMode';
const TRACKING_SEQUENCE_KEY = 'trackingSequence';
const LOCATION_QUEUE_KEY = 'tracking.locationQueue.v2';
const LAST_SENT_LOCATION_KEY = 'tracking.lastSentLocation.v2';
const MAX_QUEUE_SIZE = 100;

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
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await sendLocation(location, mode);
}

export async function sendLocation(
  location: Location.LocationObject,
  mode?: TrackingMode,
  options: { force?: boolean } = {},
): Promise<void> {
  const operationalToken = await getSecureItem('operationalAccessToken');
  if (!operationalToken) return;

  const trackingMode = mode ?? (await getTrackingMode());
  const payload = await buildPayload(location, trackingMode);
  if (!options.force && !(await shouldSend(payload))) return;

  try {
    await flushLocationQueue();
    await sendOperationalLocation(payload);
    await setSecureItem(LAST_SENT_LOCATION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[TRACKING] Falha ao enviar localizacao; amostra colocada na fila.', error);
    await enqueueLocation(payload);
  }
}

export async function flushLocationQueue(): Promise<void> {
  const queued = await readQueue();
  if (queued.length === 0) return;

  const remaining: OperationalLocationPayload[] = [];
  for (const payload of queued) {
    try {
      await sendOperationalLocation(payload);
      await setSecureItem(LAST_SENT_LOCATION_KEY, JSON.stringify(payload));
    } catch {
      remaining.push(payload);
      break;
    }
  }
  await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(remaining));
}

async function buildPayload(
  location: Location.LocationObject,
  trackingMode: TrackingMode,
): Promise<OperationalLocationPayload> {
  return {
    sampleId: createIdentifier(),
    sequence: await nextSequence(),
    capturedAtUtc: new Date(location.timestamp || Date.now()).toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: toNumberOrNull(location.coords.accuracy),
    speedMps: toNumberOrNull(location.coords.speed),
    headingDegrees: toNumberOrNull(location.coords.heading),
    trackingMode,
  };
}

async function nextSequence(): Promise<number> {
  const current = Number(await getSecureItem(TRACKING_SEQUENCE_KEY));
  const next = Number.isFinite(current) ? current + 1 : 1;
  await setSecureItem(TRACKING_SEQUENCE_KEY, String(next));
  return next;
}

async function shouldSend(next: OperationalLocationPayload): Promise<boolean> {
  const raw = await getSecureItem(LAST_SENT_LOCATION_KEY);
  if (!raw) return true;
  try {
    const previous = JSON.parse(raw) as OperationalLocationPayload;
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

async function readQueue(): Promise<OperationalLocationPayload[]> {
  const raw = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function enqueueLocation(payload: OperationalLocationPayload): Promise<void> {
  const queued = await readQueue();
  queued.push(payload);
  await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(queued.slice(-MAX_QUEUE_SIZE)));
}

function toNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function createIdentifier(): string {
  const cryptoObject = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return cryptoObject?.randomUUID?.() ?? `${Date.now()}-${identifierCounter++}`;
}

let identifierCounter = 0;
