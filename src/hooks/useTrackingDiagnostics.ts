import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecureItem } from '../../utils/secureStorage';
import { useOperationalSession } from '../contexts/OperationalSessionContext';

export function useTrackingDiagnostics() {
  const turn = useOperationalSession(), [lastSent, setLastSent] = useState<number | null>(null), [pending, setPending] = useState<number | null>(null);
  useFocusEffect(useCallback(() => { let alive = true; const read = async () => {
    if (!turn.session) { setLastSent(null); setPending(null); return; }
    const scope = `${turn.session.sessionId}.${turn.session.epoch}`;
    try { const [sent, queued] = await Promise.all([getSecureItem(`tracking.sent.v3.${scope}`), AsyncStorage.getItem(`tracking.queue.v3.${scope}`)]); if (!alive) return; const value = sent ? JSON.parse(sent) : null; const at = value?.capturedAtUtc ? Date.parse(value.capturedAtUtc) : null; setLastSent(at && Number.isFinite(at) ? at : null); const list = queued ? JSON.parse(queued) : []; setPending(Array.isArray(list) ? list.length : null); } catch { if (alive) { setLastSent(null); setPending(null); } }
  }; void read(); const timer = setInterval(() => void read(), 5000); return () => { alive = false; clearInterval(timer); }; }, [turn.session?.sessionId, turn.session?.epoch]));
  return { lastSent, pending };
}
