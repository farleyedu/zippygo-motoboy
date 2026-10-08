import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Lock, Map, Package, Store } from 'lucide-react-native';
import { MotoboyQueue, queueToPedidos, RouteStop } from '../../services/mobileApi';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useAuth } from '../contexts/AuthContext';
import { AccountScreen } from './AccountKit';
import { Button, Feedback, Gradient, Pill, Surface, type } from './Kit';
import { useZippyTheme } from './theme';
import Mapa from '../../components/Mapa';

export function activeStops(queue?: MotoboyQueue | null) { return queue ? [...(queue.current ? [queue.current] : []), ...queue.next] : []; }

export function RouteScreen({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const router = useRouter(), turn = useOperationalSession(), focused = useIsFocused();
  useEffect(() => { if (focused && turn.phase === 'offline') router.replace('/'); }, [turn.phase, focused, router]);
  return <AccountScreen active="map" footer={footer}>
    {turn.routeNotice && <Feedback title={turn.routeNotice.kind === 'cancelled' ? 'A loja cancelou um pedido' : 'Sua rota foi atualizada'} message="Confira a sequência atual antes de continuar." onRetry={() => { const notice = turn.routeNotice!; turn.clearRouteNotice(); router.push({ pathname: '/estadoRota', params: { tipo: notice.kind, pedidoId: String(notice.pedidoId || '') } }); }} />}
    {turn.busy && !turn.queue ? <Feedback title="Conferindo sua rota" loading /> : null}
    {turn.error && <Feedback title="Aguardando atualização do turno" message={turn.error} onRetry={() => void turn.store.refreshQueue()} />}
    {children}
  </AccountScreen>;
}

export function Helmet({ size = 180 }: { size?: number }) {
  const { reducedMotion } = useZippyTheme(), focused = useIsFocused(), offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!focused || reducedMotion) { offset.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([Animated.timing(offset, { toValue: 1, duration: 2800, useNativeDriver: true, isInteraction: false }), Animated.timing(offset, { toValue: 0, duration: 2800, useNativeDriver: true, isInteraction: false })]));
    loop.start(); return () => loop.stop();
  }, [focused, reducedMotion, offset]);
  return <Animated.Image source={require('../../assets/images/capacete-3d-azul.png')} accessibilityIgnoresInvertColors style={{ width: size, height: size, transform: [{ translateY: offset.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }, { rotate: offset.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '-4deg'] }) }] }} resizeMode="contain" />;
}

export function MiniRouteMap({ queue, caption }: { queue?: MotoboyQueue | null; caption: string }) {
  const router = useRouter(), turn = useOperationalSession(), { colors } = useZippyTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel="Abrir pedidos no mapa" onPress={() => router.push('/mapa')} style={{ height: 168, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
    {turn.permissions?.foreground.granted ? <View pointerEvents="none" style={{ flex: 1 }}><Mapa pedidos={queueToPedidos(queue || null)} emEntrega={!!queue?.current} /></View> : <View style={{ flex: 1, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Map size={32} color={colors.accent} /></View>}
    <View style={{ position: 'absolute', bottom: 12, left: 12, right: 12, borderRadius: 12, backgroundColor: '#14243ee8', padding: 10, flexDirection: 'row', gap: 7 }}><Map size={14} color="#cde3ff" /><Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#e5f0ff', flex: 1 }}>{caption}</Text></View>
  </Pressable>;
}

export function StopRow({ stop, index, checked, onCheck, right, onPress }: { stop: RouteStop; index: number; checked?: boolean; onCheck?: () => void; right?: React.ReactNode; onPress?: () => void }) {
  const { colors } = useZippyTheme(), router = useRouter();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 15, borderBottomWidth: 1, borderColor: colors.line }}>
    <Pressable accessibilityRole={onCheck ? 'checkbox' : 'button'} accessibilityLabel={onCheck ? `Conferir pedido ${stop.pedidoId}` : `Detalhes do pedido ${stop.pedidoId}`} accessibilityState={{ checked: !!checked }} onPress={onCheck || onPress || (() => router.push({ pathname: '/pedido/[id]', params: { id: String(stop.pedidoId) } }))} style={{ flexDirection: 'row', gap: 11, flex: 1, minHeight: 44, alignItems: 'center' }}>
      <View style={{ width: 32, height: 32, borderRadius: onCheck ? 10 : 11, borderWidth: 1, borderColor: checked ? colors.accent : colors.line, backgroundColor: checked ? colors.accent : colors.soft, alignItems: 'center', justifyContent: 'center' }}>{onCheck && checked ? <Check size={17} color={colors.paper} /> : <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.accent }}>{index + 1}</Text>}</View>
      <View style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.ink }}>#{stop.pedidoId} · {stop.pedido?.nomeCliente || 'Cliente'}</Text><Text numberOfLines={2} style={{ fontFamily: 'Manrope', fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: 4 }}>{onCheck ? stop.pickedUpAtUtc ? 'Retirada confirmada' : 'Confira o pedido e a embalagem' : stop.pedido?.enderecoEntrega || [stop.pedido?.rua, stop.pedido?.numero, stop.pedido?.bairro].filter(Boolean).join(' · ') || 'Confira o endereço com a loja'}</Text></View>
    </Pressable>
    {right || (stop.locked ? <Lock size={16} color={colors.muted} /> : onCheck ? <Package size={18} color={colors.accent} /> : <ChevronRight size={15} color={colors.muted} />)}
  </View>;
}

export function StoreCover({ count }: { count: number }) {
  const auth = useAuth(), { colors } = useZippyTheme();
  return <Surface hero style={{ padding: 21 }}><Text style={[type.eyebrow, { color: colors.heroMuted }]}>COLETA NO ESTABELECIMENTO</Text><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 23, color: colors.heroInk, letterSpacing: -.8, marginTop: 12 }}>{auth.estabelecimentoAtual?.nome}</Text><View style={{ marginTop: 9, flexDirection: 'row', gap: 7 }}><Store size={14} color={colors.heroMuted} /><Text style={{ fontFamily: 'Manrope', fontSize: 11, color: colors.heroMuted }}>{count} {count === 1 ? 'pedido para conferir' : 'pedidos para conferir'}</Text></View></Surface>;
}
