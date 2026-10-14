import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronUp, Layers, LocateFixed, Map, MessageCircle, MoreHorizontal, Navigation, Package, Route, Store, X } from 'lucide-react-native';
import Mapa from '../components/Mapa';
import type { MapaProps, NavigationState } from '../components/mapTypes';
import { NavigationChrome } from '../src/ui/NavigationChrome';
import { NavigationDiagnostics } from '../src/delivery/navigationDiagnostics';
import { arriveCurrent, queueToPedidos } from '../services/mobileApi';
import { getStoreDestination, type StoreDestination } from '../services/routeApi';
import { openGoogleMapsRoute, openPreferredNavigation } from '../services/navigation';
import { distanceMeters, type ExternalStop } from '../src/delivery/externalRoute';
import { nativeNavigationAvailable } from '../services/nativeNavigation';
import { navigationSdkEnabled } from '../services/navigationFlag';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { hasLocationDisclosureConsent } from '../services/locationDisclosureConsent';
import { AppNav } from '../src/ui/AccountKit';
import { Button, Pill, Surface, type } from '../src/ui/Kit';
import { activeStops, StopRow } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';
import { StatusBar } from 'expo-status-bar';
import { RouteDeck } from '../src/ui/RouteDeck';
import { OperationalNotice } from '../src/ui/OperationalNotice';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { readNavigatorChoice, saveNavigatorChoice } from '../src/delivery/navigationChoice';
import { stopNavigationAddress } from '../src/delivery/offerDetails';
import { canStartOperationalNavigation, operationalDestination, operationalStage } from '../src/delivery/operationalDestination';
import { useDeliveryCompletion } from '../src/contexts/DeliveryCompletionContext';

const ARRIVAL_RADIUS_M = 300;

export default function MapScreen() {
  const router = useRouter(), params = useLocalSearchParams<{ modo?: string; pedidoId?: string; destino?: string; navegar?: string }>(), turn = useOperationalSession(), insets = useSafeAreaInsets(), focused = useIsFocused(), theme = useZippyTheme(), { colors, dark, reducedMotion } = theme;
  const [clean, setClean] = useState(false), [following, setFollowing] = useState(params.modo === 'rota' && Platform.OS !== 'web'), [view3D, set3D] = useState(true), [recenter, setRecenter] = useState(0), [error, setError] = useState(''), [menu, setMenu] = useState(false), [expanded, setExpanded] = useState(false), [selectedId, setSelectedId] = useState(Number(params.pedidoId) || 0), [store, setStore] = useState<StoreDestination | null>(null), [storeError, setStoreError] = useState(''), [retry, setRetry] = useState(0), [chooser, setChooser] = useState(false);
  const [navigation, setNavigation] = useState<Parameters<NonNullable<MapaProps['onNavigationState']>>[0]>({ status: 'loading' });
  const [cameraFollowing, setCameraFollowing] = useState(true), [navigationMuted, setNavigationMuted] = useState(false), [footerInset, setFooterInset] = useState(154);
  const [deck, setDeck] = useState(false), [overview, setOverview] = useState(0);
  const orderAction = useRouteAction();
  const completion = useDeliveryCompletion();
  const windowSize = useWindowDimensions();
  const deckHeight = Math.max(260, Math.min(600, (windowSize.height - insets.top - insets.bottom) * .64));
  const openDeck = () => { setDeck(true); setSelectedId(0); setCameraFollowing(false); setOverview(v => v + 1); setMenu(false); };
  const closeDeck = () => { setDeck(false); setSelectedId(0); if (following) { setCameraFollowing(true); setRecenter(v => v + 1); } };
  const observeNavigation = (state: NavigationState) => setNavigation(previous => ({ ...previous, ...state, message: state.message }));
  const offset = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx), onPanResponderMove: (_, gesture) => offset.setValue(Math.max(-60, Math.min(60, gesture.dy))), onPanResponderRelease: (_, gesture) => { if (gesture.dy < -20) setExpanded(true); else if (gesture.dy > 20) setExpanded(false); Animated.timing(offset, { toValue: 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true }).start(); } }), [offset, reducedMotion]);
  const queue = turn.queue, current = queue?.current, stops = activeStops(queue), pedidos = useMemo(() => queueToPedidos(queue), [queue]);
  const navigationAllowed = canStartOperationalNavigation(queue);
  const navigationEntry = navigationAllowed ? following ? 'Ver percurso completo' : 'Iniciar modo rota' : operationalStage(queue) === 'finish' ? 'Conferir entrega' : operationalStage(queue) === 'pickup' ? 'Conferir retirada' : 'Voltar ao início';
  useEffect(() => {
    if (!focused || !queue || turn.busy) return;
    if (!navigationAllowed) {
      setFollowing(false); setChooser(false);
      // Logo após "saí da loja" a fila local ainda está na retirada: manter o pedido de escolha até ela atualizar.
      const waitingPickup = params.navegar === 'escolher' && operationalStage(queue) === 'pickup';
      if ((params.modo || params.navegar) && !waitingPickup) router.setParams({ modo: undefined, navegar: undefined });
    } else if (params.modo === 'rota' && Platform.OS !== 'web') setFollowing(true);
  }, [focused, navigationAllowed, queue?.version, turn.busy, params.modo, params.navegar]);
  useEffect(() => {
    if (focused && params.navegar === 'escolher' && current?.pickedUpAtUtc) {
      setFollowing(false); setChooser(true); router.setParams({ navegar: undefined, modo: undefined });
    }
  }, [focused, params.navegar, current?.pickedUpAtUtc]);
  const selected = stops.find(s => s.pedidoId === selectedId) || current;
  useEffect(() => {
    const sessionId = turn.session?.sessionId;
    if (!focused || !sessionId || params.navegar === 'escolher' || !current?.pickedUpAtUtc || Platform.OS === 'web') return;
    let alive = true;
    void readNavigatorChoice(sessionId).then(choice => { if (alive && canStartOperationalNavigation(turn.store.getSnapshot().queue) && choice === 'ZippyGo' && nativeNavigationAvailable && navigationSdkEnabled) setFollowing(true); });
    return () => { alive = false; };
  }, [focused, turn.session?.sessionId, !!current?.pickedUpAtUtc]);
  const collecting = !!current && !current.pickedUpAtUtc || queue?.routeState === 'returning' || !current && params.destino === 'loja';
  useEffect(() => { setSelectedId(Number(params.pedidoId) || 0); }, [params.pedidoId]);
  useEffect(() => {
    if (!focused || !collecting || !turn.session) return;
    const controller = new AbortController(); let alive = true; setStore(null); setStoreError('');
    void getStoreDestination(controller.signal).then(value => { if (alive) setStore(value); }).catch(e => { if (alive) setStoreError(e instanceof Error ? e.message : 'Não foi possível carregar o endereço da coleta.'); });
    return () => { alive = false; controller.abort(); };
  }, [focused, collecting, turn.session?.sessionId, retry]);
  const latitude = store?.latitude == null ? NaN : Number(store.latitude), longitude = store?.longitude == null ? NaN : Number(store.longitude);
  const collection = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { lat: latitude, lng: longitude } : undefined;
  const canRoute = navigationAllowed && navigationSdkEnabled && nativeNavigationAvailable && (collecting ? !!collection : !!current);
  const retryLog = useRef(new NavigationDiagnostics(__DEV__));
  const retryNavigation = () => {
    retryLog.current.event('retry.request', { nextRetry: retry + 1, foregroundGranted: !!turn.permissions?.foreground.granted, nativeNavigationAvailable, canRoute, collecting, hasDestination: collecting ? !!collection : !!current });
    if (!turn.permissions?.foreground.granted) { retryLog.current.event('retry.blocked', { reason: 'foreground_permission' }, true); router.push({ pathname: '/permissoes', params: { intent: 'review', returnTo: '/mapa' } }); return; }
    if (!nativeNavigationAvailable) { retryLog.current.event('retry.blocked', { reason: 'native_sdk_unavailable' }, true); return; }
    if (!collecting && !current) { retryLog.current.event('retry.blocked', { reason: 'no_active_destination' }, true); return; }
    setRetry(value => value + 1); setError(''); setNavigation({ status: 'loading', message: collecting && !collection ? 'Carregando o endereço da coleta…' : 'Preparando uma nova tentativa…' });
  };
  const handleMapPress = () => { if (following) return; setMenu(false); setClean(value => !value); };
  const guardNavigation = () => {
    try { completion.assertRouteMutationAllowed(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Confira a conclusão pendente.'); return false; }
    const state = turn.store.getSnapshot();
    if (!state.session || !['online', 'reconnecting'].includes(state.phase) || !state.queue) { setError('Aguarde a confirmação do turno e da fila.'); return false; }
    if (!canStartOperationalNavigation(state.queue)) {
      setFollowing(false); setChooser(false); setMenu(false);
      router.setParams({ modo: undefined, navegar: undefined });
      router.replace(operationalDestination(state.queue, Platform.OS));
      return false;
    }
    return true;
  };
  const openNavigation = () => { if (guardNavigation()) { setMenu(false); setChooser(true); } };
  const startInApp = () => {
    if (!guardNavigation()) return;
    setChooser(false);
    if (!nativeNavigationAvailable) { setError('A navegação dentro do app exige o novo build. Expo Go mostra o mapa, mas não contém o navegador.'); return; }
    if (collecting && !collection) { setError('Confira as coordenadas do estabelecimento antes de iniciar a rota da coleta.'); return; }
    router.setParams({ modo: 'rota' });
    void saveNavigatorChoice(turn.session?.sessionId, 'ZippyGo').catch(() => setError('Não foi possível salvar a escolha de navegação.'));
    setFollowing(true); setCameraFollowing(true); setNavigation({ status: 'loading', message: 'Preparando o GPS e a navegação…' }); setClean(false); setMenu(false); setExpanded(false); setRecenter(value => value + 1); setError('');
  };
  // Depois de mandar a rota ao Maps/Waze, ao voltar perto da parada o app já abre na tela de encerrar.
  const sentOut = useRef(false), onReturn = useRef<() => Promise<void>>(async () => {});
  onReturn.current = async () => {
    const lat = Number(current?.pedido?.latitude), lng = Number(current?.pedido?.longitude);
    const target = collecting ? collection : Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
    if (!target || !(await hasLocationDisclosureConsent())) return;
    try { const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); if (distanceMeters({ lat: here.coords.latitude, lng: here.coords.longitude }, target) > ARRIVAL_RADIUS_M) return; } catch { return; }
    sentOut.current = false;
    if (collecting) router.push(queue?.routeState === 'returning' ? '/retornoLoja' : '/retirada');
    else if (current) checkOrder(current.pedidoId);
  };
  useEffect(() => {
    if (!focused) return;
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && sentOut.current) void onReturn.current(); });
    return () => subscription.remove();
  }, [focused]);
  const externalNavigation = async () => {
    if (!guardNavigation()) return;
    const destination = collecting ? { latitude: collection?.lat, longitude: collection?.lng, address: [store?.rua, store?.numero, store?.bairro, store?.cidade, store?.uf].filter(Boolean).join(', ') } : { latitude: current?.pedido?.latitude, longitude: current?.pedido?.longitude, address: current?.pedido?.enderecoEntrega };
    try { await openPreferredNavigation(destination); sentOut.current = true; setMenu(false); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o navegador.'); }
  };
  const routeStops: ExternalStop[] = collecting ? [{ latitude: collection?.lat, longitude: collection?.lng, address: [store?.rua, store?.numero, store?.bairro, store?.cidade, store?.uf].filter(Boolean).join(', ') }] : stops.map(stop => ({ latitude: stop.pedido?.latitude, longitude: stop.pedido?.longitude, address: stopNavigationAddress(stop) }));
  const sendToGoogleMaps = async () => {
    if (!guardNavigation()) return;
    void theme.setPreference('navigationApp', 'Google Maps');
    try {
      const route = await openGoogleMapsRoute(routeStops); sentOut.current = true; setChooser(false); setFollowing(false); router.setParams({ modo: undefined }); void saveNavigatorChoice(turn.session?.sessionId, 'Google Maps');
      if (route.remaining || route.skipped) setError(route.remaining ? 'O Google Maps recebeu as primeiras ' + route.sent + ' paradas. Envie a rota de novo depois para continuar.' : route.skipped + (route.skipped === 1 ? ' parada sem endereço ficou de fora.' : ' paradas sem endereço ficaram de fora.'));
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o Google Maps.'); }
  };
  const sendToWaze = async () => {
    if (!guardNavigation()) return;
    void theme.setPreference('navigationApp', 'Waze');
    const next = routeStops[0];
    if (!next) { setError('Aguarde a atualização do endereço da parada.'); return; }
    try { await openPreferredNavigation(next, 'Waze'); sentOut.current = true; setChooser(false); setFollowing(false); router.setParams({ modo: undefined }); void saveNavigatorChoice(turn.session?.sessionId, 'Waze'); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o Waze.'); }
  };
  const arrived = navigation.status === 'arrived';
  const destinationName = collecting ? store?.nome || 'Coleta no estabelecimento' : selected?.pedido?.nomeCliente || 'Aqui é seu ponto de partida.';
  const address = collecting ? [store?.rua, store?.numero, store?.bairro].filter(Boolean).join(', ') : selected?.pedido?.enderecoEntrega || [selected?.pedido?.rua, selected?.pedido?.numero, selected?.pedido?.bairro].filter(Boolean).join(', ');
  const navigationAddress = collecting ? address : current?.pedido?.enderecoEntrega || [current?.pedido?.rua, current?.pedido?.numero, current?.pedido?.bairro].filter(Boolean).join(', ');
  const routeState: NavigationState = !turn.permissions?.foreground.granted
    ? { status: 'error', message: 'Permita a localização do aparelho para iniciar a navegação.' }
    : !nativeNavigationAvailable
    ? { status: 'error', message: 'A navegação exige um build nativo com o Google Navigation SDK. Expo Go e navegador exibem apenas o mapa.' }
    : !current && !collecting ? { status: 'error', message: 'Não há um endereço ativo para navegar. Confira sua rota.' }
    : error || storeError ? { status: 'error', message: error || storeError } : navigation;
  const control = (label: string, Icon: typeof Map, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={({ pressed }) => [styles.control, { opacity: pressed ? .7 : 1 }]}><Icon size={20} color="#e5f0ff" /></Pressable>;
  const openOrder = () => selected && router.push({ pathname: '/pedido/[id]', params: { id: String(selected.pedidoId) } });
  const checkOrder = (id: number) => {
    const stop = turn.store.getSnapshot().queue?.current;
    if (stop?.pedidoId !== id) return;
    if (!stop.pickedUpAtUtc) { router.push('/retirada'); return; }
    const finish = () => router.push({ pathname: '/confirmacaoEntrega', params: { id: String(id) } });
    if (stop.arrivedAtUtc) { finish(); return; }
    void orderAction.run(() => arriveCurrent(id), updated => {
      if (updated.current?.pedidoId === id && updated.current.arrivedAtUtc) finish();
    });
  };
  const openChecks = () => collecting ? router.push(queue?.routeState === 'returning' ? '/retornoLoja' : '/retirada') : selected?.pedidoId === current?.pedidoId && current ? checkOrder(current.pedidoId) : openOrder();
  return <View style={{ flex: 1, backgroundColor: colors.paper }}>
    <Stack.Screen options={{ headerShown: false }} /><StatusBar style={dark ? 'light' : 'dark'} />
    {turn.permissions?.foreground.granted ? <Mapa pedidos={pedidos} emEntrega={!!current} recenterToken={recenter} retryToken={retry} sessionKey={turn.session?.sessionId} routeMode={following && canRoute} navigationEnabled={following && canRoute} collectionDestination={collecting ? collection : undefined} selectedPedidoId={deck ? selectedId || undefined : selected?.pedidoId} routePreview={deck} overviewToken={overview} mapClean={deck ? false : following ? false : clean} view3D={view3D} cameraFollowing={cameraFollowing} navigationMuted={navigationMuted} navigationBottomInset={deck ? deckHeight + Math.max(insets.bottom, 12) : following ? footerInset : 0} onCameraExplore={() => setCameraFollowing(false)} onNavigationState={observeNavigation} onMapPress={handleMapPress} onOrderPress={id => { setDeck(true); setCameraFollowing(false); setSelectedId(id); setClean(false); setExpanded(false); }} /> : <View style={styles.permission}><LocateFixed size={38} color={colors.accent} /><Text style={[type.body, { color: colors.muted, textAlign: 'center', marginVertical: 16 }]}>Permita a localização para ver sua posição no mapa.</Text><Button onPress={() => router.push({ pathname: '/permissoes', params: { intent: 'review', returnTo: '/mapa' } })}>Preparar localização</Button></View>}
    {following && !deck && <NavigationChrome state={routeState} address={navigationAddress} following={cameraFollowing} muted={navigationMuted} top={insets.top} bottom={Math.max(insets.bottom, 8)} footerInset={footerInset} stops={stops.length} destinationName={collecting ? destinationName : current?.pedido?.nomeCliente || undefined} stopIndex={collecting ? 1 : Math.max(1, stops.findIndex(stop => stop.pedidoId === current?.pedidoId) + 1)} onRoute={openDeck}
      onCenter={() => { setCameraFollowing(true); setRecenter(value => value + 1); }}
      onMute={() => setNavigationMuted(value => !value)}
      onExit={() => { setFollowing(false); router.setParams({ modo: undefined }); void saveNavigatorChoice(turn.session?.sessionId, 'map'); setClean(false); setCameraFollowing(true); setMenu(false); setNavigation({ status: 'loading' }); }}
      onChooseNavigation={openNavigation}
      onRetry={retryNavigation}
      onHeight={height => setFooterInset(previous => Math.abs(previous - height) < 1 ? previous : height)} />}
    {!clean && !following && !deck && <>
      {!following && <View style={{ position: 'absolute', top: insets.top + 14, left: 16, right: 16, flexDirection: 'row', gap: 8 }}>
        {control('Voltar', ArrowLeft, () => router.canGoBack() ? router.back() : router.replace('/'))}
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir lista de paradas" onPress={openDeck} style={[styles.search, { flex: 1 }]}><Route size={17} color="#a9cdff" /><Text numberOfLines={1} style={[type.small, { color: '#edf5ff', flex: 1 }]}>{collecting ? 'A caminho da coleta' : 'Sua rota · ' + stops.length + ' paradas'}</Text></Pressable>
        {control('Opções do mapa', MoreHorizontal, () => setMenu(v => !v))}
      </View>}
      <View style={{ position: 'absolute', right: 16, top: insets.top + (following ? 160 : 76), gap: 8 }}>{control('Centralizar minha posição', LocateFixed, () => setRecenter(v => v + 1))}{!following && control(view3D ? 'Ver mapa em 2D' : 'Ver mapa em 3D', Layers, () => set3D(v => !v))}{following && control('Opções da rota', MoreHorizontal, () => setMenu(v => !v))}</View>
      {menu && <View style={[styles.options, { top: insets.top + (following ? 206 : 68), backgroundColor: colors.card, borderColor: colors.line }]}>
        {[{ label: navigationEntry, icon: following ? Map : Navigation, action: () => { if (!navigationAllowed) { setMenu(false); router.replace(operationalDestination(turn.store.getSnapshot().queue, Platform.OS)); } else if (following) { setFollowing(false); setMenu(false); } else openNavigation(); } }, { label: 'Histórico de rotas', icon: Route, action: () => { setMenu(false); router.push('/historicoRotas'); } }, { label: 'Organizar pedidos', icon: Package, action: () => { setMenu(false); router.push('/rota'); } }, ...(navigationAllowed ? [{ label: 'Abrir navegador externo', icon: Navigation, action: () => void externalNavigation() }] : [])].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.action} style={styles.option}><item.icon size={18} color={colors.accent} /><Text style={[type.small, { color: colors.ink }]}>{item.label}</Text></Pressable>)}
      </View>}
      <Animated.View style={[styles.sheet, { bottom: Math.max(insets.bottom, 12) + (following ? 8 : 76), backgroundColor: colors.card, borderColor: colors.line, transform: [{ translateY: offset }] }]}>
        <OperationalNotice onInspectRoute={openDeck} />
        <Pressable accessibilityRole="button" accessibilityLabel="Ver rota completa e detalhes dos pedidos" onPress={openDeck} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Route size={17} color={colors.accent} /><Text style={[type.small, { color: colors.accent, flex: 1 }]}>{`Sua rota · ${stops.length} pedidos`}</Text><ChevronUp size={18} color={colors.accent} /></Pressable>
        <View {...pan.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Recolher pedidos' : 'Expandir pedidos'} onPress={() => setExpanded(v => !v)} style={{ height: 22, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 34, height: 4, borderRadius: 3, backgroundColor: colors.line }} /></Pressable></View>
        <View style={styles.row}><View style={{ flex: 1 }}><Text style={[type.eyebrow, { color: colors.muted, fontSize: 9 }]}>{collecting ? 'COLETA · ESTABELECIMENTO' : selected?.pedidoId !== current?.pedidoId ? 'PEDIDO SELECIONADO' : arrived ? 'VOCÊ CHEGOU' : 'PRÓXIMA ENTREGA'}</Text><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 23, letterSpacing: -.8, color: colors.ink, marginTop: 4 }}>{collecting || !selected ? destinationName : 'Pedido #' + selected.pedidoId}</Text></View>{!collecting && selected && control('Detalhes do pedido ' + selected.pedidoId, Package, openOrder)}<Pill icon={collecting ? Store : Package}>{collecting ? String(stops.length) + ' pedidos' : selected?.position ? selected.position + 'ª parada' : 'Mapa'}</Pill></View>
        {!collecting && <Text numberOfLines={1} style={[type.body, { color: colors.ink, fontWeight: '800', marginTop: 4 }]}>{destinationName}</Text>}
        <Text numberOfLines={expanded ? 3 : 1} style={[type.small, { color: colors.muted, marginTop: 4 }]}>{address || 'Confira o endereço com a loja.'}</Text>
        {navigation.seconds != null && <View style={[styles.row, { marginTop: 10 }]}><Text style={{ fontFamily: 'ManropeExtraBold', color: colors.accent, fontSize: 16 }}>{Math.max(1, Math.ceil(navigation.seconds / 60))} min</Text><Text style={[type.small, { color: colors.muted }]}>{((navigation.meters || 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km · previsão até a parada</Text></View>}
        {expanded && <ScrollView style={{ maxHeight: 205, marginTop: 8 }}>{stops.map((stop, index) => <StopRow key={stop.pedidoId} stop={stop} index={index} onPress={() => { setSelectedId(stop.pedidoId); setExpanded(false); }} />)}</ScrollView>}
        {(current || collecting) && <View style={[styles.row, { marginTop: 13, alignItems: 'stretch' }]}><View style={{ flex: 1 }}><Button icon={arrived || following ? Package : Navigation} onPress={!collecting && selected?.pedidoId !== current?.pedidoId ? () => { setSelectedId(current?.pedidoId || 0); setRecenter(v => v + 1); } : arrived || following ? () => collecting ? router.push(queue?.routeState === 'returning' ? '/retornoLoja' : '/retirada') : openChecks() : openNavigation}>{!collecting && selected?.pedidoId !== current?.pedidoId ? 'Continuar para #' + current?.pedidoId : arrived || following ? collecting ? queue?.routeState === 'returning' ? 'Conferir retorno' : 'Conferir coleta' : 'Conferir pedido' : 'Iniciar modo rota'}</Button></View>{control('Conversar sobre a entrega', MessageCircle, () => router.push({ pathname: '/conversas', params: collecting ? { channel: 'store' } : { channel: 'client', pedidoId: String(current?.pedidoId || '') } }))}</View>}
        {(!current && !collecting) && <View style={{ marginTop: 12 }}><Button icon={Route} onPress={() => router.push(queue?.offer ? '/oferta' : '/rota')}>{queue?.offer ? 'Conferir nova oferta' : 'Ver minha rota'}</Button></View>}
        {Platform.OS === 'web' && (collecting || !!current && selected?.pedidoId === current.pedidoId) && <View style={{ marginTop: 10 }}><Button secondary icon={collecting ? Store : Package} onPress={openChecks}>{collecting ? queue?.routeState === 'returning' ? 'Conferir retorno' : 'Conferir coleta' : 'Conferir pedido'}</Button></View>}
        {!!(error || storeError || navigation.status === 'error') && <Pressable accessibilityRole="button" onPress={() => { setRetry(v => v + 1); setError(''); setRecenter(v => v + 1); }} style={{ paddingTop: 10 }}><Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error || storeError || navigation.message} · tentar novamente</Text></Pressable>}
        {navigation.status === 'rerouting' && <Text style={[type.small, { marginTop: 7, color: colors.accent }]}>Recalculando o caminho…</Text>}
        {!!orderAction.error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger, marginTop: 8 }]}>{orderAction.error}</Text>}
        {turn.phase === 'reconnecting' && <Text style={[type.small, { color: colors.warning, marginTop: 8 }]}>Sem conexão confirmada · aguardando atualização.</Text>}
      </Animated.View>
      {!following && <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 12), left: 16, right: 16 }}><AppNav active="map" /></View>}
    </>}
    <Modal transparent visible={chooser} animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setChooser(false)}><View style={{ flex: 1, backgroundColor: '#081426bb', justifyContent: 'center', padding: 22 }}><Surface style={{ maxHeight: '92%', padding: 0 }}><ScrollView style={{ flexShrink: 1, minHeight: 0 }} contentContainerStyle={{ padding: 20 }}>
      <Text style={[type.title, { color: colors.ink, marginBottom: 16 }]}>Como você quer navegar?</Text>
      {!!error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger, marginBottom: 12 }]}>{error}</Text>}
      <View style={{ gap: 12 }}>
        {navigationSdkEnabled && nativeNavigationAvailable && <Button icon={Navigation} onPress={startInApp}>Navegar no ZippyGo</Button>}
        <Button secondary={navigationSdkEnabled && nativeNavigationAvailable} icon={Map} onPress={() => void sendToGoogleMaps()}>Google Maps</Button>
        <Button secondary icon={Navigation} onPress={() => void sendToWaze()}>Waze</Button>
        <Button secondary icon={X} onPress={() => setChooser(false)}>Cancelar</Button>
      </View>
    </ScrollView></Surface></View></Modal>
    <RouteDeck open={deck} height={deckHeight} bottom={Math.max(insets.bottom, 12)} stops={stops} selectedId={selectedId} onSelect={id => { orderAction.clear(); setSelectedId(id); }} onClose={closeDeck} onOverview={() => { orderAction.clear(); setSelectedId(0); setOverview(v => v + 1); }} onOrder={checkOrder} busy={orderAction.busy} actionError={orderAction.error} />
    {clean && !following && <Pressable accessibilityLabel="Mostrar controles do mapa" accessibilityRole="button" onPress={handleMapPress} style={{ position: 'absolute', right: 16, bottom: Math.max(insets.bottom, 20), minHeight: 44, minWidth: 44, borderRadius: 22, backgroundColor: '#132742dd', alignItems: 'center', justifyContent: 'center' }}><ChevronUp color="#e5f0ff" size={22} /></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  control: { width: 44, minHeight: 44, backgroundColor: '#132742ed', borderWidth: 1, borderColor: '#6f9ee750', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 44, borderRadius: 14, backgroundColor: '#132742ed', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13 },
  sheet: { position: 'absolute', left: 12, right: 12, borderRadius: 23, paddingHorizontal: 17, paddingTop: 4, paddingBottom: 16, borderWidth: 1, boxShadow: '0 10px 32px #10203530' },
  options: { position: 'absolute', right: 16, borderRadius: 17, borderWidth: 1, padding: 7, boxShadow: '0 10px 30px #10203530', zIndex: 5 },
  option: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
});
