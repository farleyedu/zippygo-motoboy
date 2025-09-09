import React, { useRef, useEffect, useState } from 'react';
import { iniciarMonitoramentoLocalizacao, pararMonitoramentoLocalizacao } from '../components/locationSetup';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Mapa from '../components/Mapa';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secureStorage';
import ModalConfirmarRota from '../components/ModalConfirmarRota';
import PedidosDraggableList from '../components/PedidosDraggableList';
import { useAuth } from '../src/contexts/AuthContext';
import { useFetchPedidos } from '../hooks/useFetchPedidos';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_HEIGHT = 100;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

// Dados mockados removidos - agora usando dados reais da API
export default function TelaInicialMap() {
  const insets = useSafeAreaInsets();
  const animatedHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const router = useRouter();
  const { user } = useAuth();
  const [recenterToken, setRecenterToken] = useState(0);
  const [minSnapHeight, setMinSnapHeight] = useState(MIN_HEIGHT);
  const iniciarOpacity = useRef(new Animated.Value(1)).current;
  const confirmarOpacity = useRef(new Animated.Value(0)).current;
  const [mostrandoConfirmar, setMostrandoConfirmar] = useState(false);
  const [emEntrega, setEmEntrega] = useState(false);
  const [isUltimaEntrega, setIsUltimaEntrega] = useState(false);
  const [modalRotaVisible, setModalRotaVisible] = useState(false);
  const [painelNoTopo, setPainelNoTopo] = useState(false);
  const [online, setOnline] = useState(false);
  const [pedidosAceitos, setPedidosAceitos] = useState<any[]>([]);
  const [organizandoRota, setOrganizandoRota] = useState(false);

  // Hook para buscar pedidos disponíveis
  const { pedidos: pedidosDisponiveis, loading: loadingPedidos, error: errorPedidos, refetch } = useFetchPedidos({ status: 'disponivel' });

  let lastHeight = MIN_HEIGHT;

  // Eleva a altura inicial do painel para fora da área de gestos do sistema
  useEffect(() => {
    const safeStart = MIN_HEIGHT + insets.bottom + 24; // sobe mais no estado inicial
    animatedHeight.setValue(safeStart);
    lastHeight = safeStart;
    setMinSnapHeight(safeStart);
  }, [insets.bottom]);

  const handleIniciarRota = async () => {
    // grava pedidos e destinos no SecureStore
    await setSecureItem('pedidosCompletos', JSON.stringify(pedidosAceitos));
    const destinos = pedidosAceitos.map(p => ({
      latitude: p.coordinates.lat,
      longitude: p.coordinates.lng,
      id: p.id,
    }));
    await setSecureItem('destinos', JSON.stringify(destinos));
    await setSecureItem('indiceAtual', '0');
    await setSecureItem('emEntrega', 'true');

    // começa o monitoramento
    iniciarMonitoramentoLocalizacao();

    // atualiza estados + ANIMAÇÕES
    setEmEntrega(true);
    setMostrandoConfirmar(true);
    iniciarOpacity.setValue(0);       // <<-- esconde o botão início
    confirmarOpacity.setValue(1);     // <<-- mostra o botão confirmar entrega
    setOrganizandoRota(false);


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
      const abrir = await getSecureItem('abrirConfirmacaoImediata');
    if (abrir === 'true') {
      const lista = await getSecureItem('pedidosCompletos');
      const destinos = await getSecureItem('destinos');

        if (lista && destinos) {
          await deleteSecureItem('abrirConfirmacaoImediata');
          router.push('/confirmacaoEntrega');
        }
      }

      const emEntregaStatus = await getSecureItem('emEntrega');
      setEmEntrega(emEntregaStatus === 'true');
      if (emEntregaStatus === 'true') {
        setMostrandoConfirmar(true);
        iniciarOpacity.setValue(0);
        confirmarOpacity.setValue(1);
        // Recarrega pedidos no painel ao voltar para a tela
        const pedidosStr = await getSecureItem('pedidosCompletos');
        if (pedidosStr) {
          const pedidos = JSON.parse(pedidosStr);
          setPedidosAceitos(pedidos);
        }
      }

      const onlineStatus = await getSecureItem('online');
      setOnline(onlineStatus === 'true');
    };

    verificarStatus();
    const interval = setInterval(verificarStatus, 10000); // Reduzido de 2s para 10s
    return () => clearInterval(interval);
  }, []);

  // useEffect separado para controlar o modal baseado nos estados
  useEffect(() => {
    // Fecha modal se o estado não permitir mais receber pedidos
    if (modalRotaVisible && (!online || emEntrega || organizandoRota)) {
      setModalRotaVisible(false);
    }
  }, [online, emEntrega, organizandoRota, modalRotaVisible]);

  // Ao focar novamente esta tela (voltar de confirmacaoEntrega), recentraliza no usuário
  useFocusEffect(
    React.useCallback(() => {
      setRecenterToken((t) => t + 1);
      return () => { };
    }, [])
  );

  useEffect(() => {
    const checarUltimaEntrega = async () => {
      const lista = await getSecureItem('pedidosCompletos');
    const indiceAtualStr = await getSecureItem('indiceAtual');
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
    await deleteSecureItem('emEntrega');
    await deleteSecureItem('indiceAtual');
    await deleteSecureItem('pedidosCompletos');
    await deleteSecureItem('destinos');
    setMostrandoConfirmar(false);
    iniciarOpacity.setValue(1);
    confirmarOpacity.setValue(0);

    // Para o monitoramento de localização
    await pararMonitoramentoLocalizacao();

    Alert.alert('Rota finalizada!', 'Todas as entregas foram concluídas.');
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,

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
    await setSecureItem('online', 'true');
    setOnline(true);
    Alert.alert('Você está online!', 'Agora pode receber pedidos.');
  };
  const handleAceitarPedido = (pedidosRecebidos: any[]) => {
    const novosPedidos = [...pedidosRecebidos];
    setPedidosAceitos(novosPedidos);
    setModalRotaVisible(false);
    setOrganizandoRota(true);
    // Pequeno atraso para garantir layout antes do fit no mapa
    setTimeout(() => setPedidosAceitos((prev) => [...novosPedidos]), 50);
  };


  const handleRecusar = () => {
    setModalRotaVisible(false);
  };


  const handleConfirmar = async () => {
    const lista = await getSecureItem('pedidosCompletos');
    const indiceAtualStr = await getSecureItem('indiceAtual');
    let pedidoAtual = null;
    if (lista && indiceAtualStr) {
      const pedidos = JSON.parse(lista);
      const indiceAtual = parseInt(indiceAtualStr, 10);
      pedidoAtual = pedidos[indiceAtual];
    }
    // COLOCAR NO LUGAR (RECOMENDADO)
    if (!pedidoAtual) return;

    router.push({
      pathname: '/confirmacaoEntrega',
      params: {
        id: String(pedidoAtual.id || 0),
        nome: pedidoAtual.nomeCliente ?? '--',
        bairro: pedidoAtual.bairro ?? '',
        endereco: pedidoAtual.enderecoEntrega ?? '--',
        statusPagamento: pedidoAtual.statusPagamento ?? '',
        valorTotal: String(pedidoAtual.valorTotal ?? 0),
        telefone: pedidoAtual.telefoneCliente ?? '',
        horario: pedidoAtual.dataPedido ?? '',
        observacoes: pedidoAtual.observacoes ?? '',
        itens: JSON.stringify(pedidoAtual.itens ?? []),
        coordinates: JSON.stringify(pedidoAtual.coordinates ?? null),
      },
    });

  };

  const handleAbrirSacola = async () => {
    const lista = await getSecureItem('pedidosCompletos');
    const indiceAtualStr = await getSecureItem('indiceAtual');
    let pedidoAtual = null;
    if (lista && indiceAtualStr) {
      const pedidos = JSON.parse(lista);
      const indiceAtual = parseInt(indiceAtualStr, 10);
      pedidoAtual = pedidos[indiceAtual];
    }
    
    if (!pedidoAtual) return;

    router.push({
      pathname: '/ExemploSacolaScreen',
      params: {
        id: String(pedidoAtual.id || 0),
        nome: pedidoAtual.nomeCliente ?? '--',
        bairro: pedidoAtual.bairro ?? '',
        endereco: pedidoAtual.enderecoEntrega ?? '--',
        statusPagamento: pedidoAtual.statusPagamento ?? '',
        valorTotal: String(pedidoAtual.valorTotal ?? 0),
        telefone: pedidoAtual.telefoneCliente ?? '',
        horario: pedidoAtual.dataPedido ?? '',
        observacoes: pedidoAtual.observacoes ?? '',
        itens: JSON.stringify(pedidoAtual.itens ?? []),
        coordinates: JSON.stringify(pedidoAtual.coordinates ?? null),
      },
    });
  };

  
  useEffect(() => {
    const atualizarPedidosEmEntrega = async () => {
      const pedidosStr = await getSecureItem('pedidosCompletos');
    const indiceStr = await getSecureItem('indiceAtual');
      if (pedidosStr && indiceStr) {
        const pedidos = JSON.parse(pedidosStr);
        // Não usar slice: manter a lista completa e usar indiceAtual no mapa
        setPedidosAceitos(pedidos);
      }
    };

    if (emEntrega) {
      atualizarPedidosEmEntrega();
    }
  }, [emEntrega])

  return (
    <View style={styles.container}>
      <Mapa pedidos={pedidosAceitos} emEntrega={emEntrega} recenterToken={recenterToken} />
      <View style={{ flexDirection: 'row', position: 'absolute', top: insets.top + 8, right: 20, zIndex: 20, alignItems: 'center' }}>
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
          <>
            {(!emEntrega && !organizandoRota) && (
              <TouchableOpacity
                style={{ backgroundColor: '#23232b', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 10, marginLeft: 50, marginTop: 50 }}
                onPress={() => {
                  if (!online || emEntrega || organizandoRota) {
                    Alert.alert('Indisponível', 'Você só pode aceitar pedidos quando estiver disponível.');
                    return;
                  }
                  setModalRotaVisible(true);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Receber Pedidos</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{ backgroundColor: '#ff4444', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18 }}
              onPress={async () => {
                if (emEntrega) {
                  Alert.alert('Ação não permitida', 'Você está em rota. Finalize a rota para ficar offline.');
                  return;
                }
                if (organizandoRota && pedidosAceitos.length > 0) {
                  Alert.alert(
                    'Cancelar organização de rota',
                    'Os pedidos serão devolvidos para a pizzaria. Deseja continuar?',
                    [
                      { text: 'Não' },
                      {
                        text: 'Sim',
                        onPress: async () => {
                          setPedidosAceitos([]);
                          setOrganizandoRota(false);
                          await setSecureItem('online', 'false');
                          setOnline(false);
                          Alert.alert('Status atualizado', 'Você está agora offline.');
                        },
                      },
                    ]
                  );
                  return;
                }
                await setSecureItem('online', 'false');
                setOnline(false);
                Alert.alert('Status atualizado', 'Você está agora offline.');
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Ficar Offline</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {modalRotaVisible && online && !emEntrega && !organizandoRota && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <ModalConfirmarRota
            visible={true}
            onAceitar={handleAceitarPedido}
            onRecusar={handleRecusar}
            pedidos={loadingPedidos ? [] : pedidosDisponiveis}
          />
        </View>
      )}

      <TouchableOpacity style={[styles.menuButton, { top: insets.top + 10 }]}>
        <Ionicons name="menu" size={24} color="#000" />
        <View style={styles.badge} />
      </TouchableOpacity>



      <TouchableOpacity style={[styles.valorPainel, { top: insets.top + 10 }]}> 
        <Text style={styles.valorTexto}>Olá, {user?.nome || 'Motoboy'}</Text>
      </TouchableOpacity>

      {/* Botão auxiliar (demo) para abrir a Sacola diretamente no device - só visível quando em rota */}
      {emEntrega && (
        <TouchableOpacity
          style={[styles.sacolaDemoButton, { top: insets.top + 100 }]}
          onPress={handleAbrirSacola}
          accessibilityRole="button"
          accessibilityLabel="Abrir Sacola (demo)"
          testID="btn-abrir-sacola-demo-inline"
        >
          <Text style={styles.sacolaDemoButtonText}>Sacola (demo)</Text>
        </TouchableOpacity>
      )}


      {emEntrega && (
        <Animated.View
          style={[
            styles.confirmarButton,
            {
              // Posiciona logo acima da barra, sem duplicar o insets.bottom
              bottom: Animated.add(animatedHeight, new Animated.Value(6)),
              opacity: animatedHeight.interpolate({
                // Visível quando a barra está minimizada (na altura mínima real)
                inputRange: [minSnapHeight, minSnapHeight + 40],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
          pointerEvents="auto"
        >
          <TouchableOpacity onPress={handleConfirmar} disabled={!emEntrega}>
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
          <Text style={styles.bottomText}>
            {!online
              ? 'Você está offline'
              : organizandoRota
                ? 'Organize sua rota de entrega'
                : 'Disponível para entregas'}
          </Text>

          <TouchableOpacity
            onPress={() => {
              const destino = painelNoTopo ? MIN_HEIGHT : MAX_HEIGHT;
              Animated.spring(animatedHeight, {
                toValue: destino,
                useNativeDriver: false,
              }).start();
            }}
          >
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {online && (organizandoRota || emEntrega) && (
          <PedidosDraggableList
            pedidos={pedidosAceitos}
            onAtualizarPedidosAceitos={setPedidosAceitos}
            bottomInset={72}
            dragEnabled={!emEntrega}
          />
        )}

        {online && !organizandoRota && !emEntrega && (
          loadingPedidos ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Carregando pedidos...</Text>
            </View>
          ) : errorPedidos ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#ff6b6b', fontSize: 16, marginBottom: 10 }}>Erro ao carregar pedidos</Text>
              <TouchableOpacity 
                onPress={refetch}
                style={{ backgroundColor: '#2C79FF', padding: 10, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <PedidosDraggableList
              pedidos={pedidosDisponiveis}
              onAtualizarPedidosAceitos={setPedidosAceitos}
              bottomInset={72}
              dragEnabled={false}
            />
          )
        )}



        {organizandoRota && pedidosAceitos.length > 0 && (
          <Animated.View
            style={[
              styles.fixedFooter,
              {
                opacity: animatedHeight.interpolate({
                  inputRange: [MIN_HEIGHT, MIN_HEIGHT + 40],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                bottom: 36 + insets.bottom,
              },
            ]}
            pointerEvents="auto"
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
  fixedFooter: {
    position: 'absolute',
    bottom: 36,
    left: 16,
    right: 16,
    zIndex: 50,
    alignItems: 'center',
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
  novaEntregaButton: {
    position: 'absolute',
    right: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#2C79FF',
    borderRadius: 16,
    zIndex: 10,
  },
  novaEntregaButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  sacolaDemoButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
    elevation: 12,
  },
  sacolaDemoButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
