import type { OperationalSession } from './mobileApi';

const MIN_INTERVAL_MS = 120000;
const UNAVAILABLE_STATUS = [404, 405, 501];

/**
 * Informa ao servidor que houve uso humano do app. Não há timer: só um toque/tecla real dispara o envio,
 * no máximo uma vez por janela, e apenas com turno aberto, app visível e rede disponível.
 * Resposta 404/405/501 (servidor sem o contrato) desliga o envio até o app reabrir.
 */
export function createActivityReporter(ports: {
  canReport: () => boolean;
  send: () => Promise<OperationalSession | null>;
  onSession: (session: OperationalSession) => void;
  now?: () => number;
  minIntervalMs?: number;
}) {
  const now = ports.now ?? Date.now, interval = ports.minIntervalMs ?? MIN_INTERVAL_MS;
  let last = -Infinity, flight = false, unavailable = false;
  return {
    note(): void {
      if (unavailable || flight || now() - last < interval || !ports.canReport()) return;
      flight = true; last = now();
      void ports.send().then(session => { if (session) ports.onSession(session); })
        .catch((error: { status?: number }) => { if (error?.status !== undefined && UNAVAILABLE_STATUS.includes(error.status)) unavailable = true; })
        .finally(() => { flight = false; });
    },
    reset(): void { last = -Infinity; },
  };
}
