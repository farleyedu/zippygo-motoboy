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
import ModalConfirmarRota from '../components/ModalConfirmarRota';
import PedidosDraggableList from '../components/PedidosDraggableList';
import { useAuth } from '../src/contexts/AuthContext';
import { useFetchPedidos } from '../hooks/useFetchPedidos';
import {
  clearOperationalSession,
  endOperationalSession,
  getOperationalSession,
  heartbeatOperationalSession,
  queueToPedidos,
  startOperationalSession,
} from '../services/mobileApi';
import {
  clearTrackingMode,
  flushLocationQueue,
  setTrackingMode,
} from '../services/trackingService';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_HEIGHT = 100;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

// Dados mockados removidos - agora usando dados reais da API
export default function TelaInicialMap() {
  const insets = useSafeAreaInsets();
  const animatedHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const router = useRouter();
  const {
    user,
    estabelecimentoAtual,
    isLoading: authLoading,
    needsEstablishmentSelection,
    needsLinkRequest,
  } = useAuth();
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
  const {
    pedidos: pedidosDisponiveis,
    queue,
    loading: loadingPedidos,
    error: errorPedidos,
    refetch,
    acceptOffer,
    rejectOffer,
    resumeQueue,
  } = useFetchPedidos();

  let lastHeight = MIN_HEIGHT;

  // Eleva a altura inicial do painel para fora da área de gestos do sistema
  useEffect(() => {
    const safeStart = MIN_HEIGHT + insets.bottom + 24; // sobe mais no estado inicial
    animatedHeight.setValue(safeStart);
    lastHeight = safeStart;
    setMinSnapHeight(safeStart);
  }, [insets.bottom]);

  const handleIniciarRota = async () => {
    try {
      const nextQueue = await resumeQueue();
      setPedidosAceitos(queueToPedidos(nextQueue));
      setOrganizandoRota(false);
      setEmEntrega(true);
      setMostrandoConfirmar(true);
      iniciarOpacity.setValue(0);
      confirmarOpacity.setValue(1);
      await setTrackingMode('active_route');
      const started = await iniciarMonitoramentoLocalizacao('active_route');
      if (!started) {
        Alert.alert('Localização necessária', 'Permita o acesso à localização para continuar em rota.');
      }
    } catch (caught: any) {
      Alert.alert('Não foi possível iniciar a rota', caught?.message ?? 'Tente novamente.');
    }
  };

  useEffect(() => {
    const id = animatedHeight.addListener(({ value }) => {
      setPainelNoTopo(value >= MAX_HEIGHT - 20);
    });
    return () => animatedHeight.removeListener(id);
  }, [animatedHeight]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (needsLinkRequest) {
      router.replace('/solicitarRestaurante' as any);
      return;
    }
    if (needsEstablishmentSelection && !estabelecimentoAtual) {
      router.replace('/selecionarRestaurante' as any);
    }
  }, [authLoading, user, needsEstablishmentSelection, needsLinkRequest, estabelecimentoAtual, router]);

  useEffect(() => {
    const restoreOperationalSession = async () => {
      if (authLoading || !user || !estabelecimentoAtual) return;

      try {
        const session = await getOperationalSession();
        if (!session || session.isEnded) return;

        setOnline(true);
        await setTrackingMode('online_idle');
        const started = await iniciarMonitoramentoLocalizacao('online_idle');
        if (!started) {
          await endOperationalSession('location_permission_denied');
          setOnline(false);
          return;
        }
        await refetch();
      } catch {
        await clearOperationalSession();
      }
    };

    void restoreOperationalSession();
  }, [authLoading, user, estabelecimentoAtual, refetch]);

  useEffect(() => {
    setPedidosAceitos(pedidosDisponiveis);
    if (queue?.current) {
      setEmEntrega(true);
      setOrganizandoRota(false);
      setMostrandoConfirmar(true);
      iniciarOpacity.setValue(0);
      confirmarOpacity.setValue(1);
    } else if (emEntrega && !queue?.next?.length) {
      setEmEntrega(false);
      setMostrandoConfirmar(false);
      iniciarOpacity.setValue(1);
      confirmarOpacity.setValue(0);
    }
  }, [pedidosDisponiveis, queue, emEntrega]);

  useFocusEffect(
    React.useCallback(() => {
      setRecenterToken((t) => t + 1);
      void refetch();
      return () => {};
    }, [refetch]),
  );

  useEffect(() => {
    if (!online) return;
    const interval = setInterval(() => {
      void refetch();
    }, 15000);
    return () => clearInterval(interval);
  }, [online, refetch]);

  useEffect(() => {
    if (!online) return;
    const interval = setInterval(() => {
      heartbeatOperationalSession().catch((caught) => {
        console.warn('[SESSION] Falha no heartbeat operacional:', caught);
      });
    }, 20000);
    return () => clearInterval(interval);
  }, [online]);

  useEffect(() => {
    if (modalRotaVisible && (!online || emEntrega || organizandoRota)) {
      setModalRotaVisible(false);
    }
  }, [online, emEntrega, organizandoRota, modalRotaVisible]);

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
    let operationalSessionStarted = false;
    try {
      await startOperationalSession();
      operationalSessionStarted = true;
      await setTrackingMode('online_idle');
      const started = await iniciarMonitoramentoLocalizacao('online_idle');
      if (!started) {
        await endOperationalSession('location_permission_denied');
        Alert.alert('Localização necessária', 'Permita o acesso à localização para ficar online.');
        return;
      }
      setOnline(true);
      await refetch();
      Alert.alert('Você está online!', 'Agora pode receber pedidos.');
    } catch (caught: any) {
      if (operationalSessionStarted) {
        await endOperationalSession('startup_failed').catch(() => undefined);
      }
      await clearOperationalSession();
      Alert.alert('Não foi possível ficar online', caught?.message ?? 'Tente novamente.');
    }
  };

  const finalizarOffline = async () => {
    try {
      await flushLocationQueue();
      await pararMonitoramentoLocalizacao();
      await endOperationalSession('motoboy_offline');
    } catch (caught: any) {
      Alert.alert('Erro ao ficar offline', caught?.message ?? 'Tente novamente.');
    } finally {
      await clearTrackingMode();
      setOnline(false);
      setEmEntrega(false);
      setOrganizandoRota(false);
      setPedidosAceitos([]);
      await refetch();
    }
  };

  const handleFicarOffline = () => {
    if (emEntrega) {
      Alert.alert('Ação não permitida', 'Você está em rota. Finalize a entrega atual antes de ficar offline.');
      return;
    }

    if (organizandoRota && pedidosAceitos.length > 0) {
      Alert.alert(
        'Cancelar organização de rota',
        'Os pedidos serão devolvidos para a pizzaria. Deseja continuar?',
        [
          { text: 'Não' },
          { text: 'Sim', onPress: () => void finalizarOffline() },
        ],
      );
      return;
    }

    void finalizarOffline();
  };

  const handleAceitarPedido = async () => {
    try {
      const nextQueue = await acceptOffer();
      setPedidosAceitos(queueToPedidos(nextQueue));
      setModalRotaVisible(false);
      setOrganizandoRota(true);
    } catch (caught: any) {
      Alert.alert('Oferta indisponível', caught?.message ?? 'A oferta mudou ou expirou.');
      setModalRotaVisible(false);
    }
  };

  const handleRecusar = async () => {
    try {
      await rejectOffer('recusada_pelo_motoboy');
    } catch (caught: any) {
      Alert.alert('Não foi possível recusar', caught?.message ?? 'Tente novamente.');
    } finally {
      setModalRotaVisible(false);
    }
  };

  const obterPedidoAtual = () => {
    const currentId = queue?.current?.pedido?.id;
    return pedidosAceitos.find((item) => item.id === currentId) ?? pedidosAceitos[0] ?? null;
  };

  const handleConfirmar = async () => {
    const pedidoAtual = obterPedidoAtual();
    if (!pedidoAtual) {
      Alert.alert('Entrega indisponível', 'A fila ainda não possui uma entrega atual.');
      return;
    }

    router.push({
       pathname: '/ExemploSacolaScreen',
      params: {
        id: String(pedidoAtual.id),
        nome: pedidoAtual.nomeCliente ?? '--',
        bairro: pedidoAtual.bairro ?? '',
        endereco: pedidoAtual.enderecoEntrega ?? '--',
        statusPagamento: pedidoAtual.statusPagamento ?? '',
        valorTotal: String(pedidoAtual.valor ?? pedidoAtual.total_valor ?? 0),
        telefone: pedidoAtual.telefoneCliente ?? '',
        horario: pedidoAtual.horario ?? pedidoAtual.dataPedido ?? '',
        observacoes: pedidoAtual.observacoes ?? '',
        itens: JSON.stringify(pedidoAtual.itens ?? []),
        coordinates: JSON.stringify(pedidoAtual.coordinates ?? null),
      },
    });
  };

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
              onPress={handleFicarOffline}
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
