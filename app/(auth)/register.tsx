import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { registerMotoboy } from '../../services/mobileApi';

export default function RegisterScreen() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);

  const cadastrar = async () => {
    if (nome.trim().length < 2) {
      Alert.alert('Cadastro incompleto', 'Informe seu nome completo.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Cadastro incompleto', 'Informe um e-mail válido.');
      return;
    }
    if (senha.length < 6) {
      Alert.alert('Senha inválida', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirmacao) {
      Alert.alert('Senhas diferentes', 'A confirmação precisa ser igual à senha.');
      return;
    }

    try {
      setLoading(true);
      await registerMotoboy({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefone.trim() || undefined,
        senha,
      });
      Alert.alert('Cadastro concluído', 'Agora entre no app e solicite vínculo ao seu restaurante.', [
        { text: 'Ir para login', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error: any) {
      Alert.alert('Não foi possível cadastrar', error?.message ?? 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Criar conta de motoboy</Text>
        <Text style={styles.subtitle}>Depois do cadastro, você poderá pedir vínculo aos restaurantes onde trabalha.</Text>

        <Text style={styles.label}>Nome completo</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Seu nome" editable={!loading} />
        <Text style={styles.label}>E-mail</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!loading} />
        <Text style={styles.label}>Telefone (opcional)</Text>
        <TextInput style={styles.input} value={telefone} onChangeText={setTelefone} placeholder="(00) 00000-0000" keyboardType="phone-pad" editable={!loading} />
        <Text style={styles.label}>Senha</Text>
        <TextInput style={styles.input} value={senha} onChangeText={setSenha} placeholder="Mínimo de 6 caracteres" secureTextEntry editable={!loading} />
        <Text style={styles.label}>Confirmar senha</Text>
        <TextInput style={styles.input} value={confirmacao} onChangeText={setConfirmacao} placeholder="Repita sua senha" secureTextEntry editable={!loading} />

        <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={cadastrar} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Criar conta</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} disabled={loading}>
          <Text style={styles.backText}>Já tenho uma conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#1F2937', fontSize: 28, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { color: '#6B7280', fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  label: { color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: '#FFF', borderColor: '#D1D5DB', borderRadius: 10, borderWidth: 1, color: '#111827', fontSize: 16, marginBottom: 14, padding: 13 },
  button: { alignItems: 'center', backgroundColor: '#2C79FF', borderRadius: 10, marginTop: 8, padding: 15 },
  disabled: { backgroundColor: '#9CA3AF' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  backText: { color: '#2C79FF', fontSize: 14, fontWeight: '700', marginTop: 20, textAlign: 'center' },
});
