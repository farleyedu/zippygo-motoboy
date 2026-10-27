import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Bell, Check, ChevronRight, Clock3, LocateFixed, Map, Package, Pause, Route, Store } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { AccountNotice, AccountScreen } from './AccountKit';
import { Button, Feedback, IconButton, Pill, Screen, SectionTitle, Surface, type } from './Kit';
import { Helmet, MiniRouteMap, activeStops } from './RouteKit';
import { useZippyTheme } from './theme';
import { LogoutAction } from './LogoutAction';
import { operationalDestination } from '../delivery/operationalDestination';
import { setTurnPaused } from '../../services/routeApi';
import { useRouteAction } from '../hooks/useRouteAction';
import { OperationalStatus } from './OperationalStatus';

export default function HomeScreen() {
  const auth = useAuth(), turn = useOperationalSession(), router = useRouter(), { colors } = useZippyTheme(), focused = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();
  const hasSession = !!turn.session, queue = turn.queue, count = activeStops(queue).length;
  const turnAction = useRouteAction();
  const goOnline = async () => {
    if (hasSession) { void turnAction.run(() => setTurnPaused(!queue?.paused)); return; }
    if (!await turn.store.start() && turn.store.getSnapshot().phase === 'permission-required') router.push({ pathname: '/permissoes', params: { intent: 'start' } });
  };
  useEffect(() => { if (!focused || auth.isLoading || auth.restoreError) return; if (!auth.user) router.replace(auth.didSignOut ? '/(auth)/login' : '/(auth)/welcome'); else if (auth.estabelecimentos.length && (auth.needsEstablishmentSelection || !auth.estabelecimentoAtual)) router.replace('/selecionarRestaurante'); }, [focused, auth.isLoading, auth.restoreError, auth.user, auth.didSignOut, auth.estabelecimentos.length, auth.needsEstablishmentSelection, auth.estabelecimentoAtual, router]);
  if (auth.restoreError) return <Screen><Feedback title="Vamos reconectar seu acesso" message={auth.restoreError} onRetry={() => void auth.loadUserFromStorage()} /><LogoutAction /></Screen>;
  if (auth.isLoading || !auth.user) return <Screen><Feedback title="Conferindo seu acesso" loading /></Screen>;
  if (!auth.estabelecimentos.length) return <AccountScreen active="home">
    <View style={linkStyles.header}><Text style={[type.eyebrow, { color: colors.muted }]}>{`OLÁ, ${auth.user.nome.split(' ')[0]}`.toUpperCase()}</Text><Text accessibilityRole="header" style={[linkStyles.welcome, { color: colors.ink }]}>Encontre sua equipe.</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Solicitar vínculo" onPress={() => router.push('/solicitarRestaurante')} style={({ pressed }) => ({ opacity: pressed ? .8 : 1 })}>
      <Surface hero style={linkStyles.hero}>
        <Pill inverse>SEU PRIMEIRO VÍNCULO</Pill>
        <View style={linkStyles.copy}><Text style={[linkStyles.title, { color: colors.heroInk }]}>{'Solicitar\nvínculo'}</Text><Text style={[linkStyles.description, { color: colors.heroMuted }]}>Veja os estabelecimentos cadastrados e escolha onde quer trabalhar.</Text></View>
        <View pointerEvents="none" style={linkStyles.helmet}><Helmet size={screenWidth < 360 ? 112 : 158} /></View>
        <View style={linkStyles.action}><Store size={18} color={colors.heroInk} /><Text style={[linkStyles.actionText, { color: colors.heroInk }]}>Ver estabelecimentos</Text><ChevronRight size={20} color={colors.heroInk} /></View>
      </Surface>
    </Pressable>
    <View style={linkStyles.followUp}><Button icon={Clock3} secondary onPress={() => router.push('/solicitacoesVinculo')}>Minhas solicitações</Button><Button icon={Store} secondary onPress={() => router.push('/selecionarRestaurante')}>Convites e vínculos</Button></View>
    <AccountNotice icon={Store}>Seu acesso já está liberado. Para começar a receber entregas, solicite um vínculo e aguarde a aprovação da loja.</AccountNotice>
  </AccountScreen>;
  const target = operationalDestination(queue, Platform.OS);
  return <AccountScreen active="home" footer={<View style={{ gap: 8 }}><Button icon={hasSession ? Pause : LocateFixed} disabled={turn.busy || turnAction.busy} loading={turn.busy || turnAction.busy} onPress={() => void goOnline()}>{hasSession ? queue?.paused ? 'Retomar chamados' : 'Pausar chamados' : 'Ficar online'}</Button><Text style={{ fontFamily: 'Manrope', fontSize: 10, textAlign: 'center', color: colors.muted }}>{hasSession ? turn.locationLimited ? 'Sem localização agora: a loja vê a última posição confirmada.' : 'Localização compartilhada com a loja desde o online.' : Platform.OS === 'web' ? 'Ao ficar online, a loja acompanha sua localização enquanto o ZippyGo estiver aberto e permitido.' : 'Ao ficar online, a loja acompanha sua localização.'}</Text></View>}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 20 }}><View style={{ flex: 1 }}><Text style={[type.eyebrow, { color: colors.muted }]}>{`${new Date().getHours() < 12 ? 'BOM DIA' : new Date().getHours() < 18 ? 'BOA TARDE' : 'BOA NOITE'}, ${auth.user?.nome.split(' ')[0] || ''}`.toUpperCase()}</Text><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 25, letterSpacing: -.7, color: colors.ink, marginTop: 6 }}>Pronto pro próximo?</Text></View><IconButton icon={Bell} label="Avisos do turno" onPress={() => router.push('/avisosTurno')} /></View>
    <Surface hero style={{ padding: 20, minHeight: 250 }}>
      <Pill inverse>{hasSession ? queue?.paused ? 'ONLINE · CHAMADOS PAUSADOS' : turn.locationLimited ? 'ONLINE · SEM LOCALIZAÇÃO' : Platform.OS === 'web' ? 'ONLINE · LOCALIZAÇÃO COM O APP ABERTO' : 'ONLINE · LOCALIZAÇÃO ATIVA' : 'SEU TURNO COMEÇA AQUI'}</Pill>
      <View style={{ width: '66%', marginTop: 16, zIndex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 31, lineHeight: 33, letterSpacing: -1.2, color: colors.heroInk }}>{hasSession ? 'A cidade\nte espera.' : 'Seu próximo\nmovimento.'}</Text><Text style={{ fontFamily: 'Manrope', fontSize: 11, lineHeight: 19, marginTop: 10, color: colors.heroMuted }}>{hasSession ? 'A loja acompanha você.\nVamos fazer acontecer.' : 'Organize o caminho.\nFaça cada entrega contar.'}</Text></View>
      <View pointerEvents="none" style={{ position: 'absolute', right: -26, top: 68 }}><Helmet size={178} /></View>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#ffffff20', marginTop: 24, paddingTop: 12, zIndex: 2 }}><View style={{ flex: 1, flexDirection: 'row', gap: 6 }}><Store size={14} color={colors.heroMuted} /><Text numberOfLines={1} style={{ fontFamily: 'Manrope', fontSize: 10, color: colors.heroMuted, flex: 1 }}>{auth.estabelecimentoAtual?.nome}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Trocar estabelecimento" onPress={() => router.push('/selecionarRestaurante')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 10, color: '#93bcf2' }}>Trocar ↗</Text></Pressable></View>
    </Surface>
    <View style={{ flexDirection: 'row', marginTop: 16, padding: 15, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>{[[String(count), 'na sua rota'], [String(auth.estabelecimentos.length), 'vínculos ativos'], [hasSession ? queue?.paused ? 'Pausa' : 'Online' : 'Offline', 'seu turno']].map(([value, label]) => <Pressable key={label} accessibilityRole={label === 'seu turno' && hasSession ? 'button' : undefined} accessibilityLabel={label === 'seu turno' && hasSession ? 'Resumo e encerramento do turno' : label} disabled={label !== 'seu turno' || !hasSession} onPress={() => router.push('/turno')} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 17, color: colors.ink }}>{value}</Text><Text style={{ fontFamily: 'Manrope', fontSize: 8, color: colors.muted, marginTop: 4 }}>{label === 'seu turno' && hasSession ? 'Ver turno ↗' : label}</Text></Pressable>)}</View>
    {(hasSession || Platform.OS === 'web') && <OperationalStatus />}
    <SectionTitle right={<Pressable accessibilityRole="button" onPress={() => router.push('/mapa')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 10, color: colors.accent }}>Ver mapa ↗</Text></Pressable>}>{hasSession ? 'Seu radar' : 'Tudo pronto?'}</SectionTitle>
    {hasSession ? <><MiniRouteMap queue={queue} caption={queue?.paused ? turn.locationLimited ? 'Chamados pausados · sem localização agora' : Platform.OS === 'web' ? 'Chamados pausados · localização com o app aberto' : 'Chamados pausados · localização continua ativa' : count ? 'Sua sequência de entregas' : 'Online · aguardando um novo caminho'} />{queue?.offer && <Pressable accessibilityRole="button" onPress={() => router.push('/oferta')} style={{ marginTop: 13 }}><Surface style={{ backgroundColor: colors.accentSoft }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Package size={24} color={colors.accent} /><View style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.ink }}>Uma nova rota pra você</Text><Text style={[type.small, { color: colors.muted }]}>{queue.offer.stops.length} pedidos · confira a oferta</Text></View><ChevronRight size={17} color={colors.accent} /></View></Surface></Pressable>}{(count > 0 || queue?.routeState === 'returning') && <View style={{ marginTop: 13 }}><Button secondary icon={Route} onPress={() => router.push(target)}>{queue?.routeState === 'returning' ? 'Retornar ao estabelecimento' : queue?.current?.pickedUpAtUtc ? 'Continuar minha rota' : 'Conferir rota e retirada'}</Button></View>}</> : <View style={{ gap: 13 }}>{Platform.OS !== 'web' && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', gap: 7 }}><LocateFixed size={16} color={colors.muted} /><Text style={[type.small, { color: colors.ink }]}>Localização operacional</Text></View><Pill icon={turn.permissions?.ready ? Check : LocateFixed} tone={turn.permissions?.ready ? 'accent' : 'warning'}>{turn.permissions?.ready ? 'Pronta' : 'Verificar'}</Pill></View>}<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', gap: 7 }}><Store size={16} color={colors.muted} /><Text style={[type.small, { color: colors.ink }]}>Vínculo com a loja</Text></View><Pill icon={Check}>Aprovado</Pill></View></View>}
    {(turn.error || turnAction.error) && <Feedback title="Confira seu turno" message={turnAction.error || turn.error || ''} onRetry={() => void turn.store.restore()} />}
  </AccountScreen>;
}

const linkStyles = StyleSheet.create({
  header: { marginBottom: 20 },
  welcome: { fontFamily: 'ManropeExtraBold', fontSize: 25, letterSpacing: -.7, marginTop: 6 },
  hero: { padding: 20, minHeight: 280 },
  copy: { width: '67%', marginTop: 20, zIndex: 1 },
  title: { fontFamily: 'ManropeExtraBold', fontSize: 34, lineHeight: 39, letterSpacing: -1.2 },
  description: { width: '85%', fontFamily: 'Manrope', fontSize: 12, lineHeight: 20, marginTop: 12 },
  helmet: { position: 'absolute', right: -34, top: 58 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: '#ffffff20', marginTop: 24, paddingTop: 16 },
  actionText: { flex: 1, fontFamily: 'ManropeExtraBold', fontSize: 13 },
  followUp: { gap: 12, marginTop: 20 },
});
