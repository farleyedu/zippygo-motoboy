import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Bell, LocateFixed, MapPin, Navigation, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useOperationalAccess } from '../src/hooks/useOperationalAccess';
import { askOperationalPermission, PermissionKind } from '../services/operationalPermissions';
import { Button, Entrance, Feedback, Header, Pill, Screen, Surface, type } from '../src/ui/Kit';
import { LogoutAction } from '../src/ui/LogoutAction';
import { useZippyTheme } from '../src/ui/theme';
import { browserNativeTest } from '../services/browserNativeTest';
import { WebLocationPermissionError } from '../services/webLocationPermission';
import { operationalDestination, permissionIntent, permissionReturn } from '../src/delivery/operationalDestination';
import { acceptLocationDisclosure, hasLocationDisclosureConsent } from '../services/locationDisclosureConsent';
import { LocationDisclosureDialog } from '../src/ui/LocationDisclosureDialog';

export default function PermissoesScreen() {
  const allowed = useOperationalAccess(), auth = useAuth(), turn = useOperationalSession(), router = useRouter();
  const params = useLocalSearchParams<{ intent?: string; returnTo?: string }>();
  const intent = permissionIntent(params.intent), returnTo = permissionReturn(params.returnTo);
  const { colors } = useZippyTheme();
  const focused = useIsFocused(), focusRef = useRef(focused); focusRef.current = focused;
  const [requesting, setRequesting] = useState<PermissionKind | null>(null), [failure, setFailure] = useState('');
  const identity = `${auth.user?.id}:${auth.estabelecimentoAtual && ('estabelecimentoId' in auth.estabelecimentoAtual ? auth.estabelecimentoAtual.estabelecimentoId : auth.estabelecimentoAtual.id)}`;
  const identityRef = useRef(identity); identityRef.current = identity;
  const [disclosure, setDisclosure] = useState<{ kind: 'foreground' | 'background' | null; userId: string; identity: string } | null>(null);
  const [acceptingDisclosure, setAcceptingDisclosure] = useState(false);
  const acceptingRef = useRef(false);
  useEffect(() => { setDisclosure(null); }, [identity, focused]);
  const showDisclosure = (kind: 'foreground' | 'background' | null) => {
    if (!auth.user || !focusRef.current) return;
    setFailure('');
    setDisclosure({ kind, userId: String(auth.user.id), identity: identityRef.current });
  };
  const starting = useRef('');
  useEffect(() => { if (allowed && focused) void turn.store.refreshPermissions().catch(() => setFailure('Não foi possível conferir as permissões. Tente novamente.')); }, [allowed, focused, turn.store]);
  const permissions = turn.permissions;
  const ask = async (kind: PermissionKind) => {
    if (requesting) return;
    setRequesting(kind); setFailure(''); const identity = identityRef.current;
    try {
      if ((kind === 'foreground' || kind === 'background') && !(await hasLocationDisclosureConsent())) {
        if (!focusRef.current || identity !== identityRef.current) return;
        showDisclosure(kind); return;
      }
      const current = kind === 'services' ? null : permissions?.[kind];
      if (kind === 'services' || (current && !current.canAskAgain && !current.granted)) {
        router.push({ pathname: '/permissaoNegada', params: { kind, intent, returnTo: String(returnTo) } }); return;
      }
      const outcome = await askOperationalPermission(kind);
      if (!focusRef.current || identity !== identityRef.current) return;
      if (outcome === 'consent-required') { showDisclosure(kind === 'background' ? 'background' : 'foreground'); return; }
      const result = await turn.store.refreshPermissions();
      if (!focusRef.current || identity !== identityRef.current) return;
      if (!result[kind].granted) router.push({ pathname: '/permissaoNegada', params: { kind, intent, returnTo: String(returnTo) } });
    } catch (error) {
      if (focusRef.current && identity === identityRef.current) {
        if (error instanceof WebLocationPermissionError && error.reason === 'denied') router.push({ pathname: '/permissaoNegada', params: { kind, intent, returnTo: String(returnTo) } });
        else setFailure(error instanceof Error ? error.message : 'Não foi possível solicitar a permissão.');
      }
    }
    finally { setRequesting(null); }
  };
  const acceptDisclosure = async () => {
    if (!disclosure || acceptingRef.current) return;
    const pending = disclosure;
    acceptingRef.current = true; setAcceptingDisclosure(true); setFailure('');
    try {
      if (!focusRef.current || pending.identity !== identityRef.current) return;
      await acceptLocationDisclosure(pending.userId);
      if (!focusRef.current || pending.identity !== identityRef.current) return;
      setDisclosure(null);
      const result = await turn.store.refreshPermissions();
      if (!focusRef.current || pending.identity !== identityRef.current) return;
      // Com permissões já concedidas, o efeito de início retoma o turno.
      // No primeiro acesso, continuar somente na solicitação escolhida pelo usuário.
      const nextKind = pending.kind ?? (!result.foreground.granted ? 'foreground'
        : !result.background.granted && result.background.supported ? 'background' : null);
      if (nextKind && !result[nextKind].granted) await ask(nextKind);
    } catch (error) {
      if (focusRef.current && pending.identity === identityRef.current)
        setFailure(error instanceof Error ? error.message : 'Não foi possível salvar seu consentimento. Tente novamente.');
    } finally { acceptingRef.current = false; setAcceptingDisclosure(false); }
  };
  const begin = async () => {
    const identity = identityRef.current;
    if (starting.current === identity) return;
    starting.current = identity; setFailure('');
    try {
      // A restauração pode publicar permissões prontas antes de liberar a operação.
      await turn.store.whenIdle();
      if (!focusRef.current || identity !== identityRef.current) return;
      const connected = await turn.store.start();
      if (!focusRef.current || identity !== identityRef.current) return;
      if (connected) router.replace(operationalDestination(turn.store.getSnapshot().queue, Platform.OS));
      else if (!turn.store.getSnapshot().error && turn.store.getSnapshot().phase !== 'permission-required') setFailure('Não foi possível conectar o turno. Tente novamente.');
    } catch (error) {
      if (focusRef.current && identity === identityRef.current) setFailure(error instanceof Error ? error.message : 'Não foi possível conectar o turno.');
    } finally { if (starting.current === identity) starting.current = ''; }
  };
  const automaticallyStarted = useRef('');
  useEffect(() => {
    if (!allowed || !focused || !permissions?.ready || turn.busy) return;
    if (intent === 'review') {
      router.replace(returnTo);
      return;
    }
    if (automaticallyStarted.current === identityRef.current) return;
    automaticallyStarted.current = identityRef.current;
    void begin();
  }, [allowed, focused, permissions?.ready, turn.busy, intent, returnTo, identity]);
  if (!allowed) return <Screen><Feedback title="Preparando seu acesso" loading /></Screen>;
  if (!permissions || permissions.ready) return <Screen>
    {(failure || turn.error) ? <Feedback title={intent === 'review' ? 'Não foi possível verificar o acesso' : 'Não foi possível conectar o turno'} message={failure || turn.error || undefined} onRetry={() => intent === 'review' ? void turn.store.refreshPermissions() : void begin()} /> : <Feedback title={intent === 'review' ? 'Conferindo permissões' : 'Conectando seu turno'} loading />}
  </Screen>;
  const blocked = turn.busy || !!requesting || acceptingDisclosure;
  const cards = [
    { kind: 'foreground' as const, title: 'Localização com o app aberto', description: 'Sua posição no mapa e o ponto de partida do turno.', icon: MapPin },
    { kind: 'background' as const, title: 'Seu turno continua no caminho', description: 'A loja acompanha sua posição enquanto você está online, inclusive com a tela apagada.', icon: Navigation },
    { kind: 'notifications' as const, title: 'Um chamado. Você por dentro.', description: 'Avisos de rotas e mensagens. Você pode continuar sem esses avisos.', icon: Bell },
  ];
  return <><Screen footer={<View style={{ gap: 9 }}>
    {intent !== 'review' && <Button icon={Navigation} loading={turn.busy} disabled={blocked || !permissions?.ready} onPress={() => void begin()}>{turn.session ? 'Retomar meu turno' : 'Ficar online'}</Button>}
    <Button secondary disabled={blocked} onPress={() => router.replace(returnTo)}>{intent === 'review' ? 'Voltar' : 'Continuar offline'}</Button>
  </View>}><Entrance>
    <Header title="Permissão necessária" subtitle="Ajuste somente o que falta." onBack={() => router.replace(returnTo)} />
    <Text accessibilityRole="header" style={[type.title, { color: colors.ink, fontSize: 29, lineHeight: 36 }]}>Seu caminho,{ '\n'}sempre conectado.</Text>
    <Text style={[type.body, { color: colors.muted, marginTop: 12, marginBottom: 18 }]}>{browserNativeTest ? 'Permissoes liberadas para teste no navegador. Recursos nativos estao mockados; as demais acoes continuam usando a API.' : 'Confira as permissões antes de começar. A loja acompanha sua localização somente durante o turno online.'}</Text>
    <Pill icon={ShieldCheck}>{auth.estabelecimentoAtual?.nome || 'Seu estabelecimento'}</Pill>
    {permissions.locationConsentGranted === false && <Surface style={{ marginTop: 18 }}>
      <Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>Localização durante seu turno</Text>
      <Text style={[type.small, { color: colors.muted, marginTop: 8, marginBottom: 14 }]}>Revise como sua posição é compartilhada antes de ficar online.</Text>
      <Button secondary disabled={blocked} onPress={() => showDisclosure(null)}>Revisar e continuar</Button>
    </Surface>}
    {browserNativeTest ? <View style={{ marginTop: 18 }}><Feedback title="Permissoes liberadas · MOCK no navegador" message="GPS, segundo plano e notificacoes estao simulados para teste. Nenhuma permissao nativa sera solicitada; coordenadas simuladas nao sao enviadas a loja." /></View> : Platform.OS === 'web' && <View style={{ marginTop: 18 }}><Feedback title="Localização com o ZippyGo aberto" message="Ao abrir ou voltar, atualizamos sua posição. No Maps/Waze ou com a tela bloqueada, a loja vê a última localização e há quanto tempo ela foi capturada. Sua entrega continua." /></View>}
    {(failure || turn.error) && <View style={{ marginTop: 18 }}><Feedback title={turn.phase === 'reconnecting' ? 'O turno aguarda conexão' : 'Confira antes de continuar'} message={failure || turn.error || undefined} onRetry={failure ? undefined : () => void turn.store.restore()} />{!!failure && <Button secondary loading={requesting === 'foreground'} onPress={() => void ask('foreground')}>Solicitar localização novamente</Button>}</View>}
    {!permissions && <Feedback title="Conferindo permissões" loading />}
    <View style={{ gap: 12, marginTop: 20 }}>{!browserNativeTest && cards.filter(card => (Platform.OS !== 'web' || card.kind === 'foreground') && !permissions[card.kind].granted).map(card => {
      const permission = permissions?.[card.kind], Icon = card.icon;
      return <Surface key={card.kind}><View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13 }}><View style={{ padding: 11, borderRadius: 14, backgroundColor: colors.soft }}><Icon size={22} color={colors.accent} strokeWidth={1.7} /></View><View style={{ flex: 1, gap: 6 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>{card.title}</Text><Text style={[type.small, { color: colors.muted }]}>{card.description}</Text><Pill tone="warning">CONFERIR PERMISSÃO</Pill></View></View>
        {!permission?.granted && <View style={{ marginTop: 14 }}><Button secondary disabled={blocked || !permission?.supported || (card.kind === 'background' && !permissions?.foreground.granted)} loading={requesting === card.kind} onPress={() => void ask(card.kind)}>{card.kind === 'foreground' ? 'Permitir localização' : card.kind === 'background' ? 'Permitir em segundo plano' : 'Permitir notificações'}</Button></View>}
      </Surface>;
    })}</View>
    {permissions && !permissions.services && <View style={{ marginTop: 16 }}><Feedback title="Ative a localização do aparelho" message="O GPS precisa estar ligado para acompanhar seu turno." /><Button secondary icon={LocateFixed} onPress={() => void ask('services')}>Conferir GPS</Button></View>}
    <Surface style={{ marginTop: 18 }}><View style={{ flexDirection: 'row', gap: 10 }}><ShieldCheck size={21} color={colors.accent} /><Text style={[type.small, { flex: 1, color: colors.muted }]}>A localização para o cliente é uma preferência separada. As notificações não bloqueiam seu turno.</Text></View></Surface>
    <View style={{ marginTop: 18 }}><LogoutAction /></View>
  </Entrance></Screen>
    <LocationDisclosureDialog visible={!!disclosure} busy={acceptingDisclosure} error={disclosure ? failure : undefined}
      onContinue={() => void acceptDisclosure()} onCancel={() => { setDisclosure(null); setFailure(''); }} />
  </>;
}
