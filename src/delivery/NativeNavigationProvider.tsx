import React, { useEffect } from 'react';
import { nativeNavigationAvailable } from '../../services/nativeNavigation';
import { useOperationalSession } from '../contexts/OperationalSessionContext';

let reset = Promise.resolve();
// The SDK memoizes its controller using this object's identity. Keep it stable
// when operational session updates cause the provider to render again.
const navigationTerms = { title: 'Sua rota no ZippyGo', companyName: 'ZippyGo' };
export const waitForNavigationReset = () => reset;
// Include pending native commands in the session barrier before the next init.
export function waitForNavigationStop(work: Promise<void>) {
  reset = Promise.all([reset.catch(() => {}), work.catch(() => {})]).then(() => {});
}
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
  return <sdk.NavigationProvider termsAndConditionsDialogOptions={navigationTerms} taskRemovedBehavior={sdk.TaskRemovedBehavior.CONTINUE_SERVICE}><NavigationLifecycle />{children}</sdk.NavigationProvider>;
}
