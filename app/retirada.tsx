import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, ShieldCheck, Wallet } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useChecklistOrders } from '../src/hooks/useChecklistOrders';
import { useOrderChecklists } from '../src/hooks/useOrderChecklists';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, money, SectionTitle, type } from '../src/ui/Kit';
import { OrderChecklistCard } from '../src/ui/OrderChecklistCard';
import { activeStops, RouteScreen, StoreCover } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

export default function PickupScreen() {
  const turn = useOperationalSession(), router = useRouter(), { colors } = useZippyTheme();
  const stops = activeStops(turn.queue), data = useChecklistOrders(stops.map(s => s.pedidoId)), checks = useOrderChecklists(data.orders, 'pickup');
  const ready = !data.loading && !data.error && data.orders.length === stops.length && checks.primaryReady;
  return <RouteScreen footer={<View style={{ gap: 8 }}>
    <Button icon={ShieldCheck} disabled={!ready} onPress={() => router.push({ pathname: '/conferirExtras', params: { stage: 'pickup' } })}>Conferir extras antes de sair</Button>
    <Text style={[type.small, { fontSize: 10, textAlign: 'center', color: colors.muted }]}>{ready ? 'Itens conferidos. Falta a última checagem dos extras.' : 'Marque cada item e confira as quantidades.'}</Text>
  </View>}>
    <Header title="Tudo certo na sua bag?" subtitle="Confira um pedido de cada vez" onBack={() => router.back()} />
    <StoreCover count={stops.length} /><SectionTitle>Confira antes de sair</SectionTitle>
    <AccountNotice icon={ShieldCheck}>O número identifica a sacola. Confira os produtos, adicionais e quantidades de cada pedido.</AccountNotice>
    {data.loading && <Feedback title="Buscando os itens da retirada" loading />}
    {!!data.error && <Feedback title="A retirada precisa de atenção" message={data.error} onRetry={data.reload} />}
    {data.orders.map((order, i) => <OrderChecklistCard key={order.id} order={order} confirmation={checks.confirmations[i]} disabled={checks.loading} onToggle={key => void checks.toggle(order, key)} />)}
    {!!checks.error && <Feedback title="Confira a marcação" message={checks.error} />}
    {!data.loading && !stops.length && <Feedback title="Nenhum pedido para retirar" />}
    {stops.filter(s => s.pedido?.tipoPagamento?.toLowerCase().includes('dinheiro') && s.pedido.statusPagamento?.toLowerCase() !== 'pago').map(s => <AccountNotice key={s.pedidoId} icon={Wallet} warning>{'#' + s.pedidoId + ' · Dinheiro previsto.' + (s.pedido?.troco != null && s.pedido.value != null ? ' Troco: ' + money(Math.max(0, s.pedido.troco - s.pedido.value)) + '.' : ' Confira o troco com a loja.')}</AccountNotice>)}
    <Button secondary icon={MessageCircle} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store' } })}>Falar com o estabelecimento</Button>
  </RouteScreen>;
}
