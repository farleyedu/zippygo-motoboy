import { useCallback, useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { getWork, type Work, type WorkPeriod } from '../../services/workApi';
import { useAuth } from '../contexts/AuthContext';

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
    setState({ key, loading: !!store });
    if (!store) { setState({ key, loading: false, error: 'Escolha um estabelecimento para consultar seu trabalho.' }); return; }
    getWork(store, period, controller.signal).then(data => { if (!controller.signal.aborted) setState({ key, data, loading: false }); }).catch(e => { if (!controller.signal.aborted) setState({ key, error: e instanceof Error ? e.message : 'Não foi possível conectar. Tente novamente.', loading: false }); });
    return () => controller.abort();
  }, [key, store, period, revision, focused]);
  const current = state.key === key ? state : undefined;
  return { data: current?.data, error: current?.error, loading: current?.loading ?? true, store, refresh };
}
