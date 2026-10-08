import React from 'react';
import { FailureAction } from '../src/ui/FailureAction';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, ShieldCheck, Store, UserRound, Wallet, ArrowLeftRight } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { MenuRow } from '../src/ui/AccountKit';
import { Header, Surface, type } from '../src/ui/Kit';
import { RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

export default function IncidentScreen() {
  const router = useRouter(), turn = useOperationalSession(), { colors } = useZippyTheme();
  const id = turn.queue?.current?.pedidoId;
  const chat = () => router.push({ pathname: '/conversas', params: { channel: 'store', pedidoId: String(id || '') } });
  return <RouteScreen><Header title="Qual foi o imprevisto?" subtitle={id ? `Pedido #${id}` : 'Sua rota'} onBack={() => router.back()} /><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 29, lineHeight: 32, letterSpacing: -1.2, color: colors.ink, marginTop: 15 }}>{'Aconteceu algo?\nTem um caminho.'}</Text><Text style={[type.body, { color: colors.muted, marginVertical: 18 }]}>Conte o que aconteceu. A loja acompanha e orienta o próximo passo.</Text><Surface style={{ paddingVertical: 0 }}><MenuRow icon={UserRound} title="Cliente não localizado" subtitle="Contato e espera orientada" disabled={!id} onPress={() => router.push('/clienteAusente')} /><MenuRow icon={MapPin} title="Endereço não confere" subtitle="Enviar detalhes para o atendimento" onPress={chat} /><MenuRow icon={Wallet} title="Problema com pagamento" subtitle="Não recebeu ou há divergência" onPress={chat} /><MenuRow icon={Store} title="Loja fechada ou pedido faltando" subtitle="Informar e registrar evidência" onPress={chat} /><MenuRow icon={ArrowLeftRight} title="Preciso transferir o pedido" subtitle="Acompanhar regra do estabelecimento" disabled={!id} onPress={() => router.push({ pathname: '/transferencia', params: { pedidoId: String(id) } })} /><MenuRow icon={ShieldCheck} title="Situação insegura" subtitle="Seu apoio no caminho" last onPress={() => router.push('/ajudaOperacional')} /></Surface><FailureAction/></RouteScreen>;
}
