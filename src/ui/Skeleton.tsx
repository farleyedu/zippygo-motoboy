import React, { useEffect } from 'react';
import { Animated, DimensionValue, Easing, StyleProp, View, ViewStyle } from 'react-native';
import { useZippyTheme } from './theme';

// Um único pulso compartilhado por todos os esqueletos visíveis: uma animação no thread
// nativo, sem timers por componente, que para quando o último esqueleto sai da tela.
const pulse = new Animated.Value(0);
let users = 0, loop: Animated.CompositeAnimation | null = null;
function acquire() {
  if (++users !== 1) return;
  loop = Animated.loop(Animated.sequence([
    Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
    Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
  ]));
  loop.start();
}
function release() {
  if (--users > 0) return;
  users = 0; loop?.stop(); loop = null; pulse.setValue(0);
}

export function Skel({ w = '100%', h = 12, r = 8, style }: { w?: DimensionValue; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const { dark, reducedMotion } = useZippyTheme();
  useEffect(() => { if (reducedMotion) return; acquire(); return release; }, [reducedMotion]);
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: dark ? '#2c405c' : '#e4ebf7', opacity: reducedMotion ? .8 : pulse.interpolate({ inputRange: [0, 1], outputRange: [.5, 1] }) }, style]} />;
}

export function SkeletonLines({ lines = 3, last = '62%' }: { lines?: number; last?: DimensionValue }) {
  return <View style={{ gap: 9 }}>{Array.from({ length: lines }, (_, i) => <Skel key={i} h={11} w={i === lines - 1 ? last : '100%'} />)}</View>;
}

/** Linhas de lista (avatar + duas linhas), para telas de conversas, histórico e vínculos. */
export function SkeletonRows({ rows = 4, avatar = 44 }: { rows?: number; avatar?: number }) {
  const { colors } = useZippyTheme();
  return <View style={{ gap: 10 }}>{Array.from({ length: rows }, (_, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, opacity: 1 - i * .12 }}>
    <Skel w={avatar} h={avatar} r={avatar * .34} />
    <View style={{ flex: 1, gap: 8 }}><Skel w={i % 2 ? '48%' : '62%'} h={12} /><Skel w={i % 2 ? '78%' : '88%'} h={10} /></View>
  </View>)}</View>;
}

/** Balões alternados enquanto a conversa chega. */
export function SkeletonBubbles({ count = 6 }: { count?: number }) {
  const widths: DimensionValue[] = ['58%', '72%', '44%', '66%', '52%', '70%'];
  return <View style={{ gap: 12, paddingVertical: 8 }}>{Array.from({ length: count }, (_, i) => <View key={i} style={{ alignItems: i % 3 === 1 ? 'flex-end' : 'flex-start' }}><Skel w={widths[i % widths.length]} h={i % 2 ? 44 : 58} r={18} /></View>)}</View>;
}
