import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, Route, ShieldCheck, Wallet } from 'lucide-react-native';
import { pickUpCurrent } from '../services/mobileApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, money, SectionTitle, Surface, type } from '../src/ui/Kit';
import { activeStops, RouteScreen, StopRow, StoreCover } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

export default function PickupScreen() {
  const turn = useOperationalSession(), router = useRouter(), action = useRouteAction(), { colors } = useZippyTheme();
  const stops = activeStops(turn.queue), [checked, setChecked] = useState<number[]>([]), version = useRef(-1), [changed, setChanged] = useState(false);
  useEffect(() => { if (!turn.queue || turn.queue.version === version.current) return; setChanged(version.current !== -1); version.current = turn.queue.version; setChecked(activeStops(turn.queue).filter(s => s.pickedUpAtUtc).map(s => s.pedidoId)); }, [turn.queue]);
  const ready = !!stops.length && stops.every(s => checked.includes(s.pedidoId));
  const confirm = () => { const snapshot = turn.store.getSnapshot().queue; if (!snapshot?.current || snapshot.version !== version.current || !ready) return; void action.run(() => pickUpCurrent({ expectedPedidoId: snapshot.current!.pedidoId, expectedVersion: snapshot.version, pedidoIds: stops.map(s => s.pedidoId) }), () => router.replace({ pathname: '/mapa', params: { modo: 'rota' } })); };
  return <RouteScreen footer={<View style={{ gap: 8 }}><Button icon={Route} disabled={!ready || action.busy} loading={action.busy} onPress={confirm}>Retirei · iniciar meu caminho</Button><Text style={{ fontFamily: 'Manrope', fontSize: 10, textAlign: 'center', color: colors.muted }}>Confira todos os pedidos para iniciar a rota.</Text></View>}>
    <Header title="Tudo certo na sua bag?" subtitle="Retirada no estabelecimento" onBack={() => router.back()} /><StoreCover count={stops.length} /><SectionTitle>Confira antes de sair</SectionTitle>
    {changed && <AccountNotice warning icon={ShieldCheck}>A fila mudou. Confira novamente os pedidos que ainda não foram coletados.</AccountNotice>}
    <Surface style={{ paddingVertical: 0 }}>{stops.map((s, i) => <StopRow key={s.pedidoId} stop={s} index={i} checked={checked.includes(s.pedidoId)} onCheck={() => { if (!action.busy && !s.pickedUpAtUtc) setChecked(previous => previous.includes(s.pedidoId) ? previous.filter(id => id !== s.pedidoId) : [...previous, s.pedidoId]); }} />)}{!stops.length && <Text style={[type.body, { color: colors.muted, paddingVertical: 20 }]}>Não há pedidos para retirar.</Text>}</Surface>
    {stops.filter(s => s.pedido?.tipoPagamento?.toLowerCase().includes('dinheiro') && s.pedido.statusPagamento?.toLowerCase() !== 'pago').map(s => <AccountNotice key={s.pedidoId} icon={Wallet} warning>{`#${s.pedidoId} · Dinheiro previsto.${s.pedido?.troco != null && s.pedido.value != null ? ` Troco: ${money(Math.max(0, s.pedido.troco - s.pedido.value))}.` : ' Confira o troco com a loja.'}`}</AccountNotice>)}
    <View style={{ height: 14 }} /><Button secondary icon={MessageCircle} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store' } })}>Falar com o estabelecimento</Button>
    {action.error && <Feedback title="A retirada não foi confirmada" message={action.error} onRetry={() => void turn.store.refreshQueue()} />}
  </RouteScreen>;
}
