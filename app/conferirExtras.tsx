import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Package, Route, ShieldCheck } from 'lucide-react-native';
import { pickUpCurrent } from '../services/mobileApi';
import { useDeliveryCompletion } from '../src/contexts/DeliveryCompletionContext';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useChecklistOrders } from '../src/hooks/useChecklistOrders';
import { useOrderChecklists } from '../src/hooks/useOrderChecklists';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { checklistItems } from '../src/delivery/checklistRules';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Surface, type } from '../src/ui/Kit';
import { OrderChecklistCard } from '../src/ui/OrderChecklistCard';
import { activeStops, RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

export default function ExtrasScreen() {
  const { stage: requested, id } = useLocalSearchParams<{ stage?: string; id?: string }>(), stage = requested === 'delivery' ? 'delivery' : 'pickup';
  const turn = useOperationalSession(), completion = useDeliveryCompletion(), router = useRouter(), action = useRouteAction(), { colors } = useZippyTheme();
  const ids = stage === 'pickup' ? activeStops(turn.queue).map(s => s.pedidoId) : [Number(id) || turn.queue?.current?.pedidoId || 0].filter(Boolean);
  const data = useChecklistOrders(ids), checks = useOrderChecklists(data.orders, stage);
  const extras = data.orders.flatMap(o => checklistItems(o.checklist).filter(i => i.extra));
  const ready = !data.loading && !data.error && data.orders.length === ids.length && checks.ready;
  const confirm = async () => {
    if (!ready) return;
    if (stage === 'delivery') {
      if (await completion.confirmItems(checks.confirmations[0])) router.back();
      return;
    }
    const queue = turn.store.getSnapshot().queue;
    if (!queue?.current) return;
    void action.run(() => pickUpCurrent({ expectedPedidoId: queue.current!.pedidoId, expectedVersion: queue.version, pedidoIds: ids, checklists: checks.confirmations }),
      () => router.replace({ pathname: '/mapa', params: { modo: 'rota' } }));
  };
  return <RouteScreen footer={<Button icon={stage === 'pickup' ? Route : Check} loading={action.busy || completion.busy} disabled={!ready} onPress={() => void confirm()}>{stage === 'pickup' ? 'Tudo na bag · confirmar retirada' : 'Itens entregues · voltar à conclusão'}</Button>}>
    <Header title={stage === 'pickup' ? 'Os extras foram com você?' : 'Entregou também os extras?'} subtitle={stage === 'pickup' ? 'Última conferência antes de sair' : 'Confira o pedido antes de concluir'} onBack={() => router.back()} />
    <Surface hero style={{ marginBottom: 20 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Package size={32} color={colors.heroInk} /><View style={{ flex: 1 }}><Text style={[type.title, { color: colors.heroInk }]}>{stage === 'pickup' ? 'Cada volume conta.' : 'Nada fica na bag.'}</Text><Text style={[type.small, { color: colors.heroMuted, marginTop: 6 }]}>Bebidas, sobremesas e adicionais: confira as quantidades por pedido.</Text></View></View></Surface>
    {data.loading && <Feedback title="Conferindo os pedidos" loading />}
    {!!data.error && <Feedback title="Confira a retirada" message={data.error} onRetry={data.reload} />}
    {!checks.primaryReady && !data.loading && !data.error && <AccountNotice warning icon={ShieldCheck}>Volte e marque todos os itens antes desta confirmação.</AccountNotice>}
    {data.orders.map((order, i) => <OrderChecklistCard key={order.id} order={order} confirmation={checks.confirmations[i]} extrasOnly disabled={!checks.primaryReady || action.busy || completion.busy} onToggle={key => void checks.toggle(order, key, true)} />)}
    {!extras.length && !data.loading && !data.error && <AccountNotice icon={ShieldCheck}>Este pedido não tem extras destacados. Confira os volumes antes de continuar.</AccountNotice>}
    {!!(checks.error || action.error) && <Feedback title="A conferência não foi confirmada" message={checks.error || action.error} />}
    {!!completion.error && stage === 'delivery' && <Feedback title="A entrega precisa de atenção" message={completion.error} />}
  </RouteScreen>;
}
