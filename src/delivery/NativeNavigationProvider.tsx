import React, { useEffect } from 'react';
import { nativeNavigationAvailable } from '../../services/nativeNavigation';
import { useOperationalSession } from '../contexts/OperationalSessionContext';

let reset = Promise.resolve();
export const waitForNavigationReset = () => reset;
function NavigationLifecycle() {
  const turn = useOperationalSession();
  const sdk = require('@googlemaps/react-native-navigation-sdk') as typeof import('@googlemaps/react-native-navigation-sdk');
  const { navigationController: engine } = sdk.useNavigation();
  useEffect(() => {
    // A próxima inicialização espera o descarte do navegador da sessão anterior.
    reset = reset.catch(() => {}).then(async () => { await engine.stopGuidance().catch(() => {}); await engine.clearDestinations().catch(() => {}); await engine.cleanup().catch(() => {}); });
  }, [turn.session?.sessionId, engine]);
  return null;
}

export function NativeNavigationProvider({ children }: { children: React.ReactNode }) {
  if (!nativeNavigationAvailable) return <>{children}</>;
  const sdk = require('@googlemaps/react-native-navigation-sdk') as typeof import('@googlemaps/react-native-navigation-sdk');
  return <sdk.NavigationProvider termsAndConditionsDialogOptions={{ title: 'Sua rota no ZippyGo', companyName: 'ZippyGo' }} taskRemovedBehavior={sdk.TaskRemovedBehavior.CONTINUE_SERVICE}><NavigationLifecycle />{children}</sdk.NavigationProvider>;
}
