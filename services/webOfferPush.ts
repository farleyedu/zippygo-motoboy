import { apiClient } from './apiService';
import { unwrap } from './mobileApi';
import { getSecureItem } from '../utils/secureStorage';

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
let registrationFlight: Promise<void> | null = null;
export function registerWebOfferPush(sessionId: string, settings: { sound: boolean; vibration: boolean }): Promise<void> {
  if (!webNotificationPermission().granted) return Promise.resolve();
  if (registrationFlight) return registrationFlight;
  const work = (async () => {
    const access = await getSecureItem('operationalAccessToken');
    if (!access) return;
    const headers = { Authorization: 'Bearer ' + access };
    const configuration = unwrap<{ configured: boolean; publicKey?: string }>(await apiClient.get('/v2/motoboys/me/session/offer/web-push/configuration', { headers }));
    if (!configuration.configured || !configuration.publicKey) throw new Error('Os avisos com o app fechado precisam ser habilitados pela equipe.');
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
    if (!raw || JSON.parse(raw).sessionId !== sessionId || !currentAccess) return;
    unwrap(await apiClient.put('/v2/motoboys/me/session/offer/web-push', { ...subscription.toJSON(), ...settings }, { headers: { Authorization: 'Bearer ' + currentAccess } }));
    const latest = await getSecureItem('operationalSession');
    if (latest && JSON.parse(latest).sessionId === sessionId) registration.active?.postMessage({ type: 'operational-session', sessionId });
  })();
  registrationFlight = work;
  return work.finally(() => { if (registrationFlight === work) registrationFlight = null; });
}
export async function clearWebOfferPushContext(): Promise<void> {
  if (!webPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    registration?.active?.postMessage({ type: 'operational-session', sessionId: null });
    const notices = await registration?.getNotifications();
    notices?.forEach(notice => notice.close());
  } catch { /* Encerramento confirmado no servidor não depende do service worker. */ }
}
