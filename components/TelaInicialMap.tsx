import React, { useRef, useEffect } from 'react';
import { iniciarMonitoramentoLocalizacao } from './locationSetup';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mapa from './Mapa';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_HEIGHT = 80;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.5;

export default function TelaInicialMap() {
  const animatedHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const router = useRouter();
  let lastHeight = MIN_HEIGHT;

  useEffect(() => {
    const interval = setInterval(async () => {
      const abrir = await SecureStore.getItemAsync('abrirConfirmacaoImediata');
      if (abrir === 'true') {
        const lista = await SecureStore.getItemAsync('pedidosCompletos');
        const destinos = await SecureStore.getItemAsync('destinos');

        if (lista && destinos) {
          await SecureStore.deleteItemAsync('abrirConfirmacaoImediata');
          router.push('/confirmacaoEntrega');
        } else {
          console.warn('[ROTA] Dados ainda não foram carregados. Ignorando navegação prematura.');
        }
      }
    }, 2000);

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
      <Mapa />

      <TouchableOpacity style={styles.menuButton}>
        <Ionicons name="menu" size={24} color="#000" />
        <View style={styles.badge} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.valorPainel}>
        <Text style={styles.valorTexto}>R$130,40</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.floatingStartButton}
        onPress={async () => {
          const PEDIDOS_COMPLETOS = [
            {
              id_ifood: '2502',
              nome: 'Rafael Andrade',
              endereco: 'Rua Tenente Virmondes, 100',
              bairro: 'Centro',
              telefone: '34 98312-8494',
              valor: 30.0,
              itens: ['Esfirra de Carne'],
              coordenadas: { latitude: -18.90634530461159, longitude: -48.21510163215173 },
              previsaoEntrega: '18:45',
              localizador: '',
              horarioEntrega: '00:00',
            },
            {
              id_ifood: '6905',
              nome: 'Farley Eduardo',
              endereco: 'Alameda dos Mandarins, 500',
              bairro: 'Gran Ville',
              telefone: '0800 705 2030',
              valor: 0.05,
              itens: ['Molho de alho'],
              coordenadas: { latitude: -18.908488035066984, longitude: -48.2158833365095 },
              previsaoEntrega: '',
              localizador: '98587969',
              horarioEntrega: '',
            },
            {
              id_ifood: '2520',
              nome: 'Cliente20',
              endereco: 'Av. João Naves de Ávila, 2121',
              bairro: 'Santa Mônica',
              telefone: '34 99399-8355',
              valor: 50.0,
              itens: ['Pizza Calabresa'],
              coordenadas: { latitude: -18.910364455064727, longitude: -48.21749894463129 },
              previsaoEntrega: '18:40',
              localizador: '',
              horarioEntrega: '',
            },
            {
              id_ifood: '2517',
              nome: 'Cliente17',
              endereco: 'Av. Sucupira, 662',
              bairro: 'Res. Integração',
              telefone: '34 98869-7955',
              valor: 40.0,
              itens: ['Macarrão à Bolonhesa'],
              coordenadas: { latitude: -18.908455370640972, longitude: -48.21931968828666 },
              previsaoEntrega: '19:15',
              localizador: '',
              horarioEntrega: '',
            },
            {
              id_ifood: '2506',
              nome: 'Cliente06',
              endereco: 'R. Marceli Manoel Barcelos, 328',
              bairro: 'Jardim Ipanema',
              telefone: '34 98287-1378',
              valor: 55.0,
              itens: ['Feijoada Completa'],
              coordenadas: { latitude: -18.90546969116638, longitude: -48.218424489322764 },
              previsaoEntrega: '19:10',
              localizador: '',
              horarioEntrega: '',
            },
          ];
        
          await SecureStore.setItemAsync('pedidosCompletos', JSON.stringify(PEDIDOS_COMPLETOS));
          await SecureStore.setItemAsync(
            'destinos',
            JSON.stringify(PEDIDOS_COMPLETOS.map((p) => p.coordenadas))
          );
          await SecureStore.setItemAsync('indiceAtual', '0');
          await SecureStore.deleteItemAsync('destinosNotificados'); // ⬅️ Correção aqui
        
          Alert.alert('Entregas iniciadas!', 'Boa rota!');
          await iniciarMonitoramentoLocalizacao();
          console.log('TASK', 'Monitoramento iniciado!', 'Boa rota!');
        }}
        
      >
        <Text style={styles.startButtonText}>INICIAR</Text>
      </TouchableOpacity>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
});
