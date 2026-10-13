import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bike, Check, ChevronUp, LocateFixed, MapPin, Navigation, Route, Volume2, VolumeX } from 'lucide-react-native';
import type { NavigationState } from '../../components/mapTypes';
import { journeySummary } from '../delivery/navigationJourney';
import { NavigationDiagnostics } from '../delivery/navigationDiagnostics';
import { useZippyTheme } from './theme';
import { OperationalNotice } from './OperationalNotice';

type Props = {
  state: NavigationState;
  address: string;
  following: boolean;
  muted: boolean;
  top: number;
  bottom: number;
  footerInset: number;
  onCenter(): void;
  onMute(): void;
  onExit(): void;
  onRetry(): void;
  onChooseNavigation(): void;
  onHeight(height: number): void;
  stops: number;
  onRoute(): void;
  /** Cliente/loja do destino atual e posição na sequência, quando conhecidos. */
  destinationName?: string;
  stopIndex?: number;
};

/** Anéis que se expandem: indicam que o app está trabalhando sem um spinner. */
function Pulse({ children, tone }: { children: React.ReactNode; tone: string }) {
  const { reducedMotion } = useZippyTheme(), wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(Animated.timing(wave, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }));
    loop.start(); return () => { loop.stop(); wave.setValue(0); };
  }, [reducedMotion, wave]);
  const ring = (offset: number) => ({ position: 'absolute' as const, width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: tone, opacity: wave.interpolate({ inputRange: [0, offset, 1], outputRange: [0, .55, 0], extrapolate: 'clamp' }), transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }] });
  return <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>{!reducedMotion && <><Animated.View style={ring(.18)} /><Animated.View style={[ring(.5), { opacity: wave.interpolate({ inputRange: [0, .5, 1], outputRange: [0, 0, .4] }) }]} /></>}{children}</View>;
}

/** Barra do percurso: a moto avança conforme a distância restante diminui. */
function Journey({ meters, arrived }: { meters?: number; arrived: boolean }) {
  const { colors, reducedMotion } = useZippyTheme(), start = useRef<number | null>(null), progress = useRef(new Animated.Value(0)).current, [width, setWidth] = useState(0);
  if (meters != null && Number.isFinite(meters) && (start.current == null || meters > start.current)) start.current = meters;
  useEffect(() => {
    const value = arrived ? 1 : meters != null && start.current ? Math.max(0, Math.min(1, 1 - meters / start.current)) : 0;
    if (reducedMotion) progress.setValue(value); else Animated.timing(progress, { toValue: value, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [meters, arrived, reducedMotion, progress]);
  const travel = Math.max(0, width - 26);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: 26, justifyContent: 'center', marginTop: 12 }}>
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' }}><Animated.View style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 3, transform: [{ scaleX: progress }], transformOrigin: 'left' } as never} /></View>
    <Animated.View style={{ position: 'absolute', left: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: arrived ? colors.success : colors.accent, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #2872e355', transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) }] }}>{arrived ? <Check size={14} color="#fff" strokeWidth={3} /> : <Bike size={14} color="#fff" />}</Animated.View>
  </View>;
}

// Only travel information here. Pickup/delivery checks stay in their own flow.
export function NavigationChrome(props: Props) {
  const retryLog = React.useRef(new NavigationDiagnostics(__DEV__));
  const { colors, reducedMotion } = useZippyTheme();
  const { state } = props;
  const summary = journeySummary(state.seconds, state.meters);
  const active = state.status === 'guiding' || state.status === 'rerouting';
  const arrived = state.status === 'arrived';
  const error = state.status === 'error';
  const SoundIcon = props.muted ? VolumeX : Volume2;
  const enter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current, pop = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (!reducedMotion) Animated.spring(enter, { toValue: 1, damping: 20, stiffness: 170, useNativeDriver: true }).start(); }, [enter, reducedMotion]);
  // A previsão dá um pequeno "pulso" quando muda, para o olho perceber que foi atualizada.
  const previous = useRef(summary.duration);
  useEffect(() => {
    if (previous.current === summary.duration || reducedMotion) { previous.current = summary.duration; return; }
    previous.current = summary.duration;
    Animated.sequence([Animated.timing(pop, { toValue: 1.1, duration: 110, useNativeDriver: true }), Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true })]).start();
  }, [summary.duration, reducedMotion, pop]);
  const total = Math.max(props.stops, 1), index = Math.min(Math.max((props.stopIndex ?? 1), 1), total);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {(!active || arrived) && <View accessibilityLiveRegion="polite" style={[styles.prepare, { top: props.top + 12, backgroundColor: colors.hero, borderColor: colors.line }]}>
      <View style={styles.row}>
        {error || arrived ? <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#ffffff1f', alignItems: 'center', justifyContent: 'center' }}>{arrived ? <Check color={colors.heroInk} size={24} strokeWidth={2.6} /> : <Navigation color={colors.heroInk} size={24} />}</View>
          : <Pulse tone="#9bc4ff"><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff1f', alignItems: 'center', justifyContent: 'center' }}><Navigation color={colors.heroInk} size={20} /></View></Pulse>}
        <Text style={[styles.title, { color: colors.heroInk }]}>{error ? 'Navegação indisponível' : arrived ? 'Você chegou ao endereço' : 'Preparando seu caminho'}</Text>
      </View>
      <Text numberOfLines={2} style={[styles.address, { color: colors.heroMuted }]}>{props.address || 'Aguardando o endereço de destino'}</Text>
      {!!state.message && <Text style={[styles.small, { color: colors.heroMuted }]}>{state.message}</Text>}
      {error && <Pressable accessibilityRole="button" onPressIn={() => retryLog.current.event('retry.touch')} onPress={() => { retryLog.current.event('retry.press'); props.onRetry(); }} style={styles.retry}><Text style={[styles.small, { color: colors.heroInk, fontFamily: 'ManropeExtraBold' }]}>Tentar novamente</Text></Pressable>}
      {(!active && !arrived) && <Pressable accessibilityRole="button" onPress={props.onChooseNavigation} style={styles.retry}><Text style={[styles.small, { color: colors.heroInk, fontFamily: 'ManropeExtraBold' }]}>Escolher outro navegador</Text></Pressable>}
    </View>}
    <View pointerEvents="box-none" style={[styles.actions, { bottom: props.footerInset + 12 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Centralizar e acompanhar minha posição" onPress={props.onCenter} style={({ pressed }) => [styles.center, { backgroundColor: colors.hero, opacity: pressed ? .75 : 1 }]}>
        <LocateFixed color={colors.heroInk} size={21} /><Text style={[styles.small, { color: colors.heroInk, fontFamily: 'ManropeExtraBold' }]}>{props.following ? 'Centralizar' : 'Voltar a acompanhar'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={props.muted ? 'Ativar instruções faladas' : 'Silenciar instruções faladas'} accessibilityState={{ selected: props.muted }} onPress={props.onMute} style={({ pressed }) => [styles.sound, { backgroundColor: colors.hero, opacity: pressed ? .75 : 1 }]}><SoundIcon color={colors.heroInk} size={22} /></Pressable>
    </View>
    <Animated.View onLayout={event => props.onHeight(event.nativeEvent.layout.height + props.bottom + 12)} style={[styles.footer, { bottom: props.bottom + 8, backgroundColor: colors.card, borderColor: colors.line, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
      <OperationalNotice onInspectRoute={props.onRoute} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Animated.Text accessibilityLiveRegion="polite" style={[styles.duration, { color: arrived ? colors.success : colors.accent, transform: [{ scale: pop }], transformOrigin: 'left' } as never]}>{arrived ? 'Chegou' : active ? summary.duration : error ? 'Sem orientação' : 'Aguardando rota'}</Animated.Text>
          <Text style={[styles.metrics, { color: colors.ink }]}>{active ? summary.distance + ' · chegada ' + summary.arrival : arrived ? 'Navegação concluída neste destino' : 'Tempo e distância aparecem após o cálculo'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sair da navegação sem finalizar a entrega" onPress={props.onExit} style={({ pressed }) => [styles.exit, { backgroundColor: colors.dangerSoft, opacity: pressed ? .75 : 1 }]}><Text style={[styles.small, { color: colors.danger, fontFamily: 'ManropeExtraBold' }]}>Sair</Text></Pressable>
      </View>
      {(active || arrived) && <Journey meters={state.meters} arrived={arrived} />}
      <View style={[styles.destination, { borderTopColor: colors.line }]}>
        <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><MapPin size={18} color={colors.accent} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {!!props.destinationName && <Text numberOfLines={1} style={{ fontFamily: 'ManropeExtraBold', fontSize: 14, color: colors.ink }}>{props.destinationName}</Text>}
          <Text numberOfLines={props.destinationName ? 1 : 2} style={[styles.small, { color: colors.muted }]}>{props.address || 'Endereço ainda não disponível'}</Text>
        </View>
        {props.stops > 1 && <View accessibilityLabel={`Parada ${index} de ${total}`} style={{ alignItems: 'flex-end', gap: 5 }}>
          <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.ink }}>{index}/{total}</Text>
          <View style={{ flexDirection: 'row', gap: 3 }}>{Array.from({ length: Math.min(total, 8) }, (_, i) => <View key={i} style={{ width: i + 1 === index ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: i + 1 <= index ? colors.accent : colors.line }} />)}</View>
        </View>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Ver rota completa e detalhes dos pedidos" onPress={props.onRoute} style={({ pressed }) => ({ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.accentSoft, opacity: pressed ? .8 : 1 })}>
        <Route color={colors.accent} size={19} /><Text style={[styles.small, { color: colors.accent, flex: 1, fontFamily: 'ManropeExtraBold' }]}>{`Sua rota · ${props.stops} ${props.stops === 1 ? 'pedido' : 'pedidos'}`}</Text><Text style={[styles.small, { color: colors.accent }]}>Abrir</Text><ChevronUp size={17} color={colors.accent} />
      </Pressable>
      {state.status === 'rerouting' && <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}><Pulse tone={colors.accent}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /></Pulse><Text style={[styles.small, { color: colors.accent }]}>Recalculando o caminho…</Text></View>}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prepare: { position: 'absolute', left: 12, right: 12, borderRadius: 23, borderWidth: 1, padding: 18, gap: 8 },
  title: { flex: 1, fontFamily: 'ManropeExtraBold', fontSize: 19 },
  address: { fontFamily: 'ManropeMedium', fontSize: 15, lineHeight: 21 },
  small: { fontFamily: 'ManropeMedium', fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 44, justifyContent: 'center' },
  actions: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { minHeight: 48, borderRadius: 24, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: '0 5px 16px #10203530' },
  sound: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 16px #10203530' },
  footer: { position: 'absolute', left: 12, right: 12, padding: 17, borderRadius: 26, borderWidth: 1, boxShadow: '0 10px 32px #10203530' },
  duration: { fontFamily: 'ManropeExtraBold', fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  metrics: { fontFamily: 'ManropeMedium', fontSize: 13, lineHeight: 20, marginTop: 2 },
  exit: { minWidth: 64, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  destination: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
});
