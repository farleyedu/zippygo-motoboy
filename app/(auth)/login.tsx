import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, KeyRound, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button, Feedback, Field, Gradient, Header, type } from '../../src/ui/Kit';
import { AuthIntro, AuthLink, AuthScreen, authStyles } from '../../src/ui/AuthKit';
import { useZippyTheme } from '../../src/ui/theme';
import { getSecureItem } from '../../utils/secureStorage';
import { AccountNotice } from '../../src/ui/AccountKit';
import { AccessKey } from '../../src/ui/AccessKey';

export default function LoginScreen() {
  const router = useRouter();
  const { colors, dark } = useZippyTheme();
  const { signIn, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; senha?: string }>({});
  const [failure, setFailure] = useState('');
  const [remember, setRemember] = useState(true);
  useEffect(() => { let alive = true; getSecureItem('zippygo.rememberLogin').then(value => { if (alive) setRemember(value !== 'false'); }); return () => { alive = false; }; }, []);
  const submitting = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const blocked = loading || authLoading;

  const handleLogin = async () => {
    if (submitting.current || authLoading) return;
    const nextErrors = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Informe um e-mail válido.',
      senha: senha.trim() ? undefined : 'Informe sua senha.',
    };
    setErrors(nextErrors); setFailure('');
    if (nextErrors.email || nextErrors.senha) return;
    submitting.current = true; setLoading(true);
    try {
      const result = await signIn(email.trim(), senha, remember);
      if (!alive.current) return;
      if (result.success) {
        if (result.requiresLinkRequest) router.replace('/solicitarRestaurante');
        else router.replace(result.requiresEstablishmentSelection ? '/selecionarRestaurante' : '/permissoes');
      } else setFailure(result.error || 'Não foi possível entrar. Tente novamente.');
    } catch {
      if (alive.current) setFailure('Não foi possível entrar. Confira sua conexão e tente novamente.');
    } finally {
      submitting.current = false;
      if (alive.current) setLoading(false);
    }
  };

  return <AuthScreen>
    <Header title="Seu caminho continua." subtitle="Bom te ver por aqui." onBack={() => { if (!blocked) router.replace('/(auth)/welcome'); }} />
    <View style={{ width: 75, height: 75, borderRadius: 25, backgroundColor: dark ? '#243141' : '#d6e0ee', borderWidth: 1, borderColor: dark ? '#7597c466' : '#bbcbdf', marginTop: 4, marginBottom: 11, boxShadow: dark ? '0 7px 0 #151e2a, 0 14px 26px #0004' : '0 7px 0 #b7c6d9, 0 14px 24px #607a9d17', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{dark && <Gradient colors={['#344761', '#243141']} angle={140} />}<View style={{zIndex:1}}><AccessKey color={dark ? '#bad3f4' : '#456289'}/></View></View>
    <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 29, lineHeight: 32, letterSpacing: -1.2, color: colors.ink, marginTop: 15, marginBottom: 12 }}>{'Entre e faça\nacontecer.'}</Text>
    <Text style={{ fontFamily: 'Manrope', fontSize: 13, lineHeight: 22, color: colors.muted, marginBottom: 20 }}>Sua equipe e sua próxima rota estão aqui.</Text>
    <View style={{ gap: 16 }}>
      <Field compact label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@exemplo.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" error={errors.email} editable={!blocked} maxLength={200} />
      <Field compact label="Senha" value={senha} onChangeText={setSenha} placeholder="Sua senha" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" error={errors.senha} editable={!blocked} returnKeyType="go" onSubmitEditing={() => void handleLogin()} />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 11, marginBottom: 23 }}><Pressable accessibilityRole="checkbox" accessibilityLabel="Lembrar meu acesso" accessibilityState={{ checked: remember, disabled: blocked }} disabled={blocked} onPress={() => setRemember(v => !v)} hitSlop={12} style={{ minHeight: 20, flexDirection: 'row', gap: 9, alignItems: 'center' }}><View style={{ width: 16, height: 16, borderRadius: 3, borderWidth: 1, borderColor: remember ? colors.accent : colors.line, backgroundColor: remember ? colors.accent : colors.card, alignItems: 'center', justifyContent: 'center' }}>{remember && <Check size={12} color={colors.paper} />}</View><Text style={{ fontFamily: 'Manrope', fontSize: 10, color: colors.muted }}>Lembrar meu acesso</Text></Pressable><Pressable accessibilityRole="button" disabled={blocked} onPress={() => router.push('/(auth)/recovery')} hitSlop={12} style={{ minHeight: 20, justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 11, color: colors.accent }}>Esqueci a senha</Text></Pressable></View>
    {failure ? <Feedback title="Não foi possível entrar" message={failure} /> : null}
    <Button onPress={() => void handleLogin()} loading={loading} disabled={blocked}>Entrar</Button>
    <View style={{ marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Text style={{ fontFamily: 'Manrope', fontSize: 9, color: colors.muted }}>Ainda não tem conta?</Text><Pressable accessibilityRole="button" disabled={blocked} onPress={() => router.push('/(auth)/register')} hitSlop={9} style={{ minHeight: 26, justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 11, color: colors.accent }}>Criar agora</Text></Pressable></View>
    <AccountNotice icon={ShieldCheck}>Seu acesso fica protegido. Nunca envie sua senha no chat.</AccountNotice>
  </AuthScreen>;
}
