import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useOperationalSession } from '../contexts/OperationalSessionContext';

export function DeliveryPanelRedirect({ panel }: { panel: 'code' | 'payment' | 'split' | 'proof' }) {
  const params = useLocalSearchParams<{ id?: string }>(), turn = useOperationalSession();
  return <Redirect href={{ pathname: '/confirmacaoEntrega', params: { id: params.id || String(turn.queue?.current?.pedidoId || ''), panel } }} />;
}
