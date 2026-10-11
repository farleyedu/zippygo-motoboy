import React from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { operationalDestination } from '../src/delivery/operationalDestination';

// O link da notificação abre a tarefa atual; a oferta aparece no diálogo global.
export default function OfferScreen() {
  const turn = useOperationalSession();
  return <Redirect href={operationalDestination(turn.queue, Platform.OS)} />;
}
