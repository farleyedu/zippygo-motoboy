import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

export default function ConfirmacaoEntrega() {
  const [codigo, setCodigo] = useState('');
  const router = useRouter();

  const handleConfirmar = async () => {
    // Validação fictícia do código
    if (codigo.trim() === '') {
      Alert.alert('Código inválido', 'Por favor, digite o código de entrega.');
      return;
    }

    // Avança para o próximo destino
    const rawIndice = await SecureStore.getItemAsync('indiceAtual');
    const indiceAtual = parseInt(rawIndice || '0', 10);
    const proximoIndice = indiceAtual + 1;

    const rawDestinos = await SecureStore.getItemAsync('destinos');
    const destinos = rawDestinos ? JSON.parse(rawDestinos) : [];

    if (proximoIndice < destinos.length) {
      await SecureStore.setItemAsync('indiceAtual', proximoIndice.toString());
      Alert.alert('Entrega confirmada!', 'Indo para o próximo destino.');
      router.back(); // ou router.push('/telaPrincipal');
    } else {
      Alert.alert('Entregas concluídas!', 'Você completou todas as paradas.');
      await SecureStore.deleteItemAsync('indiceAtual');
      await SecureStore.deleteItemAsync('destinos');
      router.push('/'); // volta para o início
    }

    // Limpa a flag da notificação
    await SecureStore.deleteItemAsync('chegouNoDestino');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirmar Entrega</Text>
      <Text style={styles.label}>Digite o código fornecido pelo cliente:</Text>

      <TextInput
        style={styles.input}
        placeholder="Código de entrega"
        value={codigo}
        onChangeText={setCodigo}
      />

      <TouchableOpacity style={styles.button} onPress={handleConfirmar}>
        <Text style={styles.buttonText}>Confirmar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2C79FF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
