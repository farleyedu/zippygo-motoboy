import React, { useEffect, useId, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { ArrowLeft, ArrowRight, LucideIcon } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { layout, useZippyTheme } from './theme';

export const type = StyleSheet.create({
  eyebrow: { fontFamily: 'Manrope', fontSize: 9, letterSpacing: 1.7, fontWeight: '700' },
  title: { fontFamily: 'Manrope', fontSize: 20, fontWeight: '800', letterSpacing: -.7 },
  body: { fontFamily: 'Manrope', fontSize: 14, lineHeight: 22 },
  small: { fontFamily: 'Manrope', fontSize: 12, lineHeight: 18 },
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
  const [footerHeight, setFooterHeight] = useState(100);
  return <View style={{ flex: 1, backgroundColor: colors.paper }}><StatusBar style={dark ? 'light' : 'dark'} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: footer ? footerHeight + 24 : 36 + insets.bottom }} showsVerticalScrollIndicator={false}>
      <View style={{ width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', paddingHorizontal: 20 }}>{children}</View>
    </ScrollView>
    {footer && <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.line }}><View style={{ width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', paddingHorizontal: 20 }}>{footer}</View></View>}
  </View>;
}

export function IconButton({ icon: Icon, onPress, label }: { icon: LucideIcon; onPress: () => void; label: string }) {
  const { colors } = useZippyTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: layout.touch, height: layout.touch, borderRadius: layout.radius.field, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}><Icon size={19} color={colors.ink} strokeWidth={1.8} /></Pressable>;
}

export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack: () => void; right?: React.ReactNode }) {
  const { colors } = useZippyTheme();
  return <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 20 }}><IconButton icon={ArrowLeft} label="Voltar" onPress={onBack} /><View style={{ flex: 1 }}><Text accessibilityRole="header" style={[type.title, { color: colors.ink }]}>{title}</Text>{subtitle && <Text style={[type.small, { color: colors.muted, marginTop: 3 }]}>{subtitle}</Text>}</View>{right}</View>;
}

export function Surface({ children, hero, style }: { children: React.ReactNode; hero?: boolean; style?: ViewStyle }) {
  const { colors } = useZippyTheme();
  return <View style={[{ borderRadius: layout.radius.card, borderWidth: 1, borderColor: hero ? '#45638755' : colors.line, backgroundColor: colors.card, padding: 16, overflow: 'hidden', shadowColor: colors.hero, shadowOpacity: hero ? .16 : .04, shadowRadius: hero ? 18 : 8, shadowOffset: { width: 0, height: hero ? 8 : 3 }, elevation: hero ? 3 : 1 }, style]}>{hero && <Gradient colors={[colors.heroEnd, colors.hero]} glow />}{children}</View>;
}

export function Button({ children, onPress, icon: Icon = ArrowRight, secondary, danger, loading, disabled }: { children: string; onPress: () => void; icon?: LucideIcon; secondary?: boolean; danger?: boolean; loading?: boolean; disabled?: boolean }) {
  const { colors, reducedMotion } = useZippyTheme(); const scale = useRef(new Animated.Value(1)).current;
  const blocked = disabled || loading;
  useEffect(() => { if (reducedMotion || blocked) { scale.stopAnimation(); scale.setValue(1); } }, [blocked, reducedMotion, scale]);
  const animate = (value: number) => { if (!reducedMotion) Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 30 }).start(); };
  const foreground = secondary ? colors.ink : danger ? colors.paper : '#ffffff';
  return <Animated.View style={{ transform: [{ scale }], opacity: blocked ? .5 : 1 }}><Pressable accessibilityRole="button" accessibilityState={{ disabled: !!blocked, busy: !!loading }} onPress={onPress} onPressIn={() => animate(.975)} onPressOut={() => animate(1)} disabled={blocked} style={{ minHeight: 50, padding: 13, borderRadius: 15, borderWidth: secondary ? 1 : 0, borderColor: colors.line, backgroundColor: secondary ? colors.card : danger ? colors.danger : '#3479ef', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
    {!secondary && !danger && <Gradient colors={['#2872e3', '#1854cd']} />}{loading ? <ActivityIndicator color={foreground} /> : <Icon size={18} color={foreground} />}<Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', color: foreground, flexShrink: 1, textAlign: 'center' }}>{children}</Text>
  </Pressable></Animated.View>;
}

export function Pill({ children, icon: Icon, tone = 'accent', inverse }: { children: string; icon?: LucideIcon; tone?: 'accent' | 'warning' | 'danger'; inverse?: boolean }) {
  const { colors } = useZippyTheme();
  const foreground = inverse ? '#d3e5ff' : colors[tone]; const background = inverse ? '#ffffff13' : tone === 'accent' ? colors.soft : tone === 'warning' ? colors.warningSoft : colors.dangerSoft;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', flexShrink: 1, paddingVertical: 5, paddingHorizontal: 9, backgroundColor: background, borderRadius: 20 }}>{Icon && <Icon size={12} color={foreground} />}<Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: foreground, flexShrink: 1 }}>{children}</Text></View>;
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const { colors } = useZippyTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 24, marginBottom: 13 }}><Text accessibilityRole="header" style={{ flexShrink: 1, fontFamily: 'Manrope', fontSize: 16, letterSpacing: -.4, fontWeight: '800', color: colors.ink }}>{children}</Text>{right}</View>;
}

export function Avatar({ name }: { name: string }) {
  const { colors } = useZippyTheme(); const initials = name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('');
  return <View style={{ width: 43, height: 43, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 14, color: colors.accent }}>{initials || '?'}</Text></View>;
}

export function Entrance({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { reducedMotion } = useZippyTheme(); const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => { const animation = Animated.timing(progress, { toValue: 1, duration: reducedMotion ? 0 : layout.motion.entrance, delay: reducedMotion ? 0 : delay, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [delay, reducedMotion, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}

export function Field({ label, error, hint, style, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { colors } = useZippyTheme(); const [focused, setFocused] = useState(false); const id = useId();
  return <View style={{ gap: 7 }}>
    <Text nativeID={`${id}-label`} style={[type.small, { fontWeight: '700', color: colors.ink }]}>{label}</Text>
    <TextInput {...props} accessibilityLabel={props.accessibilityLabel || label} accessibilityLabelledBy={`${id}-label`} placeholderTextColor={colors.muted} selectionColor={colors.accent}
      onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }}
      style={[type.body, { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, borderRadius: layout.radius.field, backgroundColor: colors.card, color: colors.ink, borderWidth: 1, borderColor: error ? colors.danger : focused ? colors.accent : colors.line, opacity: props.editable === false ? .6 : 1 }, style]} />
    {(error || hint) && <Text accessibilityLiveRegion={error ? 'polite' : 'none'} style={[type.small, { color: error ? colors.danger : colors.muted }]}>{error || hint}</Text>}
  </View>;
}

export function Feedback({ title, message, loading, onRetry }: { title: string; message?: string; loading?: boolean; onRetry?: () => void }) {
  const { colors } = useZippyTheme();
  return <Surface style={{ marginBottom: 16 }}>
    <View accessibilityLiveRegion="polite" accessibilityState={{ busy: !!loading }} style={{ gap: 10 }}>
      {loading && <ActivityIndicator color={colors.accent} />}
      <Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>{title}</Text>
      {message && <Text style={[type.body, { color: colors.muted }]}>{message}</Text>}
      {onRetry && <Button secondary onPress={onRetry}>Tentar novamente</Button>}
    </View>
  </Surface>;
}

export const money = (value?: number | null) => value == null || !Number.isFinite(value) ? 'Não informado' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
