import React from 'react';
import { useRouter } from 'expo-router';
import { HelpCircle, LocateFixed, MessageCircle, ShieldCheck, Wallet } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { AccountNotice, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Header, Surface } from '../src/ui/Kit';

export default function HelpScreen() {
  const router = useRouter(), turn = useOperationalSession();
  return <AccountScreen><Header title="Seu apoio no caminho." subtitle="Ajuda operacional" onBack={() => router.back()} /><MenuRow icon={HelpCircle} title="Ajuda e solicitações" onPress={() => router.push('/suporte')} /><MenuRow icon={ShieldCheck} title="Central de segurança" onPress={() => router.push('/seguranca')} /><MenuRow icon={Wallet} title="Ganhos e acerto" onPress={() => router.push('/ganhos')} /><MenuRow icon={LocateFixed} title="Localização e permissões" onPress={() => router.push('/permissoes')} /><MenuRow icon={MessageCircle} title="Falar com a loja" disabled={!turn.session} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store' } })} /></AccountScreen>;
}
