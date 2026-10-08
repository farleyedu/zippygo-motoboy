import React from 'react';
import { useRouter } from 'expo-router';
import { HelpCircle, LocateFixed, MessageCircle, ShieldCheck } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { AccountNotice, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Header, Surface } from '../src/ui/Kit';

export default function HelpScreen() {
  const router = useRouter(), turn = useOperationalSession();
  return <AccountScreen><Header title="Seu apoio no caminho." subtitle="Ajuda operacional" onBack={() => router.back()} /><Surface style={{ paddingVertical: 0 }}><MenuRow icon={MessageCircle} title="Falar com o estabelecimento" subtitle={turn.session ? 'Atendimento do seu turno' : 'Inicie o turno para acessar o atendimento'} disabled={!turn.session} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store' } })} /><MenuRow icon={LocateFixed} title="Localização e permissões" subtitle="Revisar o acesso no aparelho" onPress={() => router.push('/permissoes')} /><MenuRow icon={HelpCircle} title="Problema com uma entrega" subtitle="Conferir orientação e registrar ocorrência" disabled={!turn.queue?.current} onPress={() => router.push('/ocorrencia')} last /></Surface><AccountNotice icon={ShieldCheck}>Pare em local seguro para conversar ou resolver uma ocorrência. Em uma emergência, use os serviços locais de emergência do aparelho.</AccountNotice></AccountScreen>;
}
