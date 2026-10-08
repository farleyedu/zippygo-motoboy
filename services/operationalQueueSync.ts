export type QueueSyncScope = { establishmentId: string; motoboyId: number };
type Timer = ReturnType<typeof setTimeout>;
type QueueSyncPorts = {
  refresh: () => Promise<boolean>;
  version: () => number;
  scope: () => QueueSyncScope | null;
  setTimer?: (callback: () => void, delay: number) => Timer;
  clearTimer?: (timer: Timer) => void;
};

// Uma leitura por vez. Eventos são avisos; o snapshot REST continua sendo a
// fonte dos pedidos. Reconectar também reconcilia o intervalo sem eventos.
export function createOperationalQueueSync(ports: QueueSyncPorts) {
  const setTimer = ports.setTimer ?? setTimeout, clearTimer = ports.clearTimer ?? clearTimeout;
  let connected = false, stopped = false, running = false, dirty = false;
  let failures = 0, requestedVersion = -1;
  let timer: Timer | undefined, eventTimer: Timer | undefined;
  function schedule() {
    if (timer !== undefined) clearTimer(timer);
    if (stopped) return;
    const delay = connected && failures === 0 ? 60000 : Math.min(60000, 15000 * 2 ** Math.min(failures, 2));
    timer = setTimer(() => { timer = undefined; dirty = true; void pump(); }, delay);
  }
  async function pump() {
    if (stopped || running || !dirty) return;
    running = true; dirty = false;
    try {
      const ok = await ports.refresh();
      if (stopped) return;
      failures = ok ? 0 : failures + 1;
      // Se a leitura já incorporou a rajada, não consultar novamente.
      if (dirty && requestedVersion <= ports.version()) dirty = false;
    } catch { failures += 1; }
    finally {
      running = false;
      if (!stopped) { schedule(); if (dirty && failures === 0) request(); }
    }
  }
  function request() {
    if (stopped) return;
    dirty = true;
    if (eventTimer === undefined && !running) eventTimer = setTimer(() => { eventTimer = undefined; void pump(); }, 180);
  }
  schedule();
  return {
    connection(isConnected: boolean) {
      if (stopped || connected === isConnected) return;
      connected = isConnected; failures = 0; schedule();
      if (connected) request();
    },
    event(payload: unknown) {
      if (stopped || !payload || typeof payload !== 'object') return;
      const event = payload as { estabelecimentoId?: string; motoboyId?: number; version?: number };
      const scope = ports.scope();
      if (!scope || event.estabelecimentoId?.toLowerCase() !== scope.establishmentId.toLowerCase() || event.motoboyId !== scope.motoboyId) return;
      if (typeof event.version !== 'number' || !Number.isFinite(event.version) || event.version <= Math.max(ports.version(), requestedVersion)) return;
      requestedVersion = event.version;
      request();
    },
    stop() {
      stopped = true;
      if (timer !== undefined) clearTimer(timer);
      if (eventTimer !== undefined) clearTimer(eventTimer);
    },
  };
}
