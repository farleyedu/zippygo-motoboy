import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
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
import { Pedido, BuscarPedidosParams, ApiState } from '../types/pedido';

export const useFetchPedidos = (_params?: BuscarPedidosParams) => {
  const turn = useOperationalSession();
  const queue = turn.queue;
  const actionRunning = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const sessionId = turn.store.getSnapshot().session?.sessionId;
    if (!sessionId) {
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await getOperationalQueue();
      turn.store.updateQueue(next, sessionId);
    } catch (caught: any) {
      setError(caught?.message ?? 'Erro ao carregar a fila do motoboy.');
    } finally {
      setLoading(false);
    }
  }, [turn.store]);

  useEffect(() => {
    // O início/restauração já carrega a fila. Montar uma tela não cria outro
    // radar nem repete a leitura que o provider acabou de confirmar.
    if (turn.session && !turn.store.getSnapshot().queue && !turn.busy) void fetchData();
  }, [fetchData, turn.session?.sessionId]);

  const applyAction = useCallback(async (action: () => Promise<MotoboyQueue>) => {
    const snapshot = turn.store.getSnapshot();
    if (!snapshot.session || !['online', 'reconnecting'].includes(snapshot.phase)) throw new Error('Recupere seu turno antes de continuar.');
    if (actionRunning.current) throw new Error('Aguarde a atualização do pedido.');
    actionRunning.current = true;
    const sessionId = snapshot.session.sessionId;
    setLoading(true);
    setError(null);
    try {
      const next = await action();
      if (turn.store.getSnapshot().session?.sessionId !== sessionId) throw new Error('O turno mudou durante a atualização. Confira sua fila.');
      turn.store.updateQueue(next, sessionId);
      return next;
    } catch (caught: any) {
      setError(caught?.message ?? 'Não foi possível atualizar a fila.');
      throw caught;
    } finally {
      setLoading(false);
      actionRunning.current = false;
    }
  }, [turn.store]);

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
    loading: loading || turn.busy,
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
