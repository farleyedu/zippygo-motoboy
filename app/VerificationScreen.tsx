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
import { Stack } from 'expo-router';
import { useNavigation, useRoute } from '@react-navigation/native';

const CELL_COUNT = 4;
const lockIcon = require('../assets/images/lock.png'); // ajuste o caminho se necessário

export default function VerificationScreen() {
  const [value, setValue] = useState('');
  const ref = useBlurOnFulfill({ value, cellCount: CELL_COUNT });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({ value, setValue });
  const navigation = useNavigation();
  const route = useRoute();
  // @ts-ignore
  const onSuccess = route.params?.onSuccess;

  const handleValidar = () => {
    if (onSuccess) onSuccess();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={32}
      >
        <View style={styles.container}>
          <Image source={lockIcon} style={styles.lockIcon} />
          <Text style={styles.titulo}>Verificação</Text>
          <Text style={styles.instrucao}>
            Digite o código de verificação que enviamos para seu e-mail
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
      </KeyboardAvoidingView>
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
