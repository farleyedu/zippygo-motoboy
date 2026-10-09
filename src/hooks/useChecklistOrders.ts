import { useCallback, useEffect, useState } from 'react';
import { getOperationalOrder, type OperationalOrderDetail } from '../../services/mobileApi';
export function useChecklistOrders(ids: number[]) {
  const identity = ids.join(',');
  const [orders, setOrders] = useState<OperationalOrderDetail[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(''); setOrders([]);
    void (async () => {
      try {
        const requested = identity.split(',').filter(Boolean).map(Number), result: OperationalOrderDetail[] = [];
        for (let start = 0; start < requested.length; start += 3) {
          result.push(...await Promise.all(requested.slice(start, start + 3).map(id => getOperationalOrder(id, abort.signal))));
          if (abort.signal.aborted) return;
        }
        if (result.some(order => !order.checklist)) throw new Error('A conferência de itens ainda não está disponível na API. Atualize o backend antes de continuar.');
        if (!abort.signal.aborted) setOrders(result);
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível conferir os itens.'); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, [identity, revision]);
  return { orders, loading, error, reload: useCallback(() => setRevision(r => r + 1), []) };
}
