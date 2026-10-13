import { useCallback, useEffect, useState } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { getWork, type Work, type WorkPeriod } from '../../services/workApi';
import { useAuth } from '../contexts/AuthContext';
import { peekResource, putResource } from './resourceCache';

export function useWork(period: WorkPeriod): { data?: Work; error?: string; loading: boolean; store: string; refresh: () => void } {
  const auth = useAuth(), focused = useIsFocused();
  const selected = auth.estabelecimentoAtual;
  const store = selected ? ('id' in selected ? selected.id : selected.estabelecimentoId) : '';
  const key = `${auth.user?.id}:${store}:${JSON.stringify(period)}`;
  const [state, setState] = useState<{ key: string; data?: Work; error?: string; loading: boolean }>({ key: '', loading: true });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    if (!focused) return;
    const controller = new AbortController();
    const cached = peekResource<Work>('work:' + key);
    setState({ key, data: cached, loading: !!store && !cached });
    if (!store) { setState({ key, loading: false, error: 'Escolha um estabelecimento para consultar seu trabalho.' }); return; }
    getWork(store, period, controller.signal).then(data => { if (!controller.signal.aborted) { putResource('work:' + key, data); setState({ key, data, loading: false }); } }).catch(e => { if (!controller.signal.aborted) setState({ key, error: e instanceof Error ? e.message : 'Não foi possível conectar. Tente novamente.', loading: false }); });
    return () => controller.abort();
  }, [key, store, period, revision, focused]);
  const cached = peekResource<Work>('work:' + key);
  const current = state.key === key ? state : cached ? { key, data: cached, loading: false } : undefined;
  return { data: current?.data, error: current?.error, loading: current?.loading ?? true, store, refresh };
}
