import React, { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { operationalDestination } from '../src/delivery/operationalDestination';
import { Feedback, Screen } from '../src/ui/Kit';

export default function RouteStateScreen() {
  const turn = useOperationalSession(), router = useRouter(), params = useLocalSearchParams<{ tipo?: string; pedidoId?: string }>();
  const [error, setError] = useState('');
  const focused = useRef(false);
  const refresh = async () => {
    const updated = await turn.store.refreshQueue();
    if (!focused.current) return;
    if (!updated) { setError(turn.store.getSnapshot().error || 'Não foi possível atualizar a fila.'); return; }
    if (params.tipo !== 'offer-expired') turn.setRouteNotice({ kind: params.tipo === 'cancelled' ? 'cancelled' : 'changed', pedidoId: Number(params.pedidoId) || undefined, version: turn.store.getSnapshot().queue?.version || 0 });
    router.replace(operationalDestination(turn.store.getSnapshot().queue, Platform.OS));
  };
  useFocusEffect(useCallback(() => { focused.current = true; void refresh(); return () => { focused.current = false; }; }, [turn.store, params.tipo, params.pedidoId]));
  return <Screen><Feedback title="Atualizando sua rota" loading={!error} message={error || undefined} onRetry={error ? () => void refresh() : undefined} /></Screen>;
}
