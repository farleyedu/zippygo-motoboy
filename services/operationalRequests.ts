import type { OperationalHeartbeatResponse } from './mobileApi';

// Compartilhado pelos consumidores do turno no mesmo runtime. Apenas leituras
// e renovação de presença entram aqui; ações de pedido não são repetidas.
export function createOperationalRequestCoordinator(now: () => number = Date.now) {
  const pending = new Map<string, Promise<unknown>>();
  let generation = 0;
  let recent: { token: string; startedAt: number; response: OperationalHeartbeatResponse } | null = null;
  function share<T>(key: string, request: () => Promise<T>): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;
    const result = Promise.resolve().then(request);
    pending.set(key, result);
    const release = () => { if (pending.get(key) === result) pending.delete(key); };
    void result.then(release, release);
    return result;
  }
  return {
    queue: <T>(token: string, request: () => Promise<T>) => share(`queue:${token}`, request),
    heartbeat(token: string, request: (startedAt: number) => Promise<OperationalHeartbeatResponse>, force = false): Promise<OperationalHeartbeatResponse> {
      if (!force && recent && (recent.token === token || recent.response.accessToken === token)) {
        const interval = Math.max(5, Math.min(recent.response.session.heartbeatIntervalSeconds || 25, 60)) * 1000;
        const age = now() - recent.startedAt;
        if (age >= 0 && age < interval && !recent.response.session.isEnded) return Promise.resolve(recent.response);
      }
      return share(`heartbeat:${token}`, async () => {
        const ownGeneration = ++generation, startedAt = now();
        const response = await request(startedAt);
        if (ownGeneration === generation && !response.session.isEnded) recent = { token, startedAt, response };
        return response;
      });
    },
  };
}

export const operationalRequests = createOperationalRequestCoordinator();
