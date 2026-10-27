import { useRef, useState } from 'react';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { hasOperationalWork } from '../session/operationalSessionStore';

/**
 * Encerramento voluntário do turno, compartilhado por Turno, Resumo e Sair da conta.
 * - Conclusão ainda não confirmada pelo servidor bloqueia (nada é enviado).
 * - Com pedidos (pela fila local ou pela recusa 409 do servidor) só envia confirmPendingWork=true
 *   quando a pessoa toca no botão explícito; nunca automaticamente.
 * - Erro, timeout ou falta de internet mantêm turno, fila e dados locais.
 * - Um segundo toque durante a solicitação é ignorado.
 */
export function useEndShift(reason: 'client_end' | 'logout') {
  const turn = useOperationalSession(), completion = useDeliveryCompletion();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const flight = useRef(false);
  const hasWork = !!turn.queue && hasOperationalWork(turn.queue) || turn.transferNotice?.status === 'pending_approval';
  const pendingCompletion = ['pending', 'sending'].includes(completion.draft?.phase || '');
  const end = async (confirmPendingWork: boolean): Promise<boolean> => {
    if (flight.current) return false;
    flight.current = true; setBusy(true); setError('');
    try {
      completion.assertRouteMutationAllowed();
      if (await turn.store.end(reason, { confirmPendingWork })) return true;
      const snapshot = turn.store.getSnapshot();
      // A recusa por pedidos já é explicada pelo aviso de confirmação; o resto aparece como erro.
      if (!snapshot.pendingWorkEnd) setError(snapshot.error || 'Seu turno foi mantido. Tente novamente.');
      return false;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Seu turno foi mantido.');
      return false;
    } finally { flight.current = false; setBusy(false); }
  };
  return {
    busy, error, pendingCompletion,
    /** Há pedidos com o motoboy: o encerramento exige a confirmação explícita de repasse à loja. */
    needsWorkConfirmation: hasWork || turn.pendingWorkEnd,
    end,
    cancel: () => { setError(''); turn.store.cancelEnd(); },
  };
}

export const END_WITH_WORK_TITLE = 'Você ainda tem pedidos com você';
export const END_WITH_WORK_MESSAGE = 'Ao confirmar, o turno é encerrado e esses pedidos passam a ficar sob responsabilidade operacional do estabelecimento, que decide o que fazer com cada um. Seus dados só saem deste aparelho depois que o servidor confirmar.';
