type Failure = { code?: string; message?: string; response?: { status?: number }; config?: { method?: string; url?: string; timeout?: number; _startedAt?: number } };
export function isTransientApiError(error: unknown): boolean {
  const failure = error as Failure;
  if ([408, 429, 502, 503, 504].includes(failure?.response?.status || 0)) return true;
  return !failure?.response?.status && (['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(failure?.code || '') || /^(Network Error|Network request failed|Failed to fetch)$/i.test(failure?.message || ''));
}
export function apiErrorDetails(error: unknown) {
  const failure = error as Failure;
  // Whitelist: nunca serializar config, headers, corpo, request ou o erro inteiro.
  return { method: failure?.config?.method?.toUpperCase(), url: failure?.config?.url?.split('?')[0], status: failure?.response?.status, code: failure?.code, message: failure?.message,
    timeout: failure?.config?.timeout, elapsedMs: failure?.config?._startedAt == null ? undefined : Date.now() - failure.config._startedAt };
}
const logged = new WeakSet<object>();
const lastNetworkLog = new Map<string, number>();
export function logApiFailure(error: unknown, label = '[API]') {
  if (process.env.EXPO_PUBLIC_APP_ENV === 'prod' || process.env.EXPO_PUBLIC_APP_ENV === 'production') return;
  if (typeof error === 'object' && error !== null) {
    if (logged.has(error)) return;
    logged.add(error);
  }
  if ((error as Failure)?.code === 'ERR_CANCELED') return;
  const details = apiErrorDetails(error);
  if (isTransientApiError(error)) {
    const key = `${details.method}:${details.url}:${details.code}`;
    const previous = lastNetworkLog.get(key);
    if (previous != null && Date.now() - previous < 30000) return;
    if (lastNetworkLog.size >= 64) lastNetworkLog.clear();
    lastNetworkLog.set(key, Date.now());
    console.warn(`${label} Sincronização aguarda conexão:`, details);
  } else console.error(`${label} Falha na API:`, details);
}
