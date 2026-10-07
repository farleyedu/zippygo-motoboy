import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { registerMotoboy } from '../../services/mobileApi';
import { Button, Feedback, Field, Header, type } from '../../src/ui/Kit';
import { AuthIntro, AuthLink, AuthScreen, authStyles } from '../../src/ui/AuthKit';
import { useZippyTheme } from '../../src/ui/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useZippyTheme();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failure, setFailure] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const submitting = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const cadastrar = async () => {
    if (submitting.current || success) return;
    const nextErrors = {
      nome: nome.trim().length >= 2 ? undefined : 'Informe seu nome completo.',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Informe um e-mail válido.',
      senha: senha.trim().length >= 6 ? undefined : 'A senha precisa ter pelo menos 6 caracteres.',
      confirmacao: senha === confirmacao ? undefined : 'A confirmação precisa ser igual à senha.',
    };
    setErrors(nextErrors); setFailure('');
    if (Object.values(nextErrors).some(Boolean)) return;
    submitting.current = true; setLoading(true);
    try {
      await registerMotoboy({ nome: nome.trim(), email: email.trim().toLowerCase(), telefone: telefone.trim() || undefined, senha });
      if (alive.current) { setSuccess(true); setSenha(''); setConfirmacao(''); }
    } catch (error: unknown) {
      if (alive.current) setFailure(error instanceof Error ? error.message : 'Confira sua conexão e tente novamente.');
    } finally {
      submitting.current = false;
      if (alive.current) setLoading(false);
    }
  };

  return <AuthScreen>
    <Header title="Comece seu caminho" subtitle="Cadastro inicial" onBack={() => { if (!loading) router.replace('/(auth)/welcome'); }} />
    {success ? <>
      <AuthIntro icon={UserRound} title="Conta criada." description="Agora entre no app e solicite vínculo ao estabelecimento onde trabalha." />
      <Button onPress={() => router.replace('/(auth)/login')}>Ir para login</Button>
    </> : <>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 24 }}>{[0, 1, 2].map(index => <View key={index} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: index === 0 ? colors.accent : colors.line }} />)}</View>
      <AuthIntro icon={UserRound} title={'Prazer,\nseu novo parceiro.'} description="Primeiro os seus dados. Depois você escolhe onde trabalhar." />
      <View style={authStyles.form}>
        <Field label="Seu nome" value={nome} onChangeText={setNome} placeholder="Como podemos te chamar?" autoComplete="name" error={errors.nome} maxLength={160} editable={!loading} />
        <Field label="Telefone (opcional)" value={telefone} onChangeText={setTelefone} placeholder="(00) 00000-0000" keyboardType="phone-pad" autoComplete="tel" maxLength={30} editable={!loading} />
        <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@exemplo.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" error={errors.email} maxLength={200} editable={!loading} />
        <Field label="Crie uma senha" value={senha} onChangeText={setSenha} placeholder="Pelo menos 6 caracteres" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" error={errors.senha} maxLength={100} editable={!loading} />
        <Field label="Confirmar senha" value={confirmacao} onChangeText={setConfirmacao} placeholder="Repita sua senha" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" error={errors.confirmacao} maxLength={100} editable={!loading} returnKeyType="go" onSubmitEditing={() => void cadastrar()} />
        {failure ? <Feedback title="Não foi possível cadastrar" message={failure} /> : null}
        <Button onPress={() => void cadastrar()} loading={loading}>Criar minha conta</Button>
      </View>
      <View style={authStyles.foot}><Text style={[type.body, { color: colors.muted }]}>Já tem uma conta?</Text><AuthLink disabled={loading} onPress={() => router.replace('/(auth)/login')}>Entrar no meu caminho</AuthLink></View>
    </>}
  </AuthScreen>;
}
