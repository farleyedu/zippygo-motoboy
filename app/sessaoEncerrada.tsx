import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockKeyhole, RefreshCw } from 'lucide-react-native';
import { useOperationalAccess } from '../src/hooks/useOperationalAccess';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { Button, Entrance, Feedback, Header, Pill, Screen, Surface, type } from '../src/ui/Kit';
import { LogoutAction } from '../src/ui/LogoutAction';
import { useZippyTheme } from '../src/ui/theme';

export default function SessaoEncerradaScreen() {
  const allowed = useOperationalAccess(), turn = useOperationalSession(), router = useRouter(), { colors } = useZippyTheme();
  if (!allowed) return <Screen><Feedback title="Preparando seu acesso" loading /></Screen>;
  return <Screen footer={<Button icon={RefreshCw} onPress={() => router.replace('/permissoes')}>Revisar e retomar meu turno</Button>}><Entrance>
    <Header title="Vamos retomar." subtitle="Seu próximo passo, com clareza." onBack={() => router.replace('/permissoes')} />
    <View style={{ height: 190, alignItems: 'center', justifyContent: 'center' }}><View style={{ padding: 28, borderRadius: 30, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, transform: [{ rotate: '-6deg' }] }}><LockKeyhole size={39} color={colors.warning} /></View></View>
    <Pill tone="warning">CONFIRA SUA SESSÃO</Pill>
    <Text accessibilityRole="header" style={[type.title, { fontSize: 30, lineHeight: 37, color: colors.ink, marginTop: 22 }]}>Vamos retomar de onde você parou.</Text>
    <Text style={[type.body, { color: colors.muted, marginTop: 16 }]}>{turn.error || 'O turno precisa de uma nova conferência antes de continuar.'}</Text>
    <Surface style={{ marginTop: 24 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>A loja confirma a operação.</Text><Text style={[type.body, { color: colors.muted, marginTop: 8 }]}>Ao retomar, vamos consultar sua fila atual. Seus pedidos continuam seguindo o estado registrado no servidor.</Text></Surface>
    <View style={{ marginTop: 20 }}><LogoutAction /></View>
  </Entrance></Screen>;
}
