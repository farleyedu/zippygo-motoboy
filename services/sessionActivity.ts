import type { OperationalActivityAck } from './mobileApi';

const MIN_INTERVAL_MS = 120000;
// Falha sem resposta (rede, timeout, 5xx): tenta de novo no próximo toque após este intervalo, sem esperar a janela inteira.
const RETRY_AFTER_FAILURE_MS = 30000;
const UNAVAILABLE_STATUS = [404, 405, 501];

/**
 * Informa ao servidor que houve uso humano do app. Não há timer: só um toque/tecla real dispara o envio,
 * no máximo uma vez por janela, e apenas com turno aberto, app visível e rede disponível.
 * Heartbeat e GPS não passam por aqui, então não renovam as 7 horas.
 * Só o prazo devolvido pelo servidor é aplicado; sem resposta o prazo exibido não muda.
 * Resposta 404/405/501 (servidor sem o contrato) desliga o envio até o app reabrir.
 * Sessão encerrada (401) é tratada pelo turno; aqui só não se aplica nada.
 */
export function createActivityReporter(ports: {
  canReport: () => boolean;
  /** Turno ao qual o toque pertence; a resposta só vale para ele. */
  sessionId: () => string | null;
  send: () => Promise<OperationalActivityAck | null>;
  onAck: (ack: OperationalActivityAck, sessionId: string) => void;
  now?: () => number;
  minIntervalMs?: number;
}) {
  const now = ports.now ?? Date.now, interval = ports.minIntervalMs ?? MIN_INTERVAL_MS;
  let last = -Infinity, flight = false, unavailable = false;
  return {
    note(): void {
      if (unavailable || flight || now() - last < interval || !ports.canReport()) return;
      const sessionId = ports.sessionId();
      if (!sessionId) return;
      flight = true; last = now();
      void ports.send().then(ack => { if (ack) ports.onAck(ack, sessionId); })
        .catch((error: { status?: number }) => {
          const status = error?.status;
          if (status !== undefined && UNAVAILABLE_STATUS.includes(status)) unavailable = true;
          else if (status === undefined || status >= 500) last = now() - interval + Math.min(RETRY_AFTER_FAILURE_MS, interval);
        })
        .finally(() => { flight = false; });
    },
    reset(): void { last = -Infinity; },
  };
}
