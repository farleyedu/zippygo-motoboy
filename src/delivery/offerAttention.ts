export type OfferNotice = { offerId: string; recipientSessionId: string; expiresAtUtc: string };
export type OfferAttentionSnapshot = { session: { sessionId: string } | null; queue: { offer?: { offerId?: string | null; expiresAtUtc: string } | null } | null };

export function readOfferNotice(data: unknown): OfferNotice | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  return typeof value.offerId === 'string' && !!value.offerId && typeof value.recipientSessionId === 'string' && !!value.recipientSessionId
    && typeof value.expiresAtUtc === 'string' && Number.isFinite(Date.parse(value.expiresAtUtc)) ? value as OfferNotice : null;
}

export function isCurrentOfferNotice(data: unknown, sessionId?: string, now = Date.now()): boolean {
  const notice = readOfferNotice(data);
  return !!notice && notice.recipientSessionId === sessionId && Date.parse(notice.expiresAtUtc) > now;
}

// Não consulta rede se a oferta já está disponível: o toque reabre imediatamente.
// Uma consulta malsucedida não consome o aviso; pode ser retomada depois.
export async function revealOfferNotice(data: unknown, read: () => OfferAttentionSnapshot, refresh: () => Promise<boolean>, reveal: () => void): Promise<'opened' | 'inactive' | 'retry'> {
  const notice = readOfferNotice(data);
  if (!notice || !isCurrentOfferNotice(notice, read().session?.sessionId)) return 'inactive';
  const available = () => {
    const current = read();
    return isCurrentOfferNotice(notice, current.session?.sessionId) && current.queue?.offer?.offerId === notice.offerId
      && Date.parse(current.queue.offer.expiresAtUtc) > Date.now();
  };
  if (available()) { reveal(); return 'opened'; }
  if (!await refresh()) return 'retry';
  if (!available()) return 'inactive';
  reveal(); return 'opened';
}

export function offerNoticeShouldClose(data: unknown, resolved: { offerId: string; sessionId: string } | null, now = Date.now()): boolean {
  const notice = readOfferNotice(data);
  return !!notice && (Date.parse(notice.expiresAtUtc) <= now || !!resolved && notice.offerId === resolved.offerId && notice.recipientSessionId === resolved.sessionId);
}

export function offerNoticeBehavior(allowed: boolean, hiddenWhileActive: boolean, sound: boolean) {
  const banner = allowed && !hiddenWhileActive;
  return { shouldShowAlert: banner, shouldShowBanner: banner, shouldShowList: allowed, shouldSetBadge: false, shouldPlaySound: banner && sound };
}
