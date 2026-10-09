import { useCallback, useEffect, useState } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { useAuth } from '../contexts/AuthContext';
import { routeHistory, routeHistoryDetail, type RouteHistoryPage, type HistoryRouteDetail } from '../../services/routeHistoryApi';
import type { WorkPeriod } from '../../services/workApi';

function useHistoryResource<T>(resource: string, fetcher: (store: string, signal: AbortSignal) => Promise<T>) {
  const auth = useAuth(), focused = useIsFocused(), selected = auth.estabelecimentoAtual;
  const store = selected ? ('id' in selected ? selected.id : selected.estabelecimentoId) : '';
  const key = auth.user?.id + ':' + store + ':' + resource;
  const [revision, setRevision] = useState(0), [state, setState] = useState<{ key: string; data?: T; loading: boolean; error?: string }>({ key: '', loading: true });
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    if (!focused || !auth.user) return;
    const controller = new AbortController(); setState({ key, loading: !!store });
    if (!store) { setState({ key, loading: false, error: 'Escolha a loja para consultar seu histórico.' }); return; }
    void fetcher(store, controller.signal).then(data => { if (!controller.signal.aborted) setState({ key, data, loading: false }); }).catch(e => { if (!controller.signal.aborted) setState({ key, loading: false, error: e instanceof Error ? e.message : 'Não foi possível consultar suas rotas.' }); });
    return () => controller.abort();
  }, [key, revision, focused, !!auth.user]);
  const current = state.key === key ? state : undefined;
  return { data: current?.data, error: current?.error, loading: current?.loading ?? true, refresh };
}
export function useRouteHistory(period: WorkPeriod, offset: number) { return useHistoryResource<RouteHistoryPage>(JSON.stringify({ period, offset }), (store, signal) => routeHistory(store, period, offset, signal)); }
export function useRouteHistoryDetail(id: string) { return useHistoryResource<HistoryRouteDetail>(id, (store, signal) => routeHistoryDetail(store, id, signal)); }
