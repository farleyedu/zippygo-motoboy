import { useEffect, useState } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { subscribeConferenceEvents } from '../../services/conferenceEvents';
import { getConferences, workWindow, type WorkPeriod } from '../../services/workApi';
import type { StoreConferences } from '../delivery/storeConference';
import { useAuth } from '../contexts/AuthContext';
import { peekResource, putResource } from './resourceCache';

/**
 * 6C6: conferência da loja para o histórico e o recibo. Relê ao abrir a tela e a cada aviso em tempo real (ou reconexão). Falha não
 * apaga o que já foi lido nem inventa conferência: sem resposta do servidor o selo simplesmente não aparece.
 */
export function useConferences(period: WorkPeriod): StoreConferences | undefined {
  const auth = useAuth(), focused = useIsFocused();
  const selected = auth.estabelecimentoAtual;
  const store = selected ? ('id' in selected ? selected.id : selected.estabelecimentoId) : '';
  const key = `conf:${auth.user?.id}:${store}:${JSON.stringify(period)}`;
  const [state, setState] = useState<{ key: string; data?: StoreConferences }>({ key: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeConferenceEvents(() => setRevision(v => v + 1)), []);
  useEffect(() => {
    if (!focused || !store) return;
    const controller = new AbortController();
    getConferences(store, workWindow(period).from, controller.signal)
      .then(data => { if (!controller.signal.aborted) { putResource(key, data); setState({ key, data }); } })
      .catch(() => { /* Sem leitura nova, fica a última confirmada pelo servidor. */ });
    return () => controller.abort();
  }, [key, store, period, revision, focused]);
  return state.key === key ? state.data : peekResource<StoreConferences>(key);
}
