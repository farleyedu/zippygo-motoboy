import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { UserRound } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button, Feedback, type } from '../../src/ui/Kit';
import { AuthScreen, authStyles } from '../../src/ui/AuthKit';
import { useZippyTheme } from '../../src/ui/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useZippyTheme();
  const { user, isLoading } = useAuth();
  const focused = useIsFocused();
  useEffect(() => { if (focused && !isLoading && user) router.replace('/'); }, [focused, isLoading, user, router]);
  if (isLoading || user) return <AuthScreen><Feedback title="Preparando seu caminho" loading /></AuthScreen>;
  return <AuthScreen>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <Text style={{ fontFamily: 'Manrope', fontSize: 26, fontWeight: '800', color: colors.ink }}>Zippy<Text style={{ color: colors.accent }}>Go</Text></Text>
      <Text style={[type.eyebrow, { color: colors.muted, textAlign: 'right', flexShrink: 1 }]}>BEM-VINDO AO SEU CAMINHO</Text>
    </View>
    <View style={{ height: 240, alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}>
      <View style={[styles.orbit, { borderColor: colors.line, width: 235, height: 160, transform: [{ rotate: '-22deg' }] }]} />
      <View style={[styles.orbit, { borderColor: colors.accentSoft, width: 190, height: 215, transform: [{ rotate: '30deg' }] }]} />
      <Image source={require('../../assets/images/capacete-3d-azul.png')} accessibilityLabel="Capacete azul ZippyGo" style={{ width: 235, height: 235 }} resizeMode="contain" />
    </View>
    <Text style={[type.eyebrow, { color: colors.accent, marginBottom: 14 }]}>SUA CIDADE. SEU MOVIMENTO.</Text>
    <Text accessibilityRole="header" style={[authStyles.title, { color: colors.ink, fontSize: 38, lineHeight: 45 }]}>O próximo passo{'\n'}é <Text style={{ color: colors.accent }}>seu.</Text></Text>
    <Text style={[type.body, { color: colors.muted, marginTop: 16, marginBottom: 26 }]}>Rotas claras, equipe conectada e cada entrega no seu lugar. Bora começar?</Text>
    <View style={{ gap: 12 }}><Button onPress={() => router.push('/(auth)/login')}>Entrar no meu caminho</Button><Button secondary icon={UserRound} onPress={() => router.push('/(auth)/register')}>Criar minha conta</Button></View>
    <Text style={[type.small, { color: colors.muted, textAlign: 'center', marginTop: 26 }]}>Feito para quem faz a cidade se mover.{'\n'}Simples para trabalhar. Bonito para usar.</Text>
  </AuthScreen>;
}
const styles = StyleSheet.create({ orbit: { position: 'absolute', borderWidth: 1, borderRadius: 150 } });
