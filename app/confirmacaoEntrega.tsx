import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function ConfirmacaoEntrega() {
  const [codigo, setCodigo] = useState('');
  const router = useRouter();

  const handleConfirmar = () => {
    if (codigo.length !== 4) {
      Alert.alert('Código inválido', 'Digite os 4 dígitos do código do cliente.');
      return;
    }

    // Aqui poderia validar o código ou enviar para API, se quiser
    console.log('Código confirmado:', codigo);
    
    // Redireciona para o mapa ou próxima entrega
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Digite o código de 4 dígitos do cliente:</Text>
      <TextInput
        style={styles.input}
        value={codigo}
        onChangeText={setCodigo}
        keyboardType="numeric"
        maxLength={4}
        placeholder="Ex: 1234"
      />
      <Button title="Confirmar Entrega" onPress={handleConfirmar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    padding: 10,
    borderRadius: 6,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
});
