import type { PermissionValue } from './operationalPermissions';

let grantedInThisPage = false;
let deniedInThisPage = false;
export class WebLocationPermissionError extends Error {
  constructor(public readonly reason: 'denied' | 'unavailable', message: string) { super(message); }
}
export function rememberWebLocationPermission(granted: boolean) { grantedInThisPage = granted; if (granted) deniedInThisPage = false; }

export function webLocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation && typeof window !== 'undefined' && window.isSecureContext;
}

export async function readWebLocationPermission(): Promise<PermissionValue> {
  if (!webLocationAvailable()) return { granted: false, canAskAgain: false, supported: false };
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    grantedInThisPage = permission.state === 'granted';
    deniedInThisPage = permission.state === 'denied';
    return { granted: grantedInThisPage, canAskAgain: permission.state !== 'denied', supported: true };
  } catch {
    // Safari pode oferecer GPS sem permitir consultar a permissão.
    return { granted: grantedInThisPage, canAskAgain: !deniedInThisPage, supported: true };
  }
}

export async function requestWebLocationPermission(): Promise<void> {
  if (!webLocationAvailable()) throw new Error('Abra o ZippyGo por HTTPS e permita a localização no navegador.');
  await new Promise<void>((resolve, reject) => navigator.geolocation.getCurrentPosition(
    () => { grantedInThisPage = true; deniedInThisPage = false; resolve(); },
    error => {
      if (error.code === 1) { grantedInThisPage = false; deniedInThisPage = true; }
      reject(new WebLocationPermissionError(error.code === 1 ? 'denied' : 'unavailable', error.code === 1 ? 'Permita a localização nas configurações do navegador.' : 'Não foi possível obter sua posição. Confira o GPS e tente novamente.'));
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  ));
}
