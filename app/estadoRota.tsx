import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, MessageCircle, Package, RefreshCw, Route } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Header, Surface, type } from '../src/ui/Kit';
import { RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

const states = {
  cancelled: { title: 'Este pedido foi cancelado.', copy: 'A loja retirou o pedido da sua rota. Se já estiver com o volume, combine a devolução com o estabelecimento.', icon: Package, detail: 'Se coletado: combine a devolução. Se não coletado: confira a fila atual.' },
  changed: { title: 'Seu caminho ganhou uma atualização.', copy: 'A sequência da rota mudou. Confira os pedidos e os destinos antes de continuar.', icon: Route, detail: 'A fila do estabelecimento define a sequência vigente.' },
  conflict: { title: 'A sequência mudou na loja.', copy: 'Outra alteração chegou enquanto você organizava a rota. Carregue a versão atual e confira a ordem.', icon: RefreshCw, detail: 'Sua edição anterior não substitui a sequência do servidor.' },
  'offer-expired': { title: 'Essa oferta já foi encerrada.', copy: 'O prazo terminou ou a loja retirou a oferta. Confira o radar para receber um novo caminho.', icon: Clock, detail: 'Seu turno continua ativo enquanto a sessão estiver online.' },
};
export default function RouteStateScreen() {
  const params = useLocalSearchParams<{ tipo?: string; pedidoId?: string }>(), router = useRouter(), turn = useOperationalSession(), { colors } = useZippyTheme();
  const key = params.tipo && params.tipo in states ? params.tipo as keyof typeof states : 'changed', state = states[key], Icon = state.icon;
  const refresh = async () => { if (await turn.store.refreshQueue()) router.replace(key === 'offer-expired' ? '/' : '/rota'); };
  return <RouteScreen><Header title="Seu caminho, atualizado." subtitle={params.pedidoId ? `Pedido #${params.pedidoId}` : 'Conferir rota'} onBack={() => router.back()} /><View style={{ width: 82, height: 82, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: key === 'cancelled' ? colors.dangerSoft : colors.warningSoft, marginVertical: 24 }}><Icon size={34} color={key === 'cancelled' ? colors.danger : colors.warning} /></View><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 31, lineHeight: 35, letterSpacing: -1.2, color: colors.ink }}>{state.title}</Text><Text style={[type.body, { color: colors.muted, marginVertical: 19 }]}>{state.copy}</Text><Surface><Text style={[type.small, { color: colors.muted }]}>{state.detail}</Text></Surface><View style={{ gap: 10, marginTop: 24 }}><Button icon={RefreshCw} onPress={() => void refresh()}>{key === 'offer-expired' ? 'Voltar ao radar' : 'Carregar rota atual'}</Button><Button secondary icon={MessageCircle} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store', pedidoId: params.pedidoId || '' } })}>Falar com a loja</Button></View></RouteScreen>;
}
