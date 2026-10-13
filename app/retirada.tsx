import React, { useEffect, useRef, useState } from 'react';
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
import { pickUpCurrent, resumeQueue } from '../services/mobileApi';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { checklistItems } from '../src/delivery/checklistRules';
import { ExtrasConfirmation } from '../src/ui/ExtrasConfirmation';
import { operationalStage } from '../src/delivery/operationalDestination';

export default function PickupScreen() {
  const turn = useOperationalSession(), router = useRouter(), { colors } = useZippyTheme();
  const stops = activeStops(turn.queue), data = useChecklistOrders(stops.map(s => s.pedidoId)), checks = useOrderChecklists(data.orders, 'pickup');
  const ready = operationalStage(turn.queue) === 'pickup' && !data.loading && !data.error && data.orders.length === stops.length && checks.primaryReady;
  const action = useRouteAction(), [showExtras, setShowExtras] = useState(false), [confirming, setConfirming] = useState(false), pending = useRef(false);
  const hasExtras = data.orders.some(order => checklistItems(order.checklist).some(item => item.extra));
  const activation = useRef('');
  useEffect(() => { const queue = turn.queue; if (!turn.session || !['online', 'reconnecting'].includes(turn.phase) || !queue || queue.current || !queue.next.length || action.busy || action.error) return; const key = `${turn.session.sessionId}:${queue.version}`; if (activation.current === key) return; activation.current = key; void action.run(resumeQueue); }, [turn.queue?.version, turn.session?.sessionId, turn.phase, action.error]);
  const confirm = async () => {
    if (!ready || pending.current) return;
    pending.current = true; setConfirming(true);
    try {
      const confirmations = hasExtras ? await checks.confirmExtras() : checks.confirmations;
      if (!confirmations) return;
      const queue = turn.store.getSnapshot().queue;
      if (!queue?.current || operationalStage(queue) !== 'pickup') return;
      await action.run(() => pickUpCurrent({ expectedPedidoId: queue.current!.pedidoId, expectedVersion: queue.version, pedidoIds: data.orders.map(order => order.id), checklists: confirmations }),
        () => { setShowExtras(false); router.replace({ pathname: '/mapa', params: { navegar: 'escolher' } }); });
    } finally { pending.current = false; setConfirming(false); }
  };
  return <><RouteScreen footer={<View style={{ gap: 8 }}>
    <Button icon={ShieldCheck} loading={confirming || action.busy} disabled={!ready || !turn.queue?.current} onPress={() => hasExtras ? setShowExtras(true) : void confirm()}>Estou saindo do estabelecimento</Button>
    <Text style={[type.small, { fontSize: 10, textAlign: 'center', color: colors.muted, minHeight: 32 }]}>{ready ? hasExtras ? 'Confira o resumo dos itens destacados antes de sair.' : 'Itens conferidos. Pode confirmar a saída.' : 'Confira a sacola e os destaques de cada pedido.'}</Text>
  </View>}>
    <Header title="Tudo certo na sua bag?" subtitle="Confira um pedido de cada vez" onBack={() => router.back()} />
    <StoreCover count={stops.length} /><SectionTitle>Confira antes de sair</SectionTitle>
    <AccountNotice icon={ShieldCheck}>O número identifica a sacola. Confira os produtos, adicionais e quantidades de cada pedido.</AccountNotice>
    {data.loading && <Feedback title="Buscando os itens da retirada" loading />}
    {!!data.error && <Feedback title="A retirada precisa de atenção" message={data.error} onRetry={data.reload} />}
    {data.orders.map((order, i) => <OrderChecklistCard key={order.id} order={order} confirmation={checks.confirmations[i]} disabled={checks.loading || confirming || action.busy} onToggle={key => void checks.toggle(order, key)} onToggleBag={() => void checks.toggleBag(order)} />)}
    {!!checks.error && <Feedback title="Confira a marcação" message={checks.error} />}
    {!!action.error && <Feedback title="A retirada não foi confirmada" message={action.error} />}
    {!!action.error && <Button secondary disabled={confirming || action.busy} onPress={() => { activation.current = ''; setShowExtras(false); action.clear(); data.reload(); void turn.store.refreshQueue(); }}>Atualizar itens e conferir novamente</Button>}
    {!data.loading && !stops.length && <Feedback title="Nenhum pedido para retirar" />}
    {stops.filter(s => s.pedido?.tipoPagamento?.toLowerCase().includes('dinheiro') && s.pedido.statusPagamento?.toLowerCase() !== 'pago').map(s => <AccountNotice key={s.pedidoId} icon={Wallet} warning>{'#' + s.pedidoId + ' · Dinheiro previsto.' + (s.pedido?.troco != null && s.pedido.value != null ? ' Troco: ' + money(Math.max(0, s.pedido.troco - s.pedido.value)) + '.' : ' Confira o troco com a loja.')}</AccountNotice>)}
    <Button secondary icon={MessageCircle} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store' } })}>Falar com o estabelecimento</Button>
  </RouteScreen><ExtrasConfirmation visible={showExtras} orders={data.orders} stage="pickup" busy={confirming || action.busy} error={checks.error || action.error} onCancel={() => setShowExtras(false)} onConfirm={() => void confirm()} /></>;
}
