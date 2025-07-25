import React, { useRef, useEffect, useState } from 'react';
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
import ModalConfirmarRota from './ModalConfirmarRota';
import PedidosDraggableList from './PedidosDraggableList';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_HEIGHT = 60;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

const animatedHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
// ⬇️ INSIRA AQUI:
const buttonOpacity = animatedHeight.interpolate({
  inputRange: [MIN_HEIGHT, MIN_HEIGHT + 50],
  outputRange: [1, 0],
  extrapolate: 'clamp',
});

const pedidosMock = [
  {
    id: 123,
    id_ifood: 4545,
    cliente: 'Rafael Andrade',
    pagamento: 'Pix',
    statusPagamento: 'pago',
    valorTotal: 32.00,
    endereco: 'Alameda dos Mandarins, 500',
    bairro: 'Grand Ville',
    distanciaKm: 1.8,
    horario: '20:30',
    troco: 'R$50',
    coordinates: { latitude: -18.906376273263426, longitude: -48.215105388963835 },
    itens: [
      { nome: 'X-Burguer', tipo: 'comida', quantidade: 1, valor: 18 },
      { nome: 'Coca 2L', tipo: 'bebida', quantidade: 1, valor: 10 },
      { nome: 'Batata Frita', tipo: 'comida', quantidade: 1, valor: 4 },
    ],
  },
  {
    id: 124,
    id_ifood: 8263,
    cliente: 'Maria Souza',
    pagamento: 'Dinheiro',
    statusPagamento: 'a_receber',
    valorTotal: 15.00,
    endereco: 'Av. Manuel Lúcio, 355',
    bairro: 'Grand Ville',
    distanciaKm: 2.6,
    horario: '19:22',
    troco: 'R$10',
    coordinates: { latitude: -18.910321782284516, longitude: -48.21741885096243 },
    itens: [
      { nome: 'Guaraná', tipo: 'bebida', quantidade: 1, valor: 7 },
      { nome: 'Água', tipo: 'bebida', quantidade: 2, valor: 4 },
    ],
  },
  {
    id: 125,
    id_ifood: 7425,
    cliente: 'João Pedro',
    pagamento: 'Crédito',
    statusPagamento: 'pago',
    valorTotal: 8.00,
    endereco: 'Av. Manuel Lúcio, 155',
    bairro: 'Grand Ville',
    distanciaKm: 0.9,
    horario: '20:00',
    troco: '',
    coordinates: { latitude: -18.90887126021788, longitude: -48.21877699273963 },
    itens: [
      { nome: 'Sprite', tipo: 'bebida', quantidade: 1, valor: 8 },
    ],
  },
  {
    id: 126,
    id_ifood: 6635,
    cliente: 'Ana Paula',
    pagamento: 'Débito',
    statusPagamento: 'a_receber',
    valorTotal: 14.00,
    endereco: 'Av. Anselmo Alves dos Santos, 4925',
    distanciaKm: 3.2,
    horario: '19:55',
    troco: '',
    coordinates: { latitude: -18.905433401263668, longitude: -48.218426601132954 },
    itens: [
      { nome: 'Fanta', tipo: 'bebida', quantidade: 1, valor: 8 },
      { nome: 'Porção de Nuggets', tipo: 'comida', quantidade: 1, valor: 6 },
    ],
  },
  {
    id: 127,
    id_ifood: 6389,
    cliente: 'Carlos Lima',
    pagamento: 'Pix',
    statusPagamento: 'pago',
    valorTotal: 12.00,
    endereco: 'Alameda dos Mandarins, 200',
    bairro: 'Grand Ville',
    distanciaKm: 2.1,
    horario: '21:10',
    troco: '',
    coordinates: { latitude: -18.908385204055833, longitude: -48.21598084877664 },
    itens: [
      { nome: 'Coca L.', tipo: 'bebida', quantidade: 1, valor: 12 },
    ],
  },
];
export default function TelaInicialMap() {
  const animatedHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const router = useRouter();
  const iniciarOpacity = useRef(new Animated.Value(1)).current;
  const confirmarOpacity = useRef(new Animated.Value(0)).current;
  const [mostrandoConfirmar, setMostrandoConfirmar] = useState(false);
  const [emEntrega, setEmEntrega] = useState(false);
  const [isUltimaEntrega, setIsUltimaEntrega] = useState(false);
  const [modalRotaVisible, setModalRotaVisible] = useState(false);
  const [painelNoTopo, setPainelNoTopo] = useState(false);
  const [online, setOnline] = useState(false);
  const [pedidosAceitos, setPedidosAceitos] = useState<any[]>(pedidosMock);
  let lastHeight = MIN_HEIGHT;

  const handleIniciarRota = async () => {
    // grava pedidos e destinos no SecureStore
    await SecureStore.setItemAsync('pedidosCompletos', JSON.stringify(pedidosAceitos));
    const destinos = pedidosAceitos.map(p => ({
      latitude: p.coordinates.latitude,
      longitude: p.coordinates.longitude,
      id_ifood: p.id_ifood,
    }));
    await SecureStore.setItemAsync('destinos', JSON.stringify(destinos));
    await SecureStore.setItemAsync('indiceAtual', '0');
    await SecureStore.setItemAsync('emEntrega', 'true');

    // começa o monitoramento
    iniciarMonitoramentoLocalizacao();

    // atualiza estados + ANIMAÇÕES
    setEmEntrega(true);
    setMostrandoConfirmar(true);
    iniciarOpacity.setValue(0);       // <<-- esconde o botão início
    confirmarOpacity.setValue(1);     // <<-- mostra o botão confirmar entrega

    Alert.alert('Rota iniciada', 'Agora você está em rota de entrega!');
  };



  useEffect(() => {
    const id = animatedHeight.addListener(({ value }) => {
      setPainelNoTopo(value >= MAX_HEIGHT - 20);
    });
    return () => animatedHeight.removeListener(id);
  }, [animatedHeight]);

  useEffect(() => {
    const verificarStatus = async () => {
      const abrir = await SecureStore.getItemAsync('abrirConfirmacaoImediata');
      if (abrir === 'true') {
        const lista = await SecureStore.getItemAsync('pedidosCompletos');
        const destinos = await SecureStore.getItemAsync('destinos');

        if (lista && destinos) {
          await SecureStore.deleteItemAsync('abrirConfirmacaoImediata');
          router.push('/confirmacaoEntrega');
        }
      }

      const emEntregaStatus = await SecureStore.getItemAsync('emEntrega');
      setEmEntrega(emEntregaStatus === 'true');
      if (emEntregaStatus === 'true') {
        setMostrandoConfirmar(true);
        iniciarOpacity.setValue(0);
        confirmarOpacity.setValue(1);
      }

      const onlineStatus = await SecureStore.getItemAsync('online');
      setOnline(onlineStatus === 'true');
    };

    verificarStatus();
    const interval = setInterval(verificarStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checarUltimaEntrega = async () => {
      const lista = await SecureStore.getItemAsync('pedidosCompletos');
      const indiceAtualStr = await SecureStore.getItemAsync('indiceAtual');
      if (lista && indiceAtualStr) {
        const pedidos = JSON.parse(lista);
        const indiceAtual = parseInt(indiceAtualStr, 10);
        setIsUltimaEntrega(indiceAtual >= pedidos.length - 1);
      } else {
        setIsUltimaEntrega(false);
      }
    };
    checarUltimaEntrega();
  }, [mostrandoConfirmar]);

  const finalizarRota = async () => {
    await SecureStore.deleteItemAsync('emEntrega');
    await SecureStore.deleteItemAsync('indiceAtual');
    await SecureStore.deleteItemAsync('pedidosCompletos');
    await SecureStore.deleteItemAsync('destinos');
    setMostrandoConfirmar(false);
    iniciarOpacity.setValue(1);
    confirmarOpacity.setValue(0);
    Alert.alert('Rota finalizada!', 'Todas as entregas foram concluídas.');
  };

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

  const handleIniciar = async () => {
    await SecureStore.setItemAsync('online', 'true');
    setOnline(true);
    Alert.alert('Você está online!', 'Agora pode receber pedidos.');
  };
  const handleAceitarPedido = (pedido: any) => {
    const novosPedidos = [...pedidosAceitos, pedido];
    setPedidosAceitos(novosPedidos);
    setModalRotaVisible(false);
  };

  const handleRecusar = () => {
    setModalRotaVisible(false);
  };


  const handleConfirmar = async () => {
    const lista = await SecureStore.getItemAsync('pedidosCompletos');
    const indiceAtualStr = await SecureStore.getItemAsync('indiceAtual');
    let pedidoAtual = null;
    if (lista && indiceAtualStr) {
      const pedidos = JSON.parse(lista);
      const indiceAtual = parseInt(indiceAtualStr, 10);
      pedidoAtual = pedidos[indiceAtual];
    }
    router.push({
      pathname: '/confirmacaoEntrega',
      params: pedidoAtual ? { ...pedidoAtual, quantidadePedidos: pedidoAtual.quantidadePedidos } : {},
    });
  };

  return (
    <View style={styles.container}>
      <Mapa
        pedidos={pedidosAceitos}
        emEntrega={emEntrega}
      />

      <View style={{ flexDirection: 'row', position: 'absolute', top: 40, right: 20, zIndex: 20, alignItems: 'center' }}>
        {!online && (
          <TouchableOpacity
            onPress={handleIniciar}
            style={{
              backgroundColor: '#2C79FF',
              borderRadius: 12,
              paddingVertical: 6,
              paddingHorizontal: 10,
              marginRight: 8,
              elevation: 2,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>INICIAR</Text>
          </TouchableOpacity>
        )}
        {online && (
          <TouchableOpacity
            style={{ backgroundColor: '#23232b', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18 }}
            onPress={() => setModalRotaVisible(true)}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Testar Modal Rota</Text>
          </TouchableOpacity>
        )}
      </View>

      {modalRotaVisible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <ModalConfirmarRota
            visible={true}
            onAceitar={handleAceitarPedido}
            onRecusar={handleRecusar}
            pedidos={pedidosAceitos}
          />

        </View>
      )}

      <TouchableOpacity style={styles.menuButton}>
        <Ionicons name="menu" size={24} color="#000" />
        <View style={styles.badge} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.valorPainel}>
        <Text style={styles.valorTexto}>R$130,40</Text>
      </TouchableOpacity>

{/* botão “CONFIRMAR PEDIDO” animado acima da barra */}
{emEntrega && (
  <Animated.View
    style={[
      styles.confirmarButton,
      {
        bottom: animatedHeight,              // acompanha a altura da barra
        opacity: animatedHeight.interpolate({
          inputRange: [MIN_HEIGHT, MIN_HEIGHT + 50],
          outputRange: [1, 0],
          extrapolate: 'clamp',
        }),
      },
    ]}
    pointerEvents="auto"
  >
    <TouchableOpacity onPress={handleConfirmar}>
      <Text style={styles.startButtonText}>CONFIRMAR PEDIDO</Text>
    </TouchableOpacity>
  </Animated.View>
)}


      <Animated.View style={[styles.panel, { height: animatedHeight }]} {...panResponder.panHandlers}>
        <View style={styles.handle}>
          <View style={styles.indicator} />
        </View>

        <View style={styles.sheetRow}>
          <Ionicons name="options" size={22} color="#fff" />
          <Text style={styles.bottomText}>{online ? 'Disponível para entregas' : 'Você está offline'}</Text>
          <Ionicons name="menu" size={22} color="#fff" />
        </View>

        <PedidosDraggableList
          pedidos={pedidosAceitos}
          onAtualizarPedidosAceitos={setPedidosAceitos}
        />

        {pedidosAceitos.length > 0 && (
          <Animated.View
            style={{
              opacity: iniciarOpacity,
              alignItems: 'center',
              position: 'absolute',
              bottom: 16,
              left: 0,
              right: 0,
            }}
          >
            <TouchableOpacity style={styles.iniciarRotaButton} onPress={handleIniciarRota}>
              <Text style={styles.iniciarRotaButtonText}>Iniciar Rota</Text>
            </TouchableOpacity>
          </Animated.View>

        )}
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
  iniciarRotaButton: {
    backgroundColor: '#2C79FF',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    marginTop: 8,
  },
  iniciarRotaButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
  confirmarButton: {
      position: 'absolute',
       alignSelf: 'center',
       backgroundColor: '#4CAF50',
       width: 160,
       height: 48,
       borderRadius: 24,
       alignItems: 'center',
       justifyContent: 'center',
       elevation: 8,
       zIndex: 10,
     },
    
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,         // um pouquinho menor
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
