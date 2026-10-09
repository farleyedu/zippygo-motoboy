import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Expand, Layers, LocateFixed, Map, Navigation, Package, Route } from 'lucide-react-native';
import Mapa from '../components/Mapa';
import { queueToPedidos } from '../services/mobileApi';
import { openPreferredNavigation } from '../services/navigation';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../src/contexts/DeliveryCompletionContext';
import { AppNav } from '../src/ui/AccountKit';
import { Button, Pill, type } from '../src/ui/Kit';
import { StopRow } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';
import { StatusBar } from 'expo-status-bar';

export default function MapScreen() {
  const router = useRouter(), params = useLocalSearchParams<{ modo?: string }>(), turn = useOperationalSession(), insets = useSafeAreaInsets(), { colors, dark } = useZippyTheme();
  const [clean, setClean] = useState(false), [following, setFollowing] = useState(params.modo === 'rota'), [view3D, set3D] = useState(params.modo === 'rota'), [recenter, setRecenter] = useState(0), [error, setError] = useState('');
  const offset = useRef(new Animated.Value(0)).current, [expanded, setExpanded] = useState(false);
  const pan = useRef(PanResponder.create({ onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8, onPanResponderMove: (_, g) => offset.setValue(Math.max(-100, Math.min(90, g.dy))), onPanResponderRelease: (_, g) => { setExpanded(g.dy < -30); Animated.timing(offset, { toValue: 0, duration: 160, useNativeDriver: true }).start(); } })).current;
  const queue = turn.queue, current = queue?.current, pedidos = useMemo(() => queueToPedidos(queue), [queue]);
  const completion = useDeliveryCompletion();
  const openNavigation = async () => { try { await openPreferredNavigation({ latitude: current?.pedido?.latitude, longitude: current?.pedido?.longitude, address: current?.pedido?.enderecoEntrega || [current?.pedido?.rua, current?.pedido?.numero, current?.pedido?.cidade].filter(Boolean).join(', ') }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o navegador.'); } };
  const control = (label: string, Icon: typeof Map, action: () => void, active = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={action} style={({ pressed }) => ({ minHeight: 44, backgroundColor: active ? '#276ce0' : '#132742ed', borderWidth: 1, borderColor: '#6f9ee760', borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? .7 : 1 })}><Icon size={16} color="#e5f0ff" /><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 10, color: '#e5f0ff' }}>{label}</Text></Pressable>;
  return <View style={{ flex: 1, backgroundColor: colors.paper }}><StatusBar style={dark ? 'light' : 'dark'} />
    {turn.permissions?.foreground.granted ? <Mapa pedidos={pedidos} emEntrega={!!current} recenterToken={recenter} routeMode={following && !!current?.pickedUpAtUtc} mapClean={clean} view3D={view3D} onOrderPress={id => router.push({ pathname: '/pedido/[id]', params: { id: String(id) } })} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}><LocateFixed size={38} color={colors.accent} /><Text style={[type.body, { color: colors.muted, textAlign: 'center', marginTop: 16, marginBottom: 15 }]}>Permita a localização para ver sua posição no mapa.</Text><Button onPress={() => router.push('/permissoes')}>Preparar localização</Button></View>}
    {!clean && <>
      <View style={{ position: 'absolute', top: insets.top + 14, left: 16, right: 16, flexDirection: 'row', gap: 8 }}>{control('Voltar', ArrowLeft, () => router.canGoBack() ? router.back() : router.replace('/'))}<View style={{ flex: 1 }} />{control(view3D ? '2D' : '3D', Layers, () => set3D(v => !v))}{control('Centrar', LocateFixed, () => setRecenter(v => v + 1))}</View>
      <View style={{ position: 'absolute', top: insets.top + 69, left: 16, flexDirection: 'row', gap: 7 }}>{control('Só mapa', Expand, () => setClean(true))}{current && control(following ? 'Seguindo a rota' : 'Modo rota', Navigation, () => { if (!current.pickedUpAtUtc) { router.push('/retirada'); return; } setFollowing(v => !v); setRecenter(v => v + 1); }, following)}</View>
      {current?.pickedUpAtUtc && <View style={{ position: 'absolute', top: insets.top + 121, left: 16, right: 16, borderRadius: 17, backgroundColor: '#14243eef', padding: 15, flexDirection: 'row', gap: 12, alignItems: 'center' }}><Navigation size={26} color="#a9cdff" /><View style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: '#eff6ff' }}>Próxima entrega · #{current.pedidoId}</Text><Text numberOfLines={2} style={{ fontFamily: 'Manrope', fontSize: 10, lineHeight: 16, color: '#bed0eb', marginTop: 4 }}>{current.pedido?.enderecoEntrega || current.pedido?.rua || 'Confira o destino com a loja'}</Text></View></View>}
      <Animated.View style={{ position: 'absolute', bottom: insets.bottom + 90, left: 12, right: 12, borderRadius: 24, padding: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, boxShadow: '0 10px 32px #10203530', transform: [{ translateY: offset }] }}>
        <View {...pan.panHandlers} accessibilityLabel="Expandir lista de pedidos" style={{ height: 24, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 32, height: 4, borderRadius: 3, backgroundColor: colors.line }} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><Text style={[type.eyebrow, { color: colors.muted }]}>{current ? 'SEU CAMINHO AGORA' : 'SEU MAPA'}</Text><Pill icon={Package}>{`${pedidos.length} pedidos`}</Pill></View>
        {current ? <><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 23, letterSpacing: -.8, color: colors.ink }}>{current.pedido?.nomeCliente || `Pedido #${current.pedidoId}`}</Text><Text numberOfLines={2} style={[type.small, { color: colors.muted, marginTop: 5, marginBottom: 13 }]}>{current.pedido?.enderecoEntrega || 'Abra o pedido para conferir o endereço.'}</Text>{expanded && queue?.next.slice(0, 4).map((s, i) => <StopRow key={s.pedidoId} stop={s} index={i + 1} />)}<View style={{ gap: 9 }}><Button icon={current.pickedUpAtUtc ? Navigation : Package} onPress={() => current.pickedUpAtUtc ? void openNavigation() : router.push('/retirada')}>{current.pickedUpAtUtc ? 'Abrir navegador preferido' : 'Conferir retirada'}</Button><Button secondary icon={Route} onPress={() => router.push(current.pickedUpAtUtc ? { pathname: '/pedido/[id]', params: { id: String(current.pedidoId) } } : '/rota')}>{current.pickedUpAtUtc ? 'Cheguei · conferir pedido' : 'Organizar minha rota'}</Button></View></> : <><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 23, color: colors.ink }}>{queue?.routeState === 'returning' ? 'De volta à loja.' : 'Você encontra seu caminho.'}</Text><Text style={[type.small, { color: colors.muted, marginTop: 8 }]}>Sua posição e seus destinos no mesmo mapa.</Text>{queue?.offer && <Button onPress={() => router.push('/oferta')}>Conferir nova oferta</Button>}{queue?.routeState === 'returning' && <Button onPress={() => router.push('/retornoLoja')}>Acompanhar retorno</Button>}</>}
        {!!error && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger, marginTop: 10 }]}>{error}</Text>}
        {turn.routeNotice && <Pressable accessibilityRole="button" onPress={() => { const notice = turn.routeNotice!; turn.clearRouteNotice(); router.push({ pathname: '/estadoRota', params: { tipo: notice.kind, pedidoId: String(notice.pedidoId || '') } }); }} style={{ minHeight: 44, paddingTop: 9 }}><Text style={[type.small, { color: colors.warning }]}>{turn.routeNotice.kind === 'cancelled' ? 'Pedido cancelado pela loja · conferir' : 'Rota atualizada pela loja · conferir'}</Text></Pressable>}
        {turn.phase === 'reconnecting' && <Text style={[type.small, { color: colors.warning, marginTop: 10 }]}>Sem conexão confirmada · sua fila aguarda atualização.</Text>}
      </Animated.View>
      <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 15), left: 17, right: 17 }}><AppNav active="map" /></View>
    </>}
    {clean && <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 28), alignSelf: 'center' }}>{control('Mostrar controles', Layers, () => setClean(false))}</View>}
  </View>;
}
