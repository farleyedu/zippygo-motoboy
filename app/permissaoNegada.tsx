import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Bell, MapPin, Settings2, ShieldCheck } from 'lucide-react-native';
import { useOperationalAccess } from '../src/hooks/useOperationalAccess';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { openOperationalSettings } from '../services/operationalPermissions';
import { Button, Entrance, Feedback, Header, Pill, Screen, Surface, type } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';
import { browserNativeTest } from '../services/browserNativeTest';
import { requestWebLocationPermission } from '../services/webLocationPermission';
import { operationalDestination, permissionIntent, permissionReturn } from '../src/delivery/operationalDestination';

export default function PermissaoNegadaScreen() {
  const allowed = useOperationalAccess(), turn = useOperationalSession(), router = useRouter();
  const { kind, intent: rawIntent, returnTo: rawReturn } = useLocalSearchParams<{ kind?: string; intent?: string; returnTo?: string }>(), { colors } = useZippyTheme();
  const intent = permissionIntent(rawIntent), returnTo = permissionReturn(rawReturn), focused = useIsFocused(), handled = useRef(false);
  const focusRef = useRef(focused); focusRef.current = focused;
  const preparation = { pathname: '/permissoes' as const, params: { intent, returnTo: String(returnTo) } };
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const notification = kind === 'notifications', background = kind === 'background', services = kind === 'services';
  const targetGranted = services ? turn.permissions?.services : notification ? turn.permissions?.notifications.granted : background ? turn.permissions?.background.granted : turn.permissions?.foreground.granted;
  useEffect(() => {
    if (!focused) handled.current = false;
    if (!allowed || !focused) return;
    void turn.store.refreshPermissions().catch(() => {});
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void turn.store.refreshPermissions().catch(() => {}); });
    return () => listener.remove();
  }, [allowed, focused, turn.store]);
  useEffect(() => {
    if (!allowed || !focused || !targetGranted || turn.busy || handled.current) return;
    handled.current = true;
    if (intent === 'review') { router.replace(returnTo); return; }
    if (!turn.permissions?.ready) { router.replace(preparation); return; }
    void turn.store.whenIdle().then(async () => {
      if (!focusRef.current) return;
      const ok = await turn.store.start();
      if (focusRef.current) router.replace(ok ? operationalDestination(turn.store.getSnapshot().queue, Platform.OS) : preparation);
    });
  }, [allowed, focused, targetGranted, turn.busy, intent, returnTo, turn.permissions?.ready]);
  const title = notification ? 'Não perca um chamado.' : services ? 'Seu caminho precisa do GPS.' : 'Seu caminho precisa da localização.';
  const detail = notification ? 'Permita as notificações para receber avisos de rotas e mensagens.' : services ? 'Ative a localização do aparelho e volte para conferir.' : background ? 'Nas permissões do ZippyGo, permita a localização também em segundo plano para acompanhar o turno com a tela apagada.' : 'Nas permissões do ZippyGo, permita a localização enquanto o app estiver em uso.';
  if (!allowed) return <Screen><Feedback title="Preparando seu acesso" loading /></Screen>;
  if (browserNativeTest || targetGranted) return <Screen><Feedback title="Conferindo o acesso" loading /></Screen>;
  if (Platform.OS === 'web') {
    const verify = async () => {
      if (checking) return;
      setChecking(true); setError('');
      try { await requestWebLocationPermission(); await turn.store.refreshPermissions(); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'A localização continua bloqueada. Confira a permissão e volte.'); }
      finally { setChecking(false); }
    };
    return <Screen footer={<View style={{ gap: 10 }}><Button icon={MapPin} loading={checking} onPress={() => void verify()}>Já permiti, verificar localização</Button><Button secondary disabled={checking} onPress={() => router.replace('/')}>{turn.session ? 'Voltar ao meu turno' : 'Continuar offline'}</Button></View>}>
      <Header title="Libere a localização" subtitle="ZippyGo no navegador" onBack={() => router.replace(returnTo)} />
      <Text style={[type.body, { color: colors.ink, marginBottom: 18 }]}>O navegador bloqueou a localização. Ajuste a permissão e volte aqui para verificar.</Text>
      <Surface><View style={{ gap: 14 }}><Text style={[type.body, { color: colors.ink }]}>1. Abra o endereço HTTPS do ZippyGo no Safari.</Text><Text style={[type.body, { color: colors.ink }]}>2. Nas opções do site, confira a permissão de Localização e escolha Permitir.</Text><Text style={[type.body, { color: colors.ink }]}>3. Se ainda estiver bloqueado, confira nos Ajustes do iPhone se os Serviços de Localização e o acesso do navegador estão permitidos.</Text><Text style={[type.body, { color: colors.ink }]}>4. Volte ao ZippyGo onde você usa o turno, inclusive se ele estiver na Tela de Início, e toque em verificar localização.</Text></View></Surface>
      <Text style={[type.small, { color: colors.muted, marginTop: 18 }]}>A web atualiza sua posição com o ZippyGo aberto. Segundo plano e notificações não precisam de permissão nesta versão.</Text>
      {!!error && <View style={{ marginTop: 18 }}><Feedback title="Localização não confirmada" message={error} /></View>}
    </Screen>;
  }
  return <Screen footer={<View style={{ gap: 10 }}><Button icon={Settings2} onPress={() => void openOperationalSettings().catch(failure => setError(failure.message))}>Abrir configurações</Button><Button secondary onPress={() => router.replace(returnTo)}>Voltar ao app</Button></View>}><Entrance>
    <Header title="Vamos ajustar juntos." subtitle="Uma permissão, um propósito." onBack={() => router.replace(returnTo)} />
    <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}><View style={{ padding: 27, borderRadius: 29, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, transform: [{ rotate: '-7deg' }], shadowColor: colors.warning, shadowOpacity: .15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>{notification ? <Bell size={38} color={colors.warning} /> : <MapPin size={38} color={colors.warning} />}</View></View>
    <Pill icon={ShieldCheck} tone="warning">VOCÊ NO CONTROLE</Pill>
    <Text accessibilityRole="header" style={[type.title, { color: colors.ink, fontSize: 30, lineHeight: 37, marginTop: 22 }]}>{title}</Text>
    <Text style={[type.body, { color: colors.muted, marginTop: 16 }]}>{detail}</Text>
    <Surface style={{ marginTop: 24 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>Depois, volte para conferir.</Text><Text style={[type.body, { color: colors.muted, marginTop: 8 }]}>{notification ? 'As rotas continuam disponíveis dentro do app mesmo sem os avisos.' : turn.session ? 'Seu turno permanece registrado. Vamos recuperar o acompanhamento sem apagar seus pedidos.' : 'Seu turno começa após conferir as permissões e tocar em Ficar online.'}</Text></Surface>
    {error ? <Feedback title="Não foi possível abrir" message={error} /> : null}
  </Entrance></Screen>;
}
