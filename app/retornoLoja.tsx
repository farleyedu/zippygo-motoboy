import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Check, MapPin, MessageCircle, Navigation, Store } from 'lucide-react-native';
import { arrivedAtStore } from '../services/mobileApi';
import { getStoreDestination, StoreDestination } from '../services/routeApi';
import { openPreferredNavigation } from '../services/navigation';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useAuth } from '../src/contexts/AuthContext';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Surface, type } from '../src/ui/Kit';
import { MiniRouteMap, RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

export default function ReturnScreen() {
  const router = useRouter(), turn = useOperationalSession(), auth = useAuth(), action = useRouteAction(), { colors } = useZippyTheme();
  const [store, setStore] = useState<StoreDestination | null>(null), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  useFocusEffect(useCallback(() => { const c = new AbortController(); setError(''); getStoreDestination(c.signal).then(v => { if (!c.signal.aborted) setStore(v); }).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Confira o destino com a loja.'); }); return () => c.abort(); }, [turn.session?.sessionId]));
  const navigate = async () => { if (!store) return; try { await openPreferredNavigation({ latitude: store.latitude == null ? null : Number(store.latitude), longitude: store.longitude == null ? null : Number(store.longitude), address: [store.rua, store.numero, store.cidade, store.uf].filter(Boolean).join(', ') }); } catch (e) { setError(e instanceof Error ? e.message : 'Confira o endereço com a loja.'); } };
  return <RouteScreen footer={<Button icon={Check} disabled={turn.queue?.routeState !== 'returning' || action.busy} loading={action.busy} onPress={() => confirm ? void action.run(arrivedAtStore, () => router.replace('/')) : setConfirm(true)}>{confirm ? 'Confirmo que cheguei à loja' : 'Cheguei ao estabelecimento'}</Button>}>
    <Header title="Seu caminho volta pra equipe." subtitle="Retorno ao estabelecimento" onBack={() => router.back()} />
    <Surface hero><Store size={32} color={colors.heroMuted} /><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 29, lineHeight: 33, letterSpacing: -1, color: colors.heroInk, marginTop: 16 }}>{'De volta\nà sua equipe.'}</Text><Text style={[type.small, { color: colors.heroMuted, marginTop: 12 }]}>{auth.estabelecimentoAtual?.nome}</Text></Surface><View style={{ height: 15 }} /><MiniRouteMap queue={turn.queue} caption="A loja acompanha seu retorno." />
    <AccountNotice icon={MapPin}>{turn.queue?.routeState === 'returning' ? 'Seu retorno faz parte da operação. Confirme a chegada somente quando estiver no estabelecimento.' : 'O retorno foi encerrado. Confira o início para a próxima rota.'}</AccountNotice>
    <View style={{ gap: 10 }}><Button secondary icon={Navigation} disabled={!store} onPress={() => void navigate()}>Navegar até a loja</Button><Button secondary icon={MessageCircle} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store' } })}>Falar com o estabelecimento</Button></View>
    {(error || action.error) && <Feedback title="Confira seu retorno" message={error || action.error} />}
  </RouteScreen>;
}
