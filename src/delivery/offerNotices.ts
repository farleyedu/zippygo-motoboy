import { getSecureItem, setSecureItem } from '../../utils/secureStorage';

const seen = new Set<string>();
const inFlight = new Map<string, Promise<boolean>>();
const key = (session: string, offer: string) => session + ':' + offer;
export async function offerNoticeShown(session: string, offer: string): Promise<boolean> {
  const identity = key(session, offer);
  return seen.has(identity) || await getSecureItem('zippygo.offer-shown.' + session) === offer;
}
export async function claimOfferNotice(session: string, offer: string): Promise<boolean> {
  const identity = key(session, offer);
  if (inFlight.has(identity)) return false;
  const work = (async () => {
    if (await offerNoticeShown(session, offer)) return false;
    seen.add(identity);
    if (seen.size > 100) seen.delete(seen.values().next().value!);
    await setSecureItem('zippygo.offer-shown.' + session, offer).catch(() => {});
    return true;
  })();
  inFlight.set(identity, work);
  try { return await work; } finally { inFlight.delete(identity); }
}
