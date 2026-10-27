import { apiClient } from './apiService';
import { unwrap } from './mobileApi';
import { getSecureItem } from '../utils/secureStorage';
import { executionMode, isIosWeb } from './executionMode';
import { pushGuidance, type PushGuidance } from './webPushGuidance';

export type WebNotificationAccess = 'granted' | 'denied' | 'blocked' | 'unsupported';
export function webPushSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}
export function webNotificationPermission() {
  const supported = webPushSupported();
  return { supported, granted: supported && Notification.permission === 'granted', canAskAgain: supported && Notification.permission === 'default' };
}
export async function requestWebNotificationPermission(): Promise<WebNotificationAccess> {
  if (!webPushSupported()) return 'unsupported';
  // A solicitação precisa ocorrer diretamente no toque, antes de chamadas à API.
  const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  return result === 'granted' ? 'granted' : result === 'denied' ? 'blocked' : 'denied';
}
/**
 * Inscrição efetiva: só vale depois que o PUT do backend respondeu com sucesso para esta sessão e este estabelecimento.
 * Permissão concedida pelo navegador não é inscrição. O estado é da aba: ao reabrir o app ele é refeito
 * pelo registro automático (ChatNotices), que repete o PUT idempotente.
 */
export type WebPushRegistration =
  | { status: 'none' }
  | { status: 'registering'; sessionId: string }
  | { status: 'registered'; sessionId: string; establishmentId: string | null; endpoint: string }
  | { status: 'failed'; sessionId: string; message: string }
  | { status: 'not-configured'; sessionId: string };
let registrationState: WebPushRegistration = { status: 'none' };
const registrationListeners = new Set<() => void>();
function setRegistration(next: WebPushRegistration) { registrationState = next; registrationListeners.forEach(listener => listener()); }
export function webPushRegistration(): WebPushRegistration { return registrationState; }
export function subscribeWebPushRegistration(listener: () => void): () => void {
  registrationListeners.add(listener);
  return () => { registrationListeners.delete(listener); };
}
/** Situação da inscrição para a sessão atual. Inscrição de outra sessão/estabelecimento não conta. */
export function registrationFor(sessionId: string | null | undefined, establishmentId: string | null | undefined, state = registrationState): RegistrationStatus {
  if (!sessionId || state.status === 'none' || state.sessionId !== sessionId) return 'none';
  if (state.status === 'registered' && establishmentId && state.establishmentId && state.establishmentId !== establishmentId) return 'none';
  return state.status;
}
export type RegistrationStatus = WebPushRegistration['status'];
export function webPushGuidanceNow(context: { sessionId?: string | null; establishmentId?: string | null } = {}): PushGuidance {
  const supported = webPushSupported();
  const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  return pushGuidance({ mode: executionMode(), ios: isIosWeb(), supported, permission,
    hasSession: !!context.sessionId, registration: registrationFor(context.sessionId, context.establishmentId) });
}
/** O service worker abre "/?offerNotice=<id>" quando não há janela; a oferta só vale depois da consulta ao servidor. */
export function consumeOfferNoticeParam(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href), offerId = url.searchParams.get('offerNotice');
    if (!offerId) return null;
    url.searchParams.delete('offerNotice');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    return offerId;
  } catch { return null; }
}
let registrationFlight: Promise<void> | null = null;
export function registerWebOfferPush(sessionId: string, settings: { sound: boolean; vibration: boolean }): Promise<void> {
  if (!webNotificationPermission().granted) return Promise.resolve();
  if (registrationFlight) return registrationFlight;
  const work = (async () => {
    const access = await getSecureItem('operationalAccessToken');
    if (!access) return;
    // Um novo registro só substitui o "registrado" se for de outra sessão; refazer o da mesma sessão não apaga o válido.
    if (registrationFor(sessionId, null) !== 'registered') setRegistration({ status: 'registering', sessionId });
    const headers = { Authorization: 'Bearer ' + access };
    const configuration = unwrap<{ configured: boolean; publicKey?: string }>(await apiClient.get('/v2/motoboys/me/session/offer/web-push/configuration', { headers }));
    if (!configuration.configured || !configuration.publicKey) {
      setRegistration({ status: 'not-configured', sessionId });
      throw new Error('Os avisos com o app fechado precisam ser habilitados pela equipe.');
    }
    const registration = await navigator.serviceWorker.register('/offer-push-sw.js', { scope: '/' });
    if (!registration.active) await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(configuration.publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(configuration.publicKey.length / 4) * 4, '=')), c => c.charCodeAt(0));
    let subscription = await registration.pushManager.getSubscription();
    const previousKey = subscription?.options.applicationServerKey;
    if (subscription && previousKey && (new Uint8Array(previousKey).length !== key.length || new Uint8Array(previousKey).some((value, index) => value !== key[index]))) {
      await subscription.unsubscribe(); subscription = null;
    }
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const raw = await getSecureItem('operationalSession'), currentAccess = await getSecureItem('operationalAccessToken');
    if (!raw || JSON.parse(raw).sessionId !== sessionId || !currentAccess) { setRegistration({ status: 'none' }); return; }
    unwrap(await apiClient.put('/v2/motoboys/me/session/offer/web-push', { ...subscription.toJSON(), ...settings }, { headers: { Authorization: 'Bearer ' + currentAccess } }));
    const latest = await getSecureItem('operationalSession');
    if (latest && JSON.parse(latest).sessionId === sessionId) {
      registration.active?.postMessage({ type: 'operational-session', sessionId });
      setRegistration({ status: 'registered', sessionId, establishmentId: await getSecureItem('operationalEstablishmentId'), endpoint: subscription.endpoint });
    } else setRegistration({ status: 'none' });
  })().catch(error => {
    if (registrationState.status === 'registering' && registrationState.sessionId === sessionId)
      setRegistration({ status: 'failed', sessionId, message: error instanceof Error ? error.message : 'Não foi possível registrar os avisos.' });
    throw error;
  });
  registrationFlight = work;
  return work.finally(() => { if (registrationFlight === work) registrationFlight = null; });
}
export async function clearWebOfferPushContext(): Promise<void> {
  setRegistration({ status: 'none' });
  if (!webPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    registration?.active?.postMessage({ type: 'operational-session', sessionId: null });
    const notices = await registration?.getNotifications();
    notices?.forEach(notice => notice.close());
  } catch { /* Encerramento confirmado no servidor não depende do service worker. */ }
}
