import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Bell, Check, LocateFixed, MapPin, Navigation, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useOperationalAccess } from '../src/hooks/useOperationalAccess';
import { askOperationalPermission, PermissionKind } from '../services/operationalPermissions';
import { Button, Entrance, Feedback, Header, Pill, Screen, Surface, type } from '../src/ui/Kit';
import { LogoutAction } from '../src/ui/LogoutAction';
import { useZippyTheme } from '../src/ui/theme';
import { browserNativeTest } from '../services/browserNativeTest';

function Radar() {
  const { colors, reducedMotion } = useZippyTheme();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    animation.start(); return () => animation.stop();
  }, [progress, reducedMotion]);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 175, justifyContent: 'center', alignItems: 'center', marginVertical: 12 }}>
    {[145, 102, 65].map((size, index) => <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size, borderWidth: 1, borderColor: colors.line, transform: [{ rotateX: '20deg' }, { rotateZ: index % 2 ? '20deg' : '-20deg' }] }} />)}
    <Animated.View style={{ padding: 21, borderRadius: 24, backgroundColor: colors.accentSoft, borderColor: colors.line, borderWidth: 1, shadowColor: '#2872e3', shadowOpacity: .22, shadowRadius: 22, shadowOffset: { width: 0, height: 9 }, elevation: 6, transform: [{ perspective: 600 }, { rotateZ: '-9deg' }, { translateY: progress.interpolate({ inputRange: [0, .5, 1], outputRange: [0, -7, 0] }) }] }}><Navigation size={32} color={colors.accent} strokeWidth={1.5} /></Animated.View>
  </View>;
}

export default function PermissoesScreen() {
  const allowed = useOperationalAccess(), auth = useAuth(), turn = useOperationalSession(), router = useRouter();
  const { colors } = useZippyTheme();
  const focused = useIsFocused(), focusRef = useRef(focused); focusRef.current = focused;
  const [requesting, setRequesting] = useState<PermissionKind | null>(null), [failure, setFailure] = useState('');
  const identityRef = useRef(''); identityRef.current = `${auth.user?.id}:${auth.estabelecimentoAtual && ('id' in auth.estabelecimentoAtual ? auth.estabelecimentoAtual.id : auth.estabelecimentoAtual.estabelecimentoId)}`;
  useEffect(() => { if (allowed && focused) void turn.store.refreshPermissions().catch(() => setFailure('Não foi possível conferir as permissões. Tente novamente.')); }, [allowed, focused, turn.store]);
  const permissions = turn.permissions;
  const ask = async (kind: PermissionKind) => {
    if (requesting) return;
    setRequesting(kind); setFailure(''); const identity = identityRef.current;
    try {
      const current = kind === 'services' ? null : permissions?.[kind];
      if (kind === 'services' || (current && !current.canAskAgain && !current.granted)) {
        router.push({ pathname: '/permissaoNegada', params: { kind } }); return;
      }
      await askOperationalPermission(kind);
      const result = await turn.store.refreshPermissions();
      if (!focusRef.current || identity !== identityRef.current) return;
      if (!result[kind].granted) router.push({ pathname: '/permissaoNegada', params: { kind } });
    } catch (error) { if (focusRef.current && identity === identityRef.current) setFailure(error instanceof Error ? error.message : 'Não foi possível solicitar a permissão.'); }
    finally { setRequesting(null); }
  };
  const begin = async () => {
    const identity = identityRef.current;
    if (await turn.store.start() && focusRef.current && identity === identityRef.current) router.replace('/');
  };
  if (!allowed) return <Screen><Feedback title="Preparando seu acesso" loading /></Screen>;
  const blocked = turn.busy || !!requesting;
  const cards = [
    { kind: 'foreground' as const, title: 'Localização com o app aberto', description: 'Sua posição no mapa e o ponto de partida do turno.', icon: MapPin },
    { kind: 'background' as const, title: 'Seu turno continua no caminho', description: 'A loja acompanha sua posição enquanto você está online, inclusive com a tela apagada.', icon: Navigation },
    { kind: 'notifications' as const, title: 'Um chamado. Você por dentro.', description: 'Avisos de rotas e mensagens. Você pode continuar sem esses avisos.', icon: Bell },
  ];
  return <Screen footer={<View style={{ gap: 9 }}>
    <Button icon={Navigation} loading={turn.busy} disabled={blocked || !permissions?.ready} onPress={() => void begin()}>{turn.session ? 'Retomar meu turno' : 'Ficar online'}</Button>
    {!turn.session && <Button secondary disabled={blocked} onPress={() => router.replace('/')}>Continuar offline</Button>}
  </View>}><Entrance>
    <Header title="Vamos preparar tudo." subtitle="Você no controle." onBack={() => router.replace('/')} />
    <View style={{ flexDirection: 'row', gap: 7 }}>{[0, 1, 2].map(index => <View key={index} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: index < 2 || permissions?.ready ? colors.accent : colors.line }} />)}</View>
    <Radar />
    <Text accessibilityRole="header" style={[type.title, { color: colors.ink, fontSize: 29, lineHeight: 36 }]}>Seu caminho,{ '\n'}sempre conectado.</Text>
    <Text style={[type.body, { color: colors.muted, marginTop: 12, marginBottom: 18 }]}>{browserNativeTest ? 'Permissoes liberadas para teste no navegador. Recursos nativos estao mockados; as demais acoes continuam usando a API.' : 'Confira as permissões antes de começar. A loja acompanha sua localização somente durante o turno online.'}</Text>
    <Pill icon={ShieldCheck}>{auth.estabelecimentoAtual?.nome || 'Seu estabelecimento'}</Pill>
    {browserNativeTest ? <View style={{ marginTop: 18 }}><Feedback title="Permissoes liberadas · MOCK no navegador" message="GPS, segundo plano e notificacoes estao simulados para teste. Nenhuma permissao nativa sera solicitada; coordenadas simuladas nao sao enviadas a loja." /></View> : Platform.OS === 'web' && <View style={{ marginTop: 18 }}><Feedback title="Localização com o ZippyGo aberto" message="Ao abrir ou voltar, atualizamos sua posição. No Maps/Waze ou com a tela bloqueada, a loja vê a última localização e há quanto tempo ela foi capturada. Sua entrega continua." /></View>}
    {(failure || turn.error) && <View style={{ marginTop: 18 }}><Feedback title={turn.phase === 'reconnecting' ? 'O turno aguarda conexão' : 'Confira antes de continuar'} message={failure || turn.error || undefined} onRetry={() => { setFailure(''); void turn.store.restore(); }} /></View>}
    {!permissions && <Feedback title="Conferindo permissões" loading />}
    <View style={{ gap: 12, marginTop: 20 }}>{!browserNativeTest && cards.filter(card => Platform.OS !== 'web' || card.kind === 'foreground').map(card => {
      const permission = permissions?.[card.kind], Icon = card.icon;
      return <Surface key={card.kind}><View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13 }}><View style={{ padding: 11, borderRadius: 14, backgroundColor: colors.soft }}><Icon size={22} color={colors.accent} strokeWidth={1.7} /></View><View style={{ flex: 1, gap: 6 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>{card.title}</Text><Text style={[type.small, { color: colors.muted }]}>{card.description}</Text><Pill icon={permission?.granted ? Check : undefined} tone={permission?.granted ? 'accent' : 'warning'}>{permission?.granted ? 'PERMITIDO' : permission && !permission.supported ? 'NO APLICATIVO' : 'CONFERIR PERMISSÃO'}</Pill></View></View>
        {!permission?.granted && <View style={{ marginTop: 14 }}><Button secondary disabled={blocked || !permission?.supported || (card.kind === 'background' && !permissions?.foreground.granted)} loading={requesting === card.kind} onPress={() => void ask(card.kind)}>{card.kind === 'foreground' ? 'Permitir localização' : card.kind === 'background' ? 'Permitir em segundo plano' : 'Permitir notificações'}</Button></View>}
      </Surface>;
    })}</View>
    {permissions && !permissions.services && <View style={{ marginTop: 16 }}><Feedback title="Ative a localização do aparelho" message="O GPS precisa estar ligado para acompanhar seu turno." /><Button secondary icon={LocateFixed} onPress={() => void ask('services')}>Conferir GPS</Button></View>}
    <Surface style={{ marginTop: 18 }}><View style={{ flexDirection: 'row', gap: 10 }}><ShieldCheck size={21} color={colors.accent} /><Text style={[type.small, { flex: 1, color: colors.muted }]}>A localização para o cliente é uma preferência separada. As notificações não bloqueiam seu turno.</Text></View></Surface>
    <View style={{ marginTop: 18 }}><LogoutAction /></View>
  </Entrance></Screen>;
}
