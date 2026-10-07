import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPedidoById } from '../services/apiService';
import {
  acceptOffer as acceptOfferApi,
  arriveCurrent as arriveCurrentApi,
  arrivedAtStore as arrivedAtStoreApi,
  deliverCurrent as deliverCurrentApi,
  failCurrent as failCurrentApi,
  getOperationalQueue,
  MotoboyQueue,
  pickUpCurrent as pickUpCurrentApi,
  queueToPedidos,
  rejectOffer as rejectOfferApi,
  reorderQueue as reorderQueueApi,
  resumeQueue as resumeQueueApi,
} from '../services/mobileApi';
import { getSecureItem } from '../utils/secureStorage';
import { Pedido, BuscarPedidosParams, ApiState } from '../types/pedido';

export const useFetchPedidos = (_params?: BuscarPedidosParams) => {
  const [queue, setQueue] = useState<MotoboyQueue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const operationalToken = await getSecureItem('operationalAccessToken');
    if (!operationalToken) {
      setQueue(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setQueue(await getOperationalQueue());
    } catch (caught: any) {
      setError(caught?.message ?? 'Erro ao carregar a fila do motoboy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyAction = useCallback(async (action: () => Promise<MotoboyQueue>) => {
    setLoading(true);
    setError(null);
    try {
      const next = await action();
      setQueue(next);
      return next;
    } catch (caught: any) {
      setError(caught?.message ?? 'Não foi possível atualizar a fila.');
      throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  // Evita criar um novo array em todo render. A tela inicial sincroniza esse
  // valor com um estado local; uma nova referência constante causava um loop
  // de renderização ("Maximum update depth exceeded").
  const pedidos = useMemo(() => queueToPedidos(queue), [queue]);
  return {
    pedidos,
    queue,
    oferta: queue?.offer ?? null,
    pedidoAtual: queue?.current?.pedido ?? null,
    total: pedidos.length,
    loading,
    error,
    refetch: fetchData,
    hasMore: false,
    acceptOffer: () => applyAction(acceptOfferApi),
    rejectOffer: (reason?: string) => applyAction(() => rejectOfferApi(reason)),
    reorderQueue: (ids: number[]) => applyAction(() => reorderQueueApi(queue?.version ?? 0, ids)),
    resumeQueue: () => applyAction(resumeQueueApi),
    arrivedAtStore: () => applyAction(arrivedAtStoreApi),
    pickUpCurrent: () => applyAction(pickUpCurrentApi),
    arriveCurrent: () => applyAction(arriveCurrentApi),
    deliverCurrent: (code?: string) => applyAction(() => deliverCurrentApi(code)),
    failCurrent: (reason: string) => applyAction(() => failCurrentApi(reason)),
  };
};

export const useFetchPedidoById = (id: number | null) => {
  const [state, setState] = useState<ApiState<Pedido>>({ data: null, loading: false, error: null });

  const fetchData = useCallback(async () => {
    if (!id) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await fetchPedidoById(id);
      setState({ data: response, loading: false, error: null });
    } catch (caught: any) {
      setState({ data: null, loading: false, error: caught?.message ?? 'Erro ao carregar pedido.' });
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { pedido: state.data, loading: state.loading, error: state.error, refetch: fetchData };
};

export default useFetchPedidos;
