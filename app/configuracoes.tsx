import React, { useState } from 'react';
import { Modal, Platform, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Map, Moon, ShieldCheck, Waves, HelpCircle, Vibrate, X } from 'lucide-react-native';
import { AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Button, Feedback, Header, SectionTitle, Surface, type } from '../src/ui/Kit';
import { LogoutAction } from '../src/ui/LogoutAction';
import { Preferences, useZippyTheme } from '../src/ui/theme';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { ensureChatNotificationPermission, registerChatPush } from '../src/chat/push';

export default function SettingsScreen() {
  const router = useRouter(), theme = useZippyTheme(), { colors } = theme, turn = useOperationalSession();
  const [navigation, setNavigation] = useState(false), [error, setError] = useState('');
  const set = async <K extends keyof Preferences>(key: K, value: Preferences[K]) => { setError(''); try { await theme.setPreference(key, value); } catch { setError('Não foi possível salvar a preferência. Tente novamente.'); } };
  const enableNotifications = async () => {
    setError('');
    try {
      const access = await ensureChatNotificationPermission(true);
      if (access !== 'granted') { setError(Platform.OS === 'web' ? 'No iPhone, adicione o ZippyGo à Tela de Início e permita notificações nas configurações do aparelho.' : 'Permita as notificações do ZippyGo nas configurações do aparelho.'); return; }
      await turn.store.refreshPermissions();
      if (turn.session) await registerChatPush(turn.session.sessionId, { sound: theme.sound, vibration: theme.vibration, muted: false, mentionAlerts: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível habilitar os avisos.'); }
  };
  return <AccountScreen>
    <Header title="Do seu jeito." subtitle="Configurações" onBack={() => router.back()} />
    <Surface style={{ paddingHorizontal: 15, paddingVertical: 0 }}>
      {!turn.permissions?.notifications.granted && <MenuRow icon={Bell} title="Ativar avisos de novos pedidos" subtitle="Receber ofertas quando estiver usando outro aplicativo." onPress={() => void enableNotifications()} />}
      <MenuRow icon={Moon} title="Tema noturno" subtitle="Mapa e superfícies adaptados à noite." right={<Switch accessibilityLabel="Tema noturno" value={theme.dark} onValueChange={v => void set('dark', v)} trackColor={{ false: colors.line, true: '#629afb' }} />} />
      <MenuRow icon={Waves} title="Reduzir movimento" subtitle="Menos efeitos e animação decorativa." right={<Switch accessibilityLabel="Reduzir movimento" value={theme.reducedMotion} onValueChange={v => void set('reducedMotion', v)} trackColor={{ false: colors.line, true: '#629afb' }} />} />
      <MenuRow icon={Bell} title="Som dos avisos" subtitle="Respeita o volume e os canais do aparelho." right={<Switch accessibilityLabel="Som dos avisos" value={theme.sound} onValueChange={v => void set('sound', v)} />} />
      <MenuRow icon={Vibrate} title="Vibrar ao receber rota" subtitle="Um aviso curto quando chega uma oferta." last right={<Switch accessibilityLabel="Vibrar ao receber rota" value={theme.vibration} onValueChange={v => void set('vibration', v)} />} />
    </Surface>
    {!!error && <Feedback title="Confira suas preferências" message={error} />}
    <SectionTitle>No caminho</SectionTitle>
    <Surface style={{ paddingHorizontal: 15, paddingVertical: 0 }}>
      <MenuRow icon={Map} title="Navegador preferido" subtitle={`${theme.navigationApp} · abrir por pedido`} onPress={() => setNavigation(true)} />
      <MenuRow icon={Bell} title="Permissões do aparelho" subtitle="Resolver um acesso que precisa de atenção." onPress={() => router.push({ pathname: '/permissoes', params: { intent: 'review', returnTo: '/configuracoes' } })} />
      <MenuRow icon={ShieldCheck} title="Localização & privacidade" subtitle="Quem acompanha e quando" onPress={() => router.push('/privacidade')} />
      <MenuRow icon={HelpCircle} title="Ajuda & suporte" subtitle="Resolver um problema" last onPress={() => router.push('/ajudaOperacional')} />
    </Surface>
    <View style={{ marginTop: 20 }}><LogoutAction /></View><Text style={{ fontFamily: 'Manrope', fontSize: 10, textAlign: 'center', color: colors.muted, marginTop: 22 }}>ZippyGo · Seu próximo movimento.</Text>
    <Modal transparent visible={navigation} animationType={theme.reducedMotion ? 'none' : 'fade'} onRequestClose={() => setNavigation(false)}><View style={{ flex: 1, backgroundColor: '#081426bb', justifyContent: 'center', padding: 22 }}><Surface><Text style={[type.title, { color: colors.ink, marginBottom: 18 }]}>Navegador preferido</Text><View style={{ gap: 12 }}>{(['Google Maps', 'Waze'] as const).map(name => <Button key={name} secondary={name !== theme.navigationApp} icon={Map} onPress={() => { void set('navigationApp', name); setNavigation(false); }}>{name}</Button>)}<Button secondary icon={X} onPress={() => setNavigation(false)}>Fechar</Button></View></Surface></View></Modal>
  </AccountScreen>;
}
