import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mapa from './Mapa';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_HEIGHT = 80;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.5;

export default function TelaInicialMap() {
  const animatedHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const router = useRouter();
  let lastHeight = MIN_HEIGHT;

  // Verifica se chegou ao destino
  useEffect(() => {
    const interval = setInterval(async () => {
      const chegou = await AsyncStorage.getItem('chegouNoDestino');
      if (chegou === 'true') {
        await AsyncStorage.removeItem('chegouNoDestino');
        router.push('/confirmacaoEntrega'); // ou replace
      }
    }, 3000); // verifica a cada 3 segundos

    return () => clearInterval(interval);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy < -10 || gesture.dy > 10,

      onPanResponderMove: (_, gesture) => {
        let newHeight = lastHeight - gesture.dy;
        newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
        animatedHeight.setValue(newHeight);
      },

      onPanResponderRelease: (_, gesture) => {
        let finalHeight;

        if (gesture.dy < -50) {
          finalHeight = MAX_HEIGHT;
        } else if (gesture.dy > 50) {
          finalHeight = MIN_HEIGHT;
        } else {
          animatedHeight.stopAnimation((currentValue) => {
            finalHeight = currentValue;
            Animated.spring(animatedHeight, {
              toValue: finalHeight,
              useNativeDriver: false,
            }).start();
          });
          return;
        }

        lastHeight = finalHeight;
        Animated.spring(animatedHeight, {
          toValue: finalHeight,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Mapa de fundo */}
      <Mapa />

      {/* Menu superior esquerdo */}
      <TouchableOpacity style={styles.menuButton}>
        <Ionicons name="menu" size={24} color="#000" />
        <View style={styles.badge} />
      </TouchableOpacity>

      {/* Valor no topo */}
      <TouchableOpacity style={styles.valorPainel}>
        <Text style={styles.valorTexto}>R$130,40</Text>
      </TouchableOpacity>

      {/* Botão flutuante INICIAR */}
      <TouchableOpacity style={styles.floatingStartButton}>
        <Text style={styles.startButtonText}>INICIAR</Text>
      </TouchableOpacity>

      {/* Painel inferior animado */}
      <Animated.View style={[styles.panel, { height: animatedHeight }]}>
        <View style={styles.handle} {...panResponder.panHandlers}>
          <View style={styles.indicator} />
        </View>

        <View style={styles.sheetRow}>
          <Ionicons name="options" size={22} color="#fff" />
          <Text style={styles.bottomText}>Você está offline</Text>
          <Ionicons name="menu" size={22} color="#fff" />
        </View>
      </Animated.View>

      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 40,
          right: 20,
          backgroundColor: '#6c47ff',
          padding: 12,
          borderRadius: 30,
          elevation: 5,
          zIndex: 20,
        }}
        onPress={async () => {
          // Corrigindo: Location.hasStartedLocationUpdatesAsync não existe diretamente em Location
          // Importar corretamente do expo-location
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const Location = require('expo-location');
          let isRunning = false;
          try {
            isRunning = await Location.hasStartedLocationUpdatesAsync
              ? await Location.hasStartedLocationUpdatesAsync('background-location-task')
              : false;
          } catch (e) {
            console.log('[DEBUG] Erro ao verificar task:', e);
          }
          console.log('[DEBUG] Task está rodando?', isRunning);

    await AsyncStorage.setItem('chegouNoDestino', 'true');
    console.log('[DEBUG] Flag "chegouNoDestino" setada manualmente.');
  }}
>
  <Text style={{ color: '#fff' }}>DEBUG</Text>
</TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 50,
    elevation: 5,
    zIndex: 10,
  },
  badge: {
    width: 8,
    height: 8,
    backgroundColor: 'red',
    borderRadius: 4,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  valorPainel: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: '#2c264c',
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 20,
    zIndex: 10,
  },
  valorTexto: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  iconCircle: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 25,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingStartButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#2C79FF',
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 10,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121212',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    zIndex: 5,
  },
  handle: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 40,
    height: 5,
    backgroundColor: '#444',
    borderRadius: 3,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bottomText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  attachedIcon: {
    position: 'absolute',
    right: 20,
    bottom: 10,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 25,
    elevation: 3,
    zIndex: 10,
  },
  bottomButtonWrapper: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
});
