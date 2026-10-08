import { HubConnectionBuilder, HttpTransportType, LogLevel } from '@microsoft/signalr';
import { API_CONFIG } from '../config/apiConfig';
import { logApiFailure } from './apiErrors';
import { createOperationalQueueSync, QueueSyncScope } from './operationalQueueSync';
import { emitChatEvent, ChatEvent } from './chatEvents';

type Ports = {
  onRouteEvent?: (event: { action?: string; pedidoId?: number; version: number }) => void;
  token: () => Promise<string>;
  refresh: () => Promise<boolean>;
  version: () => number;
  scope: () => QueueSyncScope | null;
};
export function startOperationalRealtime(ports: Ports): () => void {
  const sync = createOperationalQueueSync(ports);
  let stopped = false, retries = 0, retry: ReturnType<typeof setTimeout> | undefined;
  const connection = new HubConnectionBuilder()
    .withUrl(`${API_CONFIG.BASE_URL.replace(/\/api\/?$/, '')}/hubs/delivery`, {
      accessTokenFactory: ports.token,
      // Evita long polling e a negociação HTTP; se WS falhar, o radar REST
      // permanece ativo. O hub já inscreve o token no grupo da sua sessão.
      transport: HttpTransportType.WebSockets, skipNegotiation: true,
    })
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .configureLogging(LogLevel.None)
    .build();
  for (const name of ['delivery.queue.updated', 'delivery.route.returning', 'delivery.route.returned']) connection.on(name, payload => {
    sync.event(payload);
    const current = ports.scope();
    if (current && payload?.estabelecimentoId?.toLowerCase() === current.establishmentId.toLowerCase() && payload.motoboyId === current.motoboyId && Number.isFinite(payload.version) && payload.version > ports.version()) ports.onRouteEvent?.(payload);
  });
  connection.onreconnecting(() => sync.connection(false));
  connection.on('delivery.chat.updated', (payload: ChatEvent) => {
    const scope = ports.scope();
    if (scope && payload?.estabelecimentoId?.toLowerCase() === scope.establishmentId.toLowerCase()) emitChatEvent(payload);
  });
  connection.onreconnected(() => { retries = 0; sync.connection(true); });
  function retryStart() {
    if (stopped || retry !== undefined) return;
    const delay = Math.min(60000, 5000 * 2 ** Math.min(retries++, 4)) * (.8 + Math.random() * .4);
    retry = setTimeout(() => { retry = undefined; void start(); }, delay);
  }
  async function start() {
    try {
      await connection.start();
      if (stopped) { await connection.stop(); return; }
      retries = 0; sync.connection(true);
    } catch {
      if (stopped) return;
      // O erro do SDK pode incluir access_token na URL; só metadados próprios.
      logApiFailure({ code: 'ERR_NETWORK', message: 'Canal em tempo real indisponível. A fila continua pelas consultas de recuperação.', config: { method: 'CONNECT', url: '/hubs/delivery' } });
      retryStart();
    }
  }
  connection.onclose(() => { sync.connection(false); retryStart(); });
  void start();
  return () => {
    stopped = true; sync.stop();
    if (retry !== undefined) clearTimeout(retry);
    void connection.stop().catch(() => undefined);
  };
}
