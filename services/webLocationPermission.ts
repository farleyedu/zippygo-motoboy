import type { PermissionValue } from './operationalPermissions';

let grantedInThisPage = false;
export function rememberWebLocationPermission(granted: boolean) { grantedInThisPage = granted; }

export function webLocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation && typeof window !== 'undefined' && window.isSecureContext;
}

export async function readWebLocationPermission(): Promise<PermissionValue> {
  if (!webLocationAvailable()) return { granted: false, canAskAgain: false, supported: false };
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    grantedInThisPage = permission.state === 'granted';
    return { granted: grantedInThisPage, canAskAgain: permission.state !== 'denied', supported: true };
  } catch {
    // Safari pode oferecer GPS sem permitir consultar a permissão.
    return { granted: grantedInThisPage, canAskAgain: true, supported: true };
  }
}

export async function requestWebLocationPermission(): Promise<void> {
  if (!webLocationAvailable()) throw new Error('Abra o ZippyGo por HTTPS e permita a localização no navegador.');
  await new Promise<void>((resolve, reject) => navigator.geolocation.getCurrentPosition(
    () => { grantedInThisPage = true; resolve(); },
    error => {
      if (error.code === 1) grantedInThisPage = false;
      reject(new Error(error.code === 1 ? 'Permita a localização nas configurações do navegador.' : 'Não foi possível obter sua posição. Confira o GPS e tente novamente.'));
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  ));
}
