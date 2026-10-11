import { getSecureItem, setSecureItem } from '../../utils/secureStorage';

const seen = new Set<string>();
const pending = new Set<string>();
const writes = new Map<string, Promise<void>>();
const key = (session: string, offer: string) => session + ':' + offer;
export async function offerNoticeShown(session: string, offer: string): Promise<boolean> {
  const identity = key(session, offer);
  if (seen.has(identity) || pending.has(identity)) return true;
  const saved = await getSecureItem('zippygo.offer-shown.' + session).catch(() => null);
  if (saved === offer) seen.add(identity);
  return seen.has(identity) || pending.has(identity);
}
// Handler Expo tem prazo de 3 s. Reservar em memória não espera disco ou rede.
export function reserveOfferNotice(session: string, offer: string): boolean {
  const identity = key(session, offer);
  if (seen.has(identity) || pending.has(identity)) return false;
  pending.add(identity); return true;
}
export function confirmOfferNotice(session: string, offer: string): void {
  const identity = key(session, offer);
  pending.delete(identity); seen.add(identity);
  if (seen.size > 100) seen.delete(seen.values().next().value!);
  const write = (writes.get(session) || Promise.resolve()).then(() => setSecureItem('zippygo.offer-shown.' + session, offer)).catch(() => {});
  writes.set(session, write);
  void write.finally(() => { if (writes.get(session) === write) writes.delete(session); });
}
export function releaseOfferNotice(session: string, offer: string): void {
  pending.delete(key(session, offer));
}
