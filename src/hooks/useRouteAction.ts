import { useEffect, useRef, useState } from 'react';
import { MobileApiError, MotoboyQueue } from '../../services/mobileApi';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';

export function useRouteAction() {
  const turn = useOperationalSession(), running = useRef(false), alive = useRef(true);
  const completion = useDeliveryCompletion();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [code, setCode] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (action: () => Promise<MotoboyQueue>, onSuccess?: (queue: MotoboyQueue) => void) => {
    if (running.current) return;
    if (completion.loading || ['pending','sending'].includes(completion.draft?.phase || '')) { setError('Consulte a conclusão pendente antes de alterar a rota.'); return; }
    const current = turn.store.getSnapshot(), session = current.session;
    if (!session || !['online', 'reconnecting'].includes(current.phase)) { setError('Recupere seu turno antes de continuar.'); return; }
    running.current = true; setBusy(true); setError(''); setCode('');
    try {
      const queue = await action(), now = turn.store.getSnapshot();
      if (now.session?.sessionId !== session.sessionId || now.session.epoch !== session.epoch) throw new Error('Seu turno mudou. Confira sua sessão.');
      turn.store.updateQueue(queue, session.sessionId);
      if (alive.current) onSuccess?.(queue);
    } catch (failure) {
      if (alive.current) { setError(failure instanceof Error ? failure.message : 'A operação não foi confirmada. Tente novamente.'); setCode(failure instanceof MobileApiError ? failure.code || '' : ''); }
    } finally { running.current = false; if (alive.current) setBusy(false); }
  };
  return { busy, error, code, run, clear: () => { setError(''); setCode(''); } };
}
