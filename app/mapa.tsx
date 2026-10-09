import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronUp, Layers, LocateFixed, Map, MessageCircle, MoreHorizontal, Navigation, Package, Route, Store, X } from 'lucide-react-native';
import Mapa from '../components/Mapa';
import type { MapaProps } from '../components/mapTypes';
import { queueToPedidos } from '../services/mobileApi';
import { getStoreDestination, type StoreDestination } from '../services/routeApi';
import { openPreferredNavigation } from '../services/navigation';
import { nativeNavigationAvailable } from '../services/nativeNavigation';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { AppNav } from '../src/ui/AccountKit';
import { Button, Pill, type } from '../src/ui/Kit';
import { activeStops, StopRow } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';
import { StatusBar } from 'expo-status-bar';

export default function MapScreen() {
  const router = useRouter(), params = useLocalSearchParams<{ modo?: string; pedidoId?: string; destino?: string }>(), turn = useOperationalSession(), insets = useSafeAreaInsets(), focused = useIsFocused(), { colors, dark, reducedMotion } = useZippyTheme();
  const [clean, setClean] = useState(false), [following, setFollowing] = useState(params.modo === 'rota'), [view3D, set3D] = useState(true), [recenter, setRecenter] = useState(0), [error, setError] = useState(''), [menu, setMenu] = useState(false), [expanded, setExpanded] = useState(false), [selectedId, setSelectedId] = useState(Number(params.pedidoId) || 0), [store, setStore] = useState<StoreDestination | null>(null), [storeError, setStoreError] = useState(''), [retry, setRetry] = useState(0);
  const [navigation, setNavigation] = useState<Parameters<NonNullable<MapaProps['onNavigationState']>>[0]>({ status: 'loading' });
  const offset = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx), onPanResponderMove: (_, gesture) => offset.setValue(Math.max(-60, Math.min(60, gesture.dy))), onPanResponderRelease: (_, gesture) => { if (gesture.dy < -20) setExpanded(true); else if (gesture.dy > 20) setExpanded(false); Animated.timing(offset, { toValue: 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true }).start(); } }), [offset, reducedMotion]);
  const queue = turn.queue, current = queue?.current, stops = activeStops(queue), pedidos = useMemo(() => queueToPedidos(queue), [queue]);
  const selected = stops.find(s => s.pedidoId === selectedId) || current;
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
  const canRoute = nativeNavigationAvailable && (collecting ? !!collection : !!current);
  const handleMapPress = () => { setMenu(false); setClean(value => !value); };
  const openNavigation = () => {
    if (!nativeNavigationAvailable) { setError('A navegação dentro do app exige o novo build. Expo Go mostra o mapa, mas não contém o navegador.'); return; }
    if (collecting && !collection) { setError('Confira as coordenadas do estabelecimento antes de iniciar a rota da coleta.'); return; }
    setFollowing(true); setClean(false); setMenu(false); setExpanded(false); setRecenter(value => value + 1); setError('');
  };
  const externalNavigation = async () => {
    const destination = collecting ? { latitude: collection?.lat, longitude: collection?.lng, address: [store?.rua, store?.numero, store?.bairro, store?.cidade, store?.uf].filter(Boolean).join(', ') } : { latitude: current?.pedido?.latitude, longitude: current?.pedido?.longitude, address: current?.pedido?.enderecoEntrega };
    try { await openPreferredNavigation(destination); setMenu(false); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o navegador.'); }
  };
  const arrived = navigation.status === 'arrived';
  const destinationName = collecting ? store?.nome || 'Coleta no estabelecimento' : selected?.pedido?.nomeCliente || 'Aqui é seu ponto de partida.';
  const address = collecting ? [store?.rua, store?.numero, store?.bairro].filter(Boolean).join(', ') : selected?.pedido?.enderecoEntrega || [selected?.pedido?.rua, selected?.pedido?.numero, selected?.pedido?.bairro].filter(Boolean).join(', ');
  const control = (label: string, Icon: typeof Map, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={({ pressed }) => [styles.control, { opacity: pressed ? .7 : 1 }]}><Icon size={20} color="#e5f0ff" /></Pressable>;
  const openOrder = () => selected && router.push({ pathname: '/pedido/[id]', params: { id: String(selected.pedidoId) } });
  return <View style={{ flex: 1, backgroundColor: colors.paper }}>
    <Stack.Screen options={{ headerShown: false }} /><StatusBar style={dark ? 'light' : 'dark'} />
    {turn.permissions?.foreground.granted ? <Mapa pedidos={pedidos} emEntrega={!!current} recenterToken={recenter} retryToken={retry} sessionKey={turn.session?.sessionId} routeMode={following && canRoute} navigationEnabled={canRoute} collectionDestination={collecting ? collection : undefined} selectedPedidoId={selected?.pedidoId} mapClean={clean} view3D={view3D} onNavigationState={setNavigation} onMapPress={handleMapPress} onOrderPress={id => { setSelectedId(id); setClean(false); setExpanded(false); }} /> : <View style={styles.permission}><LocateFixed size={38} color={colors.accent} /><Text style={[type.body, { color: colors.muted, textAlign: 'center', marginVertical: 16 }]}>Permita a localização para ver sua posição no mapa.</Text><Button onPress={() => router.push('/permissoes')}>Preparar localização</Button></View>}
    {!clean && <>
      {!following && <View style={{ position: 'absolute', top: insets.top + 14, left: 16, right: 16, flexDirection: 'row', gap: 8 }}>
        {control('Voltar', ArrowLeft, () => router.canGoBack() ? router.back() : router.replace('/'))}
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir lista de paradas" onPress={() => setExpanded(v => !v)} style={[styles.search, { flex: 1 }]}><Route size={17} color="#a9cdff" /><Text numberOfLines={1} style={[type.small, { color: '#edf5ff', flex: 1 }]}>{collecting ? 'A caminho da coleta' : 'Sua rota · ' + stops.length + ' paradas'}</Text></Pressable>
        {control('Opções do mapa', MoreHorizontal, () => setMenu(v => !v))}
      </View>}
      <View style={{ position: 'absolute', right: 16, top: insets.top + (following ? 160 : 76), gap: 8 }}>{control('Centralizar minha posição', LocateFixed, () => setRecenter(v => v + 1))}{!following && control(view3D ? 'Ver mapa em 2D' : 'Ver mapa em 3D', Layers, () => set3D(v => !v))}{following && control('Opções da rota', MoreHorizontal, () => setMenu(v => !v))}</View>
      {menu && <View style={[styles.options, { top: insets.top + (following ? 206 : 68), backgroundColor: colors.card, borderColor: colors.line }]}>
        {[{ label: following ? 'Ver percurso completo' : 'Iniciar modo rota', icon: following ? Map : Navigation, action: () => { if (following) { setFollowing(false); setMenu(false); } else openNavigation(); } }, { label: 'Histórico de rotas', icon: Route, action: () => { setMenu(false); router.push('/historicoRotas'); } }, { label: 'Organizar pedidos', icon: Package, action: () => { setMenu(false); router.push('/rota'); } }, { label: 'Abrir navegador externo', icon: Navigation, action: () => void externalNavigation() }].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.action} style={styles.option}><item.icon size={18} color={colors.accent} /><Text style={[type.small, { color: colors.ink }]}>{item.label}</Text></Pressable>)}
      </View>}
      <Animated.View style={[styles.sheet, { bottom: Math.max(insets.bottom, 12) + (following ? 8 : 76), backgroundColor: colors.card, borderColor: colors.line, transform: [{ translateY: offset }] }]}>
        <View {...pan.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Recolher pedidos' : 'Expandir pedidos'} onPress={() => setExpanded(v => !v)} style={{ height: 22, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 34, height: 4, borderRadius: 3, backgroundColor: colors.line }} /></Pressable></View>
        <View style={styles.row}><View style={{ flex: 1 }}><Text style={[type.eyebrow, { color: colors.muted, fontSize: 9 }]}>{collecting ? 'COLETA · ESTABELECIMENTO' : selected?.pedidoId !== current?.pedidoId ? 'PEDIDO SELECIONADO' : arrived ? 'VOCÊ CHEGOU' : 'PRÓXIMA ENTREGA'}</Text><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 23, letterSpacing: -.8, color: colors.ink, marginTop: 4 }}>{collecting || !selected ? destinationName : 'Pedido #' + selected.pedidoId}</Text></View>{!collecting && selected && control('Detalhes do pedido ' + selected.pedidoId, Package, openOrder)}<Pill icon={collecting ? Store : Package}>{collecting ? String(stops.length) + ' pedidos' : selected?.position ? selected.position + 'ª parada' : 'Mapa'}</Pill></View>
        {!collecting && <Text numberOfLines={1} style={[type.body, { color: colors.ink, fontWeight: '800', marginTop: 4 }]}>{destinationName}</Text>}
        <Text numberOfLines={expanded ? 3 : 1} style={[type.small, { color: colors.muted, marginTop: 4 }]}>{address || 'Confira o endereço com a loja.'}</Text>
        {navigation.seconds != null && <View style={[styles.row, { marginTop: 10 }]}><Text style={{ fontFamily: 'ManropeExtraBold', color: colors.accent, fontSize: 16 }}>{Math.max(1, Math.ceil(navigation.seconds / 60))} min</Text><Text style={[type.small, { color: colors.muted }]}>{((navigation.meters || 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km · previsão até a parada</Text></View>}
        {expanded && <ScrollView style={{ maxHeight: 205, marginTop: 8 }}>{stops.map((stop, index) => <StopRow key={stop.pedidoId} stop={stop} index={index} onPress={() => { setSelectedId(stop.pedidoId); setExpanded(false); }} />)}</ScrollView>}
        {(current || collecting) && <View style={[styles.row, { marginTop: 13, alignItems: 'stretch' }]}><View style={{ flex: 1 }}><Button icon={arrived || following ? Package : Navigation} onPress={!collecting && selected?.pedidoId !== current?.pedidoId ? () => { setSelectedId(current?.pedidoId || 0); setRecenter(v => v + 1); } : arrived || following ? () => collecting ? router.push(queue?.routeState === 'returning' ? '/retornoLoja' : '/retirada') : openOrder() : openNavigation}>{!collecting && selected?.pedidoId !== current?.pedidoId ? 'Continuar para #' + current?.pedidoId : arrived || following ? collecting ? queue?.routeState === 'returning' ? 'Conferir retorno' : 'Conferir coleta' : 'Conferir pedido' : 'Iniciar modo rota'}</Button></View>{control('Conversar sobre a entrega', MessageCircle, () => router.push({ pathname: '/conversas', params: collecting ? { channel: 'store' } : { channel: 'client', pedidoId: String(current?.pedidoId || '') } }))}</View>}
        {(!current && !collecting) && <View style={{ marginTop: 12 }}><Button icon={Route} onPress={() => router.push(queue?.offer ? '/oferta' : '/rota')}>{queue?.offer ? 'Conferir nova oferta' : 'Ver minha rota'}</Button></View>}
        {!!(error || storeError || navigation.status === 'error') && <Pressable accessibilityRole="button" onPress={() => { setRetry(v => v + 1); setError(''); setRecenter(v => v + 1); }} style={{ paddingTop: 10 }}><Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error || storeError || navigation.message} · tentar novamente</Text></Pressable>}
        {navigation.status === 'rerouting' && <Text style={[type.small, { marginTop: 7, color: colors.accent }]}>Recalculando o caminho…</Text>}
        {turn.routeNotice && <Pressable accessibilityRole="button" onPress={() => { const notice = turn.routeNotice!; turn.clearRouteNotice(); router.push({ pathname: '/estadoRota', params: { tipo: notice.kind, pedidoId: String(notice.pedidoId || '') } }); }} style={{ minHeight: 44, paddingTop: 9 }}><Text style={[type.small, { color: colors.warning }]}>{turn.routeNotice.kind === 'cancelled' ? 'Pedido cancelado · conferir rota' : 'Rota atualizada · conferir paradas'}</Text></Pressable>}
        {turn.phase === 'reconnecting' && <Text style={[type.small, { color: colors.warning, marginTop: 8 }]}>Sem conexão confirmada · aguardando atualização.</Text>}
      </Animated.View>
      {!following && <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 12), left: 16, right: 16 }}><AppNav active="map" /></View>}
    </>}
    {clean && <Pressable accessibilityLabel="Mostrar controles do mapa" accessibilityRole="button" onPress={handleMapPress} style={{ position: 'absolute', right: 16, bottom: Math.max(insets.bottom, 20), minHeight: 44, minWidth: 44, borderRadius: 22, backgroundColor: '#132742dd', alignItems: 'center', justifyContent: 'center' }}><ChevronUp color="#e5f0ff" size={22} /></Pressable>}
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
