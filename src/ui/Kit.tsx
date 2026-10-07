import React, { useEffect, useId, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ArrowLeft, ArrowRight, LucideIcon } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useZippyTheme } from './theme';

export const type = StyleSheet.create({
  eyebrow: { fontFamily: 'Manrope', fontSize: 9, letterSpacing: 1.7, fontWeight: '700' },
  title: { fontFamily: 'Manrope', fontSize: 20, fontWeight: '800', letterSpacing: -.7 },
  body: { fontFamily: 'Manrope', fontSize: 12, lineHeight: 19 },
  small: { fontFamily: 'Manrope', fontSize: 10, lineHeight: 16 },
});

export function Gradient({ colors, glow = false }: { colors: [string, string]; glow?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
    <Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor={colors[0]} /><Stop offset="1" stopColor={colors[1]} /></LinearGradient>
      <RadialGradient id={`${id}glow`} cx="85%" cy="18%" rx="75%" ry="80%"><Stop offset="0" stopColor="#77b3ff" stopOpacity=".25" /><Stop offset="1" stopColor="#77b3ff" stopOpacity="0" /></RadialGradient></Defs>
    <Rect width="100%" height="100%" fill={`url(#${id})`} />{glow && <Rect width="100%" height="100%" fill={`url(#${id}glow)`} />}
  </Svg>;
}

export function Screen({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const { colors, dark } = useZippyTheme(); const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: colors.paper }}><StatusBar style={dark ? 'light' : 'dark'} />
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 22, paddingBottom: footer ? 125 + insets.bottom : 36 + insets.bottom }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    {footer && <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.line }}>{footer}</View>}
  </View>;
}

export function IconButton({ icon: Icon, onPress, label }: { icon: LucideIcon; onPress: () => void; label: string }) {
  const { colors } = useZippyTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}><Icon size={19} color={colors.ink} strokeWidth={1.8} /></Pressable>;
}

export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack: () => void; right?: React.ReactNode }) {
  const { colors } = useZippyTheme();
  return <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 20 }}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={10} style={{ width: 28, height: 42, alignItems: 'flex-start', justifyContent: 'center' }}><ArrowLeft color={colors.ink} size={20} /></Pressable><View style={{ flex: 1 }}><Text style={[type.title, { color: colors.ink }]}>{title}</Text>{subtitle && <Text style={[type.small, { color: colors.muted, marginTop: 3 }]}>{subtitle}</Text>}</View>{right}</View>;
}

export function Surface({ children, hero, style }: { children: React.ReactNode; hero?: boolean; style?: ViewStyle }) {
  const { colors } = useZippyTheme();
  return <View style={[{ borderRadius: 19, borderWidth: 1, borderColor: hero ? '#45638755' : colors.line, backgroundColor: colors.card, padding: 16, overflow: 'hidden' }, style]}>{hero && <Gradient colors={[colors.heroEnd, colors.hero]} glow />}{children}</View>;
}

export function Button({ children, onPress, icon: Icon = ArrowRight, secondary, danger, loading, disabled }: { children: string; onPress: () => void; icon?: LucideIcon; secondary?: boolean; danger?: boolean; loading?: boolean; disabled?: boolean }) {
  const { colors, reducedMotion } = useZippyTheme(); const scale = useRef(new Animated.Value(1)).current;
  const blocked = disabled || loading;
  const animate = (value: number) => { if (!reducedMotion) Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 30 }).start(); };
  const foreground = secondary ? colors.ink : '#ffffff';
  return <Animated.View style={{ transform: [{ scale }], opacity: blocked ? .5 : 1 }}><Pressable accessibilityRole="button" accessibilityState={{ disabled: !!blocked, busy: !!loading }} onPress={onPress} onPressIn={() => animate(.975)} onPressOut={() => animate(1)} disabled={blocked} style={{ minHeight: 50, padding: 13, borderRadius: 15, borderWidth: secondary ? 1 : 0, borderColor: colors.line, backgroundColor: secondary ? colors.card : danger ? colors.danger : '#3479ef', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
    {!secondary && !danger && <Gradient colors={['#2872e3', '#1854cd']} />}{loading ? <ActivityIndicator color={foreground} /> : <Icon size={18} color={foreground} />}<Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '800', color: foreground }}>{children}</Text>
  </Pressable></Animated.View>;
}

export function Pill({ children, icon: Icon, tone = 'accent', inverse }: { children: string; icon?: LucideIcon; tone?: 'accent' | 'warning' | 'danger'; inverse?: boolean }) {
  const { colors } = useZippyTheme();
  const foreground = inverse ? '#d3e5ff' : colors[tone]; const background = inverse ? '#ffffff13' : tone === 'accent' ? colors.soft : tone === 'warning' ? colors.warningSoft : colors.dangerSoft;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 9, backgroundColor: background, borderRadius: 20 }}>{Icon && <Icon size={12} color={foreground} />}<Text style={{ fontFamily: 'Manrope', fontSize: 9, fontWeight: '700', color: foreground }}>{children}</Text></View>;
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const { colors } = useZippyTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 13 }}><Text style={{ fontFamily: 'Manrope', fontSize: 15, letterSpacing: -.4, fontWeight: '800', color: colors.ink }}>{children}</Text>{right}</View>;
}

export function Avatar({ name }: { name: string }) {
  const { colors } = useZippyTheme(); const initials = name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('');
  return <View style={{ width: 43, height: 43, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 14, color: colors.accent }}>{initials || '?'}</Text></View>;
}

export function Entrance({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { reducedMotion } = useZippyTheme(); const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => { const animation = Animated.timing(progress, { toValue: 1, duration: reducedMotion ? 0 : 350, delay: reducedMotion ? 0 : delay, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [delay, reducedMotion, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}

export const money = (value?: number | null) => value == null ? 'Não informado' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
