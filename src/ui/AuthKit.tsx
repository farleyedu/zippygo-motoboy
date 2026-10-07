import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { Entrance, Screen, type } from './Kit';
import { useZippyTheme } from './theme';

export function AuthScreen({ children }: { children: React.ReactNode }) {
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <Screen><Entrance>{children}</Entrance></Screen>
  </KeyboardAvoidingView>;
}

export function AuthIntro({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  const { colors } = useZippyTheme();
  return <View style={{ gap: 16, marginBottom: 28 }}>
    <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon size={28} color={colors.accent} strokeWidth={1.6} /></View>
    <Text accessibilityRole="header" style={[authStyles.title, { color: colors.ink }]}>{title}</Text>
    <Text style={[type.body, { color: colors.muted }]}>{description}</Text>
  </View>;
}

export function AuthLink({ children, onPress, disabled }: { children: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useZippyTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, paddingVertical: 12, justifyContent: 'center', opacity: disabled || pressed ? .5 : 1 })}>
    <Text style={[type.body, { color: colors.accent, fontWeight: '800' }]}>{children}</Text>
  </Pressable>;
}

export const authStyles = StyleSheet.create({
  title: { fontFamily: 'Manrope', fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -1.2 },
  form: { gap: 18 },
  foot: { marginTop: 24, gap: 4 },
});
