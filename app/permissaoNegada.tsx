import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, MapPin, Settings2, ShieldCheck } from 'lucide-react-native';
import { useOperationalAccess } from '../src/hooks/useOperationalAccess';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { openOperationalSettings } from '../services/operationalPermissions';
import { Button, Entrance, Feedback, Header, Pill, Screen, Surface, type } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

export default function PermissaoNegadaScreen() {
  const allowed = useOperationalAccess(), turn = useOperationalSession(), router = useRouter();
  const { kind } = useLocalSearchParams<{ kind?: string }>(), { colors } = useZippyTheme();
  const [error, setError] = useState('');
  const notification = kind === 'notifications', background = kind === 'background', services = kind === 'services';
  const title = notification ? 'Não perca um chamado.' : services ? 'Seu caminho precisa do GPS.' : 'Seu caminho precisa da localização.';
  const detail = notification ? 'Permita as notificações para receber avisos de rotas e mensagens.' : services ? 'Ative a localização do aparelho e volte para conferir.' : background ? 'Nas permissões do ZippyGo, permita a localização também em segundo plano para acompanhar o turno com a tela apagada.' : 'Nas permissões do ZippyGo, permita a localização enquanto o app estiver em uso.';
  if (!allowed) return <Screen><Feedback title="Preparando seu acesso" loading /></Screen>;
  return <Screen footer={<View style={{ gap: 10 }}><Button icon={Settings2} disabled={Platform.OS === 'web'} onPress={() => void openOperationalSettings().catch(failure => setError(failure.message))}>Abrir configurações</Button><Button secondary onPress={() => router.replace('/permissoes')}>Voltar à preparação</Button></View>}><Entrance>
    <Header title="Vamos ajustar juntos." subtitle="Uma permissão, um propósito." onBack={() => router.replace('/permissoes')} />
    <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}><View style={{ padding: 27, borderRadius: 29, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, transform: [{ rotate: '-7deg' }], shadowColor: colors.warning, shadowOpacity: .15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>{notification ? <Bell size={38} color={colors.warning} /> : <MapPin size={38} color={colors.warning} />}</View></View>
    <Pill icon={ShieldCheck} tone="warning">VOCÊ NO CONTROLE</Pill>
    <Text accessibilityRole="header" style={[type.title, { color: colors.ink, fontSize: 30, lineHeight: 37, marginTop: 22 }]}>{title}</Text>
    <Text style={[type.body, { color: colors.muted, marginTop: 16 }]}>{detail}</Text>
    <Surface style={{ marginTop: 24 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>Depois, volte para conferir.</Text><Text style={[type.body, { color: colors.muted, marginTop: 8 }]}>{notification ? 'As rotas continuam disponíveis dentro do app mesmo sem os avisos.' : turn.session ? 'Seu turno permanece registrado. Vamos recuperar o acompanhamento sem apagar seus pedidos.' : 'Seu turno começa após conferir as permissões e tocar em Ficar online.'}</Text></Surface>
    {Platform.OS === 'web' && <View style={{ marginTop: 20 }}><Feedback title="Confira no aparelho" message="As permissões de segundo plano e notificações deste app são ajustadas no celular." /></View>}
    {error ? <Feedback title="Não foi possível abrir" message={error} /> : null}
  </Entrance></Screen>;
}
