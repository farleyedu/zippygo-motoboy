import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { offerNoticeShouldClose } from './offerAttention';

// Retira apenas oferta conhecida como respondida/encerrada ou prazo vencido.
// Um push novo pode chegar antes da fila: ausência na última consulta não o apaga.
export function useOfferNoticeCleanup() {
  const turn = useOperationalSession();
  const known = useRef<{ sessionId: string; offerId: string | null } | null>(null);
  useEffect(() => {
    const sessionId = turn.session?.sessionId, offerId = turn.queue?.offer?.offerId || null;
    const previous = known.current;
    let resolved: { sessionId: string; offerId: string } | null = null;
    if (previous?.offerId && (sessionId && previous.sessionId !== sessionId || turn.queue && previous.offerId !== offerId || !sessionId && ['offline', 'expired'].includes(turn.phase)))
      resolved = { sessionId: previous.sessionId, offerId: previous.offerId };
    if (sessionId && turn.queue) known.current = { sessionId, offerId };
    else if (!sessionId && ['offline', 'expired'].includes(turn.phase)) known.current = null;
    const prune = async () => {
      try {
        const latest = turn.store.getSnapshot();
        const ended = resolved && !(latest.session?.sessionId === resolved.sessionId && latest.queue?.offer?.offerId === resolved.offerId) ? resolved : null;
        if (Platform.OS === 'web') {
          if (!('serviceWorker' in navigator)) return;
          const registration = await navigator.serviceWorker.getRegistration('/');
          for (const notice of await registration?.getNotifications() || []) if (offerNoticeShouldClose(notice.data, ended)) notice.close();
        } else {
          for (const notice of await Notifications.getPresentedNotificationsAsync()) if (offerNoticeShouldClose(notice.request.content.data, ended)) await Notifications.dismissNotificationAsync(notice.request.identifier);
        }
      } catch { /* Não bloqueia recebimento ou resposta se o painel do sistema falhar. */ }
    };
    void prune();
    const expiry = Date.parse(turn.queue?.offer?.expiresAtUtc || '');
    const timer = Number.isFinite(expiry) ? setTimeout(() => void prune(), Math.max(0, Math.min(expiry - Date.now() + 25, 2147483647))) : undefined;
    const subscription = Platform.OS === 'web' ? null : AppState.addEventListener('change', state => { if (state === 'active') void prune(); });
    const visible = () => { if (document.visibilityState === 'visible') void prune(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); subscription?.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visible); };
  }, [turn.store, turn.session?.sessionId, turn.queue?.version, turn.queue?.offer?.offerId, turn.queue?.offer?.expiresAtUtc, turn.phase]);
}
