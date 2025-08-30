import React, { useState } from 'react';
import {
  SafeAreaView,
  Text,
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CodeField, Cursor, useBlurOnFulfill, useClearByFocusCell } from 'react-native-confirmation-code-field';
import { Stack, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { setSecureItem, deleteSecureItem } from '../utils/secureStorage';

const CELL_COUNT = 4;
const lockIcon = require('../assets/images/lock.png'); // ajuste o caminho se necessário

export default function VerificationScreen() {
  const [value, setValue] = useState('');
  const ref = useBlurOnFulfill({ value, cellCount: CELL_COUNT });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({ value, setValue });
  const navigation = useNavigation();
  const router = useRouter();

  const handleValidar = async () => {
    // Marca que o código foi validado
    await setSecureItem('codigoValidado', 'true');
    // Remove o flag de callback
    await deleteSecureItem('codigoCallback');
    // Volta para a tela anterior
    router.back();
  };

  return (
    <SafeAreaView style={styles.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ position: 'absolute', top: 40, left: 16, zIndex: 10 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back-sharp" size={28} color="#222" />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
          <Image source={lockIcon} style={styles.lockIcon} />
          <Text style={styles.titulo}>Verificação</Text>
          <Text style={styles.instrucao}>
            Digite o código de verificação do cliente Ifood
          </Text>
          <CodeField
            ref={ref}
            {...props}
            value={value}
            onChangeText={setValue}
            cellCount={CELL_COUNT}
            rootStyle={styles.codeFieldRoot}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            renderCell={({ index, symbol, isFocused }) => (
              <View
                key={index}
                style={[styles.campoCodigo, isFocused && styles.focoCampoCodigo]}
                onLayout={getCellOnLayoutHandler(index)}
              >
                <Text style={styles.digito}>{symbol || (isFocused ? <Cursor /> : '')}</Text>
              </View>
            )}
          />
          <TouchableOpacity
            style={[
              styles.botaoVerificar,
              value.length === CELL_COUNT ? styles.botaoVerificarAtivo : styles.botaoVerificarInativo,
            ]}
            onPress={handleValidar}
            disabled={value.length !== CELL_COUNT}
          >
            <Text style={styles.textoBotao}>Verificar</Text>
          </TouchableOpacity>
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 300,
  },
  lockIcon: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#111',
  },
  instrucao: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginBottom: 32,
  },
  codeFieldRoot: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 36,
  },
  campoCodigo: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderRadius: 12,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    backgroundColor: '#f9f9f9',
  },
  focoCampoCodigo: {
    borderColor: '#4285F4',
  },
  digito: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  botaoVerificar: {
    width: '100%',
    maxWidth: 340,
    paddingVertical: 18,
    borderRadius: 32,
    alignItems: 'center',
    marginTop: 10,
  },
  botaoVerificarAtivo: {
    backgroundColor: '#4285F4',
  },
  botaoVerificarInativo: {
    backgroundColor: '#b0c4de',
  },
  textoBotao: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
