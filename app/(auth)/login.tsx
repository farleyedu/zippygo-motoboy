import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button, Feedback, Field, Header, Surface, type } from '../../src/ui/Kit';
import { AuthIntro, AuthLink, AuthScreen, authStyles } from '../../src/ui/AuthKit';
import { useZippyTheme } from '../../src/ui/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useZippyTheme();
  const { signIn, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; senha?: string }>({});
  const [failure, setFailure] = useState('');
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
      const result = await signIn(email.trim(), senha);
      if (!alive.current) return;
      if (result.success) {
        if (result.requiresLinkRequest) router.replace('/solicitarRestaurante');
        else router.replace(result.requiresEstablishmentSelection ? '/selecionarRestaurante' : '/');
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
    <AuthIntro icon={KeyRound} title={'Entre e faça\nacontecer.'} description="Sua equipe e sua próxima rota estão aqui." />
    <View style={authStyles.form}>
      <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@exemplo.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" error={errors.email} editable={!blocked} maxLength={200} />
      <Field label="Senha" value={senha} onChangeText={setSenha} placeholder="Sua senha" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" error={errors.senha} editable={!blocked} returnKeyType="go" onSubmitEditing={() => void handleLogin()} />
    </View>
    <View style={{ marginTop: 8, marginBottom: 14 }}><AuthLink disabled={blocked} onPress={() => router.push('/(auth)/recovery')}>Esqueci a senha</AuthLink><Text style={[type.small, { color: colors.muted }]}>Seu acesso fica salvo neste aparelho.</Text></View>
    {failure ? <Feedback title="Não foi possível entrar" message={failure} /> : null}
    <Button onPress={() => void handleLogin()} loading={loading} disabled={blocked}>Entrar</Button>
    <View style={authStyles.foot}><Text style={[type.body, { color: colors.muted }]}>Ainda não tem conta?</Text><AuthLink disabled={blocked} onPress={() => router.push('/(auth)/register')}>Criar agora</AuthLink></View>
    <Surface style={{ marginTop: 16 }}><View style={{ flexDirection: 'row', gap: 10 }}><ShieldCheck size={20} color={colors.accent} /><Text style={[type.small, { color: colors.muted, flex: 1 }]}>Seu acesso fica protegido. Nunca envie sua senha no chat.</Text></View></Surface>
  </AuthScreen>;
}
