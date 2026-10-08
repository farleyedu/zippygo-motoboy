import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bike, FileText, Settings, ShieldCheck, Store, UserRound } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useOwnAccount } from '../src/hooks/useOwnAccount';
import { AccountAvatar, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Feedback, Header, IconButton, Pill, Surface } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

export default function ProfileScreen() {
  const router = useRouter(), auth = useAuth(), { colors } = useZippyTheme();
  const { account, loading, error, reload } = useOwnAccount();
  const name = account?.nome || auth.user?.nome || '', location = [account?.cidade, account?.uf].filter(Boolean).join(', ');
  return <AccountScreen>
    <Header title="Esse é seu caminho." subtitle="Meu perfil" onBack={() => router.navigate('/')} right={<IconButton icon={Settings} label="Configurações" onPress={() => router.push('/configuracoes')} />} />
    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 22 }}>
      <AccountAvatar name={name} uri={account?.avatar} /><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 23, letterSpacing: -.8, color: colors.ink, marginTop: 15, marginBottom: 5 }}>{name}</Text>
      <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: colors.muted, marginBottom: 10 }}>Motoboy{location ? ` · ${location}` : ''}</Text>
      {account && <Pill icon={ShieldCheck} tone={account.statusCadastro === 'ativo' ? 'accent' : 'warning'}>{account.statusCadastro === 'ativo' ? 'CADASTRO ATIVO' : account.statusCadastro.toUpperCase()}</Pill>}
      <View style={{ marginTop: 16, alignItems: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 16, color: colors.ink }}>{auth.estabelecimentos.length}</Text><Text style={{ fontFamily: 'Manrope', fontSize: 8, color: colors.muted, marginTop: 4 }}>vínculos ativos</Text></View>
    </View>
    {loading && <Feedback title="Carregando seu cadastro" loading />}{error && <Feedback title="Seu cadastro não carregou" message={error} onRetry={() => void reload()} />}
    <Surface style={{ paddingVertical: 0, paddingHorizontal: 15 }}>
      <MenuRow icon={UserRound} title="Meus dados" subtitle="Nome, telefone e acesso" onPress={() => router.push('/dadosPessoais')} />
      <MenuRow icon={Bike} title="Minha moto" subtitle={account?.modeloMoto ? [account.modeloMoto, account.placaMoto].filter(Boolean).join(' · ') : 'Modelo, placa e ano'} onPress={() => router.push('/minhaMoto')} />
      <MenuRow icon={FileText} title="Documentos" subtitle="Situação e envio quando exigidos" onPress={() => router.push('/documentos')} />
      <MenuRow icon={Store} title="Estabelecimentos" subtitle="Escolher ou solicitar vínculo" last onPress={() => router.push('/selecionarRestaurante')} />
    </Surface>
    <Surface style={{ paddingVertical: 0, paddingHorizontal: 15, marginTop: 12 }}>
      <MenuRow icon={Settings} title="Configurações" subtitle="Deixe o app do seu jeito" onPress={() => router.push('/configuracoes')} />
      <MenuRow icon={ShieldCheck} title="Segurança & ajuda" subtitle="Seu apoio no caminho" last onPress={() => router.push('/ajudaOperacional')} />
    </Surface>
  </AccountScreen>;
}
