import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ShieldCheck } from 'lucide-react-native';
import { savePersonalData, sendOwnImage } from '../services/accountApi';
import { chooseAccountImage } from '../services/accountImage';
import { useOwnAccount } from '../src/hooks/useOwnAccount';
import { useAuth } from '../src/contexts/AuthContext';
import { useAccountSave } from '../src/hooks/useAccountSave';
import { AccountAvatar, AccountNotice, AccountScreen } from '../src/ui/AccountKit';
import { Button, Feedback, Field, Header } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

export default function PersonalDataScreen() {
  const router = useRouter(), { colors } = useZippyTheme(), data = useOwnAccount(), save = useAccountSave(), auth = useAuth();
  const [nome, setNome] = useState(''), [telefone, setTelefone] = useState(''), [email, setEmail] = useState(''), [cidade, setCidade] = useState(''), [uf, setUf] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (!data.account) return; const a = data.account; setNome(a.nome); setTelefone(a.telefone || ''); setEmail(a.email); setCidade(a.cidade || ''); setUf(a.uf || ''); }, [data.account]);
  const submit = () => {
    const next: Record<string, string> = {};
    if (nome.trim().length < 2) next.nome = 'Informe seu nome completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Informe um e-mail válido.';
    if (uf && !/^[a-zA-Z]{2}$/.test(uf)) next.uf = 'Informe as duas letras do estado.';
    setErrors(next); if (Object.keys(next).length) return;
    void save.run(async () => { const account = await savePersonalData({ nome: nome.trim(), telefone: telefone.trim(), email: email.trim(), cidade: cidade.trim(), uf: uf.toUpperCase() }); await auth.updateOwnIdentity(account); data.setAccount(account); }, 'Seus dados foram salvos.');
  };
  const photo = (camera: boolean) => void save.run(async () => { const base64 = await chooseAccountImage(camera); if (!base64) return false; await sendOwnImage('avatar', base64); await data.reload(); }, 'Foto atualizada.');
  const blocked = data.loading || !data.account || save.saving;
  return <AccountScreen>
    <Header title="Seu perfil, atualizado." subtitle="Dados pessoais" onBack={() => router.back()} />
    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 12 }}><AccountAvatar name={nome} uri={data.account?.avatar} /><Pressable accessibilityRole="button" disabled={blocked} onPress={() => Alert.alert('Alterar foto', 'Escolha de onde vem sua foto.', [{ text: 'Câmera', onPress: () => photo(true) }, { text: 'Galeria', onPress: () => photo(false) }, { text: 'Cancelar', style: 'cancel' }])} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 11, color: colors.accent }}>Alterar foto</Text></Pressable></View>
    {data.loading && <Feedback title="Carregando seus dados" loading />}{data.error && <Feedback title="Seu cadastro não carregou" message={data.error} onRetry={() => void data.reload()} />}
    <View style={{ gap: 15, marginBottom: 18 }}>
      <Field label="Nome" value={nome} onChangeText={setNome} editable={!blocked} maxLength={120} error={errors.nome} />
      <Field label="Telefone" value={telefone} onChangeText={setTelefone} editable={!blocked} keyboardType="phone-pad" maxLength={30} />
      <Field label="E-mail" value={email} onChangeText={setEmail} editable={!blocked} autoCapitalize="none" keyboardType="email-address" maxLength={200} error={errors.email} />
      <Field label="Cidade" value={cidade} onChangeText={setCidade} editable={!blocked} maxLength={120} />
      <Field label="Estado" value={uf} onChangeText={setUf} editable={!blocked} autoCapitalize="characters" maxLength={2} error={errors.uf} />
    </View>
    {save.failure && <Feedback title="Seus dados foram mantidos" message={save.failure} />}{save.success && <AccountNotice icon={ShieldCheck}>{save.success}</AccountNotice>}
    <Button icon={Check} loading={save.saving} disabled={blocked} onPress={submit}>Salvar meus dados</Button>
  </AccountScreen>;
}
