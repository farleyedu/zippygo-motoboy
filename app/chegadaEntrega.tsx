import React from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { operationalDestination } from '../src/delivery/operationalDestination';

// A chegada já confirmada pelo servidor leva direto à conferência final.
export default function ArrivalScreen() {
  const turn = useOperationalSession();
  return <Redirect href={operationalDestination(turn.queue, Platform.OS)} />;
}
