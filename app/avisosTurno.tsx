import React from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Package, Route } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { AccountNotice, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Header, Surface, type } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

export default function TurnNotices() {
  const turn = useOperationalSession(), router = useRouter(), { colors } = useZippyTheme();
  return <AccountScreen active="home"><Header title="O que mudou no caminho." subtitle="Avisos do turno" onBack={() => router.back()} /><Surface style={{ paddingVertical: 0 }}>{turn.queue?.offer && <MenuRow icon={Package} title="Nova rota recebida" subtitle={`${turn.queue.offer.stops.length} pedidos · confira antes do aceite`} onPress={() => router.push('/oferta')} />}{turn.queue?.current && <MenuRow icon={Route} title={`Sua entrega atual · #${turn.queue.current.pedidoId}`} subtitle={turn.queue.current.pickedUpAtUtc ? 'Retirada confirmada' : 'Conferir retirada no estabelecimento'} onPress={() => router.push('/rota')} last />}{!turn.queue?.offer && !turn.queue?.current && <Text style={[type.body, { color: colors.muted, paddingVertical: 20 }]}>Nenhum aviso ativo na sua fila.</Text>}</Surface><AccountNotice icon={Bell}>Os avisos mostram a operação atual. O histórico de notificações será disponibilizado com a central completa.</AccountNotice></AccountScreen>;
}
