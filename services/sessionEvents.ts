type SessionFailure = { status: number; code?: string; message: string; token?: string };
const listeners = new Set<(failure: SessionFailure) => void>();
let logoutGuard: (() => Promise<void>) | undefined;
const logoutPreconditions = new Set<() => void>();
export function registerLogoutPrecondition(check: () => void) { logoutPreconditions.add(check); return () => { logoutPreconditions.delete(check); }; }

export function subscribeOperationalFailures(listener: (failure: SessionFailure) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function reportOperationalFailure(failure: SessionFailure) {
  listeners.forEach(listener => listener(failure));
}
export function registerOperationalLogoutGuard(guard: () => Promise<void>) {
  logoutGuard = guard;
  return () => { if (logoutGuard === guard) logoutGuard = undefined; };
}
export async function requestOperationalLogout(): Promise<boolean> {
  logoutPreconditions.forEach(check => check());
  if (!logoutGuard) return false;
  await logoutGuard();
  return true;
}
