"use client";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import {
  MapPin,
  AlertTriangle,
  ArrowLeft,
  MessageCircle,
  Check,
  Clock,
  Settings,
  Edit3,
  DollarSign,
  QrCode,
  CreditCard,
  Phone,
  ChevronDown,
  FileText,
  Ban,
  Coffee,
  Utensils,
  Key,
} from "lucide-react-native";
import Feather from '@expo/vector-icons/Feather';
import { getSecureItem } from '../utils/secureStorage';
import { useFocusEffect } from '@react-navigation/native';

export default function EntregaNovaScreen() {
  const [metodoSelecionado, setMetodoSelecionado] =
    useState<null | "dinheiro" | "pix" | "debito" | "credito">(null);
  const [mostrarAvisoMetodo, setMostrarAvisoMetodo] = useState(false);
  const [mostrarAcoesTelefone, setMostrarAcoesTelefone] = useState(false);
  const [codigoSolicitado, setCodigoSolicitado] = useState(false);
  const [codigoValidado, setCodigoValidado] = useState(false);
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [refundProgress, setRefundProgress] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const scaleAnim = new Animated.Value(1);
  const glowAnim = new Animated.Value(0);

  // Comentado para facilitar testes - sempre inicia solicitando código
  // useEffect(() => {
  //   const carregarEstadoCodigo = async () => {
  //     try {
  //       const codigoValidadoSalvo = await getSecureItem('codigoValidado');
  //       if (codigoValidadoSalvo === 'true') {
  //         setCodigoValidado(true);
  //         setCodigoSolicitado(true);
  //       }
  //     } catch (error) {
  //       console.log('Erro ao carregar estado do código:', error);
  //     }
  //   };
  //   
  //   carregarEstadoCodigo();
  // }, []);

  // Recarregar estado quando a tela receber foco (volta da VerificationScreen)
  useFocusEffect(
    React.useCallback(() => {
      const verificarCodigoValidado = async () => {
        try {
          const codigoValidadoSalvo = await getSecureItem('codigoValidado');
          if (codigoValidadoSalvo === 'true') {
            setCodigoValidado(true);
            setCodigoSolicitado(true);
          }
        } catch (error) {
          console.log('Erro ao verificar código validado:', error);
        }
      };
      
      verificarCodigoValidado();
    }, [])
  );

  const handleCobrar = () => {
    if (!metodoSelecionado) {
      setMostrarAvisoMetodo(true);
      setTimeout(() => setMostrarAvisoMetodo(false), 2000);
      return;
    }
    // Confirma o pagamento
    setPagamentoConfirmado(true);
  };

  const handleEditarPagamento = () => {
    // Permite editar o pagamento voltando ao estado anterior
    setPagamentoConfirmado(false);
  };

  const startRefundProcess = () => {
    if (isProcessingRefund) return;
    
    setIsProcessingRefund(true);
    setRefundProgress(0);
    
    // Animações de início
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
    
    const timer = setInterval(() => {
      setRefundProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          // Animação de conclusão
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.05,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
          
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }).start();
          
          // Volta ao estado não cobrado
          setTimeout(() => {
            setPagamentoConfirmado(false);
            setIsProcessingRefund(false);
            setRefundProgress(0);
          }, 500);
          return 100;
        }
        return prev + 2; // 2% a cada 40ms = 2 segundos total
      });
    }, 40);
    
    setLongPressTimer(timer);
  };
  
  const cancelRefundProcess = () => {
    if (longPressTimer) {
      clearInterval(longPressTimer);
      setLongPressTimer(null);
    }
    
    // Animações de cancelamento
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
    
    setIsProcessingRefund(false);
    setRefundProgress(0);
  };

  const handleSolicitarCodigo = () => {
    // Navegar para tela de verificação
    router.push('/VerificationScreen');
    setCodigoSolicitado(true);
  };

  const handleAcaoTelefone = (acao: "ligar" | "whatsapp") => {
    // Em RN puro, usar Linking; mantendo stub por enquanto
    // Linking.openURL("tel:+5511999999999") etc.
    setMostrarAcoesTelefone(false);
  };
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Sheet: controla a tela inteira como um sheet arrastável
  const screenH = Dimensions.get('window').height;
  const SHEET_TOP_GAP = 50; // fresta mínima no topo (altere aqui)
  const SHEET_MIN_Y = SHEET_TOP_GAP; // expandido com gap
  const SHEET_MAX_Y = Math.round(screenH * 0.6); // minimizado (~60% para baixo)
  const MID_Y = (SHEET_MIN_Y + SHEET_MAX_Y) / 2; // ponto médio para snap
  const CLOSE_THRESHOLD_Y = Math.round(screenH * 0.88); // arraste quase total → voltar ao mapa
  const MAX_DRAG_Y = Math.round(screenH * 0.95); // limite visual de arraste
  // Sensibilidade baseada em velocidade/pequeno deslocamento
  const CAPTURE_DY = 3;         // deslocamento mínimo para considerar gesto
  const CAPTURE_VY = 0.18;      // velocidade mínima para capturar gesto
  const MINIMIZE_DY = 16;       // deslocamento para snap em minimizado
  const MINIMIZE_VY = 0.25;     // velocidade para snap em minimizado
  const CLOSE_VY = 1.0;         // velocidade para fechar para o mapa
  const CONTENT_TOP_MARGIN = 4; // margem do conteúdo após a seta (altere aqui)
  const translateY = React.useRef(new Animated.Value(SHEET_MIN_Y)).current; // começa expandido com gap
  const offsetRef = React.useRef(SHEET_MIN_Y);
  const scrollYRef = React.useRef(0);
  const dragYRef = React.useRef(SHEET_MIN_Y);

  const snapTo = (to: number) => {
    Animated.spring(translateY, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 6,
      speed: 14,
    }).start(() => {
      offsetRef.current = to;
    });
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        const { dy, vy } = g;
        // Se já está parcialmente minimizado, capturamos o gesto facilmente
        if (offsetRef.current > 0.5) return true;
        // Quando expandido: captura se puxar para baixo no topo do conteúdo,
        // ou se a velocidade exceder o limiar mesmo com pequeno deslocamento
        const fastEnough = Math.abs(vy) > CAPTURE_VY;
        const movedEnough = Math.abs(dy) > CAPTURE_DY;
        if (scrollYRef.current <= 0.5 && dy > 0 && (movedEnough || fastEnough)) return true;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, g) => {
        const { dy, vy } = g;
        if (offsetRef.current > 0.5) return true;
        const fastEnough = Math.abs(vy) > CAPTURE_VY;
        const movedEnough = Math.abs(dy) > CAPTURE_DY;
        if (scrollYRef.current <= 0.5 && dy > 0 && (movedEnough || fastEnough)) return true;
        return false;
      },
      onPanResponderGrant: () => {
        translateY.stopAnimation();
        dragYRef.current = offsetRef.current;
      },
      onPanResponderMove: (_, g) => {
        let next = offsetRef.current + g.dy;
        if (next < SHEET_MIN_Y) next = SHEET_MIN_Y;
        if (next > MAX_DRAG_Y) next = MAX_DRAG_Y;
        translateY.setValue(next);
        dragYRef.current = next;
      },
      onPanResponderRelease: (_, g) => {
        const finalY = Math.max(SHEET_MIN_Y, Math.min(MAX_DRAG_Y, offsetRef.current + g.dy));
        const willClose = finalY >= CLOSE_THRESHOLD_Y || g.vy > CLOSE_VY;
        if (willClose) {
          // Anima para fora da tela e volta ao mapa
          Animated.timing(translateY, {
            toValue: screenH,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            router.back();
          });
          return;
        }
        const shouldMinimize = g.dy > MINIMIZE_DY || g.vy > MINIMIZE_VY || finalY > MID_Y;
        snapTo(shouldMinimize ? SHEET_MAX_Y : SHEET_MIN_Y);
      },
      onPanResponderTerminate: () => {
        const currentY = dragYRef.current;
        const to = currentY > MID_Y ? SHEET_MAX_Y : SHEET_MIN_Y;
        snapTo(to);
      },
    })
  ).current;

  const Chip = ({
    ativo,
    onPress,
    icon,
    label,
    ringColor,
    bgLight,
    textColor,
    mr = 0,
  }: {
    ativo: boolean;
    onPress: () => void;
    icon: React.ReactNode;
    label: string;
    ringColor: string;
    bgLight: string;
    textColor: string;
    mr?: number;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { marginRight: mr },
        ativo
          ? {
              borderWidth: 2,
              borderColor: ringColor,
              backgroundColor: bgLight,
            }
          : styles.chipOff,
      ]}
      activeOpacity={0.8}
    >
      <View style={styles.rowCenter}>
        {icon}
        <Text
          style={[
            styles.chipText,
            ativo ? { color: textColor } : { color: "#374151" },
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }} />

      {/* Sheet que cobre a tela e pode ser minimizado */}
      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY }] }] } {...panResponder.panHandlers}>
        <SafeAreaView style={styles.screen} edges={["left", "right"]}>
          {/* Handle/Icone de colapso (zona de arraste) */}
          <View style={styles.dragZone}>
            <Feather name="chevron-down" size={18} color="#9CA3AF" />
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 200 }}
            scrollEventThrottle={16}
            onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
          >
        {/* Card Endereço */}
        <View style={[styles.cardOuter, { marginTop: CONTENT_TOP_MARGIN }]}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row" }}>
              <View style={styles.pinCircle}>
                <MapPin size={16} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.addrTitle}>Rua das Flores, 1234</Text>
                <Text style={styles.addrSub}>Vila Madalena - São Paulo, SP</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.mapBtn}
              activeOpacity={0.85}
              // onPress={() => {}}
            >
              <View style={styles.mapDotBox}>
                <View style={styles.mapDot} />
              </View>
              <Text style={styles.mapBtnText}>Mapa</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alerta */}
        <View style={styles.alertRow}>
          <AlertTriangle size={12} color="#B45309" />
          <Text style={styles.alertText}>Solicite o código de entrega</Text>
        </View>

        {/* Card principal */}
        <View style={styles.cardOuter}>
          {/* Header restaurante */}
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.clientName}>Maria Silva</Text>
              <Text style={styles.ifoodTag}>iFood</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>MS</Text>
            </View>
          </View>

          {/* ID e Itens */}
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>ID do Pedido</Text>
              <Text style={styles.infoValue}>#12345678</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Itens</Text>
              <Text style={styles.infoValue}>3 itens</Text>
            </View>
          </View>

          {/* Status */}
          <View style={[styles.row, { marginBottom: 12 }]}>
            {/* Pill de Código */}
            {codigoValidado ? (
              <View style={[styles.pill, styles.pillGreen]}>
                <Check size={12} color="#166534" />
                <Text style={styles.pillTxtGreen}>Validado</Text>
              </View>
            ) : (
              <View style={[styles.pill, styles.pillRed]}>
                <Clock size={12} color="#991B1B" />
                <Text style={styles.pillTxtRed}>Validar</Text>
              </View>
            )}
            
            {/* Pill de Pagamento */}
            {pagamentoConfirmado ? (
              <View style={[styles.pill, styles.pillGreen]}>
                <Check size={12} color="#166534" />
                <Text style={styles.pillTxtGreen}>Pago</Text>
              </View>
            ) : (
              <View style={[styles.pill, styles.pillRed]}>
                <Clock size={12} color="#991B1B" />
                <Text style={styles.pillTxtRed}>Cobrar</Text>
              </View>
            )}
          </View>

          {/* Código de entrega */}
          {!codigoValidado ? (
            <View style={styles.codeRequestCard}>
              <Key size={20} color="#EF4444" />
              <Text style={styles.codeRequestTitle}>Código de entrega</Text>
              <TouchableOpacity 
                style={styles.codeRequestButton}
                onPress={handleSolicitarCodigo}
              >
                <Text style={styles.codeRequestButtonText}>Solicitar</Text>
              </TouchableOpacity>
            </View>
          ) : codigoValidado && !pagamentoConfirmado ? (
            <View style={styles.codeOk}>
              <Settings size={16} color="#16A34A" />
              <Text style={styles.codeOkTxt}>Código confirmado</Text>
            </View>
          ) : null}

          {codigoValidado && pagamentoConfirmado ? (
            /* Card de Entrega Liberada */
            <TouchableOpacity
               onPressIn={startRefundProcess}
               onPressOut={cancelRefundProcess}
               onLongPress={() => {}}
               delayLongPress={2000}
               activeOpacity={1}
             >
               <Animated.View
                 style={[
                   styles.entregaLiberadaCard,
                   {
                     transform: [{ scale: scaleAnim }],
                     shadowColor: glowAnim.interpolate({
                       inputRange: [0, 1],
                       outputRange: ['rgba(34, 197, 94, 0)', 'rgba(34, 197, 94, 0.4)'],
                     }),
                     shadowOffset: {
                       width: 0,
                       height: glowAnim.interpolate({
                         inputRange: [0, 1],
                         outputRange: [2, 8],
                       }),
                     },
                     shadowOpacity: glowAnim.interpolate({
                       inputRange: [0, 1],
                       outputRange: [0.1, 0.6],
                     }),
                     shadowRadius: glowAnim.interpolate({
                       inputRange: [0, 1],
                       outputRange: [3, 15],
                     }),
                     elevation: glowAnim.interpolate({
                       inputRange: [0, 1],
                       outputRange: [2, 10],
                     }),
                     backgroundColor: glowAnim.interpolate({
                       inputRange: [0, 1],
                       outputRange: ['#F0FDF4', '#ECFDF5'],
                     }),
                     borderColor: glowAnim.interpolate({
                       inputRange: [0, 1],
                       outputRange: ['#BBF7D0', '#22C55E'],
                     }),
                   },
                 ]}
               >
              <View style={styles.entregaLiberadaIconContainer}>
                <Check size={24} color="#fff" />
              </View>
              <View style={styles.entregaLiberadaContent}>
                <Text style={styles.entregaLiberadaTitulo}>Entrega Liberada! ✨</Text>
                <Text style={styles.entregaLiberadaSubtitulo}>
                  Código validado e pagamento registrado com sucesso.
                </Text>
                <View style={styles.entregaLiberadaResumo}>
                  <View style={styles.entregaLiberadaResumoIcon}>
                    <CreditCard size={16} color="#6B7280" />
                  </View>
                  <View style={styles.entregaLiberadaResumoTexto}>
                    <Text style={styles.entregaLiberadaResumoValor}>R$ 20,00</Text>
                    <Text style={styles.entregaLiberadaResumoMetodo}>
                      {metodoSelecionado === "dinheiro" ? "Dinheiro" : 
                       metodoSelecionado === "pix" ? "PIX" : 
                       metodoSelecionado === "debito" ? "Débito" : "Crédito"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.entregaLiberadaInstrucao}>
                  {isProcessingRefund ? "Solte para cancelar..." : "Segure para refazer a cobrança"}
                </Text>
                <Text style={styles.entregaLiberadaProximo}>
                  Tudo pronto. Avance para a próxima entrega.
                </Text>
                
                {/* Barra de progresso */}
                 {isProcessingRefund && (
                   <View style={styles.progressContainer}>
                     <Animated.View 
                       style={[
                         styles.progressBar, 
                         { 
                           width: `${refundProgress}%`,
                           backgroundColor: glowAnim.interpolate({
                             inputRange: [0, 1],
                             outputRange: ['#22C55E', '#16A34A'],
                           }),
                         }
                       ]} 
                     />
                   </View>
                 )}
               </View>
               </Animated.View>
             </TouchableOpacity>
          ) : pagamentoConfirmado ? (
            /* Card de Pagamento Confirmado */
            <View style={styles.pagamentoConfirmadoCard}>
              <View style={styles.pagamentoConfirmadoContent}>
                <View style={styles.pagamentoConfirmadoIconContainer}>
                  <CreditCard size={16} color="#fff" />
                </View>
                <View style={styles.pagamentoConfirmadoTexto}>
                  <Text style={styles.pagamentoConfirmadoTitulo}>Pagamento Confirmado</Text>
                  <View style={styles.pagamentoConfirmadoResumo}>
                    <Text style={styles.pagamentoConfirmadoValor}>R$ 20,00</Text>
                    <Text style={styles.pagamentoConfirmadoMetodo}>
                      {metodoSelecionado === "dinheiro" ? "Dinheiro" : 
                                metodoSelecionado === "pix" ? "PIX" : 
                                metodoSelecionado === "debito" ? "Débito" : "Crédito"}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                onPress={handleEditarPagamento}
                style={styles.pagamentoConfirmadoEditBtn}
              >
                <Edit3 size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          ) : (
            /* Seção de Cobrança Original */
            <>
              {/* Valor + título seção */}
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <Text style={styles.totalValue}>R$ 20,00</Text>
                <Text style={styles.totalCaption}>Valor a cobrar</Text>
                <Text style={styles.payMethodTitle}>Método de Pagamento</Text>
              </View>

              {/* Chips (4 colunas, alinhados à largura do botão) */}
              <View style={styles.chipsRow}>
                <Chip
                  ativo={metodoSelecionado === "dinheiro"}
                  onPress={() => setMetodoSelecionado("dinheiro")}
                  icon={<DollarSign size={14} color="#22c55e" />}
                  label="Dinheiro"
                  ringColor="#22c55e"
                  bgLight="#ECFDF5"
                  textColor="#166534"
                  mr={8}
                />

                <Chip
                  ativo={metodoSelecionado === "pix"}
                  onPress={() => setMetodoSelecionado("pix")}
                  icon={<QrCode size={14} color="#06b6d4" />}
                  label="PIX"
                  ringColor="#06b6d4"
                  bgLight="#ECFEFF"
                  textColor="#0E7490"
                  mr={8}
                />

                <Chip
                  ativo={metodoSelecionado === "debito"}
                  onPress={() => setMetodoSelecionado("debito")}
                  icon={<CreditCard size={14} color="#a855f7" />}
                  label="Débito"
                  ringColor="#a855f7"
                  bgLight="#FAF5FF"
                  textColor="#6B21A8"
                  mr={8}
                />

                <Chip
                  ativo={metodoSelecionado === "credito"}
                  onPress={() => setMetodoSelecionado("credito")}
                  icon={<CreditCard size={14} color="#f97316" />}
                  label="Crédito"
                  ringColor="#f97316"
                  bgLight="#FFF7ED"
                  textColor="#9A3412"
                />
              </View>

              {mostrarAvisoMetodo && (
                <Text style={styles.warnSelect}>Selecione um método de pagamento para continuar.</Text>
              )}

              {/* Botão COBRAR */}
              <TouchableOpacity
                onPress={handleCobrar}
                activeOpacity={0.85}
                style={[
                  styles.primaryBtn,
                  !metodoSelecionado && { backgroundColor: "#E5E7EB" },
                ]}
                disabled={!metodoSelecionado}
              >
                <Edit3 size={18} color={metodoSelecionado ? "#fff" : "#6B7280"} />
                <Text
                  style={[
                    styles.primaryBtnTxt,
                    !metodoSelecionado && { color: "#6B7280" },
                  ]}
                >
                  Cobrar R$ 20,00
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Itens do Pedido */}
        <View style={styles.cardOuter}>
          <Text style={styles.sectionTitle}>Itens do Pedido</Text>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <View style={styles.itemIcon}>
                <Utensils size={16} color="#6b7280" />
              </View>
              <View>
                <Text style={styles.itemTitle}>Big Mac</Text>
                <Text style={styles.itemSub}>Quantidade: 1</Text>
              </View>
            </View>
            <Text style={styles.itemPrice}>R$ 18,90</Text>
          </View>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <View style={styles.itemIcon}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#9CA3AF" }} />
              </View>
              <View>
                <Text style={styles.itemTitle}>Batata Frita Média</Text>
                <Text style={styles.itemSub}>Quantidade: 1</Text>
              </View>
            </View>
            <Text style={styles.itemPrice}>R$ 12,90</Text>
          </View>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <View style={styles.itemIcon}>
                <Coffee size={16} color="#6b7280" />
              </View>
              <View>
                <Text style={styles.itemTitle}>Coca-Cola 500ml</Text>
                <Text style={styles.itemSub}>Quantidade: 1</Text>
              </View>
            </View>
            <Text style={styles.itemPrice}>R$ 8,90</Text>
          </View>
        </View>

        {/* Linha do Tempo */}
        <View style={styles.cardOuter}>
          <Text style={styles.sectionTitle}>Linha do Tempo</Text>

          <View style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: "#22C55E" }]}>
              <Check size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>Pedido coletado</Text>
              <Text style={styles.timelineSub}>14:15 - McDonald's Vila Madalena</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: "#22C55E" }]}>
              <Check size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>A caminho do cliente</Text>
              <Text style={styles.timelineSub}>14:25 - Saiu para entrega</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: "#3B82F6" }]}>
              <MapPin size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>No local de entrega</Text>
              <Text style={styles.timelineSub}>14:35 - Aguardando confirmação</Text>
            </View>
          </View>
        </View>

        {/* Informações do Cliente */}
        <View style={styles.cardOuter}>
          <Text style={styles.sectionTitle}>Informações do Cliente</Text>

          {/* Telefone */}
          <View style={{ position: "relative" }}>
            <TouchableOpacity
              onPress={() => setMostrarAcoesTelefone((v) => !v)}
              style={styles.phoneBtn}
              activeOpacity={0.9}
            >
              <View style={styles.itemLeft}>
                <View style={styles.phoneIcon}>
                  <Phone size={16} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.phoneTitle}>(11) 99999-9999</Text>
                  <Text style={styles.phoneSub}>Toque para escolher ação</Text>
                </View>
              </View>
              <ChevronDown
                size={16}
                color="#9CA3AF"
                style={{ transform: [{ rotate: mostrarAcoesTelefone ? "180deg" : "0deg" }] }}
              />
            </TouchableOpacity>

            {mostrarAcoesTelefone && (
              <View style={styles.phoneMenu}>
                <TouchableOpacity onPress={() => handleAcaoTelefone("ligar")} style={styles.menuRow}>
                  <Phone size={16} color="#22C55E" />
                  <Text style={styles.menuTxt}>Ligar</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: "#F3F4F6" }} />
                <TouchableOpacity onPress={() => handleAcaoTelefone("whatsapp")} style={styles.menuRow}>
                  <MessageCircle size={16} color="#22C55E" />
                  <Text style={styles.menuTxt}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Observações */}
          <View style={styles.obsRow}>
            <View style={styles.obsIcon}>
              <FileText size={16} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.obsLabel}>Observações</Text>
              <Text style={styles.obsText}>
                Apartamento 302, interfone não funciona. Favor ligar quando chegar.
              </Text>
            </View>
          </View>

          {/* Ações secundárias */}
          <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 6 }}>
            <TouchableOpacity activeOpacity={0.9} style={[styles.secondaryBtn, { backgroundColor: "#F97316" }]}>
              <AlertTriangle size={18} color="#fff" />
              <Text style={styles.secondaryTxt}>Reportar Problema</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} style={[styles.secondaryBtn, { backgroundColor: "#4B5563" }]}>
              <Ban size={18} color="#fff" />
              <Text style={styles.secondaryTxt}>Cancelar Entrega</Text>
            </TouchableOpacity>
          </View>
        </View>
          </ScrollView>

          {/* Barra fixa inferior */}
          <View
  style={[
    styles.bottomBar,
    {
      paddingBottom: 12 + insets.bottom,  // respiro interno pela safe area
    },
  ]}
>
  {codigoValidado && pagamentoConfirmado ? (
    /* Estado: Entrega Liberada */
    <TouchableOpacity 
      activeOpacity={0.8} 
      style={[styles.primaryBtn, { backgroundColor: "#22C55E" }]}
      onPress={() => {
        // TODO: Navegar para próxima entrega
        console.log('Navegando para próxima entrega');
      }}
    >
      <View style={[styles.squareIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
        <View style={[styles.squareDot, { backgroundColor: "#fff" }]} />
      </View>
      <Text style={[styles.primaryBtnTxt, { color: "#fff" }]}>Próxima Entrega</Text>
    </TouchableOpacity>
  ) : (
    /* Estado: Aguardando */
    <>
      <View style={{ alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#F97316" }}>
          {!codigoValidado ? "Aguardando código" : "Aguardando pagamento"}
        </Text>
        <Text style={{ fontSize: 12, color: "#4B5563" }}>
          {!codigoValidado ? "Solicite o código para continuar" : "Complete o pagamento para continuar"}
        </Text>
      </View>

      <TouchableOpacity activeOpacity={1} style={[styles.primaryBtn, { backgroundColor: "#9CA3AF" }]}>
        <View style={styles.squareIcon}>
          <View style={styles.squareDot} />
        </View>
        <Text style={styles.primaryBtnTxt}>Próxima Entrega</Text>
      </TouchableOpacity>
    </>
  )}
        </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FAFB" },

  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },

  dragZone: {
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 2,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
    marginBottom: 4,
  },

  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },

  cardOuter: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center" },
  rowCenter: { flexDirection: "row", alignItems: "center", justifyContent: "center" },

  pinCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 12 },
  addrTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  addrSub: { fontSize: 14, color: "#4B5563", marginTop: 2 },

  mapBtn: { backgroundColor: "#3B82F6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: "row", alignItems: "center" },
  mapDotBox: { width: 16, height: 16, backgroundColor: "#fff", borderRadius: 4, alignItems: "center", justifyContent: "center", marginRight: 6 },
  mapDot: { width: 8, height: 8, backgroundColor: "#3B82F6", borderRadius: 2 },
  mapBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  alertRow: {
    marginHorizontal: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  alertText: { marginLeft: 6, color: "#92400E", fontSize: 13, fontWeight: "600" },

  clientName: { fontSize: 18, fontWeight: "700", color: "#111827", marginRight: 8 },
  ifoodTag: { backgroundColor: "#EF4444", color: "#fff", fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: "700" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontWeight: "800", color: "#374151" },

  infoBox: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "#E5E7EB" },
  infoLabel: { fontSize: 10, color: "#9CA3AF", textTransform: "uppercase" },
  infoValue: { fontSize: 12, fontWeight: "700", color: "#1F2937", marginTop: 2 },

  pill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginRight: 8 },
  pillGreen: { backgroundColor: "#DCFCE7" },
  pillRed: { backgroundColor: "#FEE2E2" },
  pillTxtGreen: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#166534" },
  pillTxtRed: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#991B1B" },

  codeOk: { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0", borderWidth: 1, padding: 10, borderRadius: 8, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  codeOkTxt: { marginLeft: 8, color: "#15803D", fontSize: 14, fontWeight: "600" },

  codeRequestCard: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codeRequestTitle: {
    flex: 1,
    marginLeft: 12,
    color: "#1F2937",
    fontSize: 16,
    fontWeight: "600",
  },
  codeRequestButton: {
    backgroundColor: "#F97316",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  codeRequestButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  totalValue: { fontSize: 22, fontWeight: "800", color: "#EF4444", marginBottom: 2 },
  totalCaption: { fontSize: 13, color: "#4B5563", marginBottom: 8 },
  payMethodTitle: { fontSize: 14, color: "#111827", fontWeight: "700" },

  chipsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  chip: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fff", alignItems: "center" },
  chipOff: { backgroundColor: "#fff", borderColor: "#E5E7EB", borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: "600", marginLeft: 6 },

  warnSelect: { marginTop: 6, marginBottom: 8, fontSize: 12, color: "#DC2626" },

  primaryBtn: { marginTop: 6, backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  primaryBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800", marginLeft: 8 },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },

  itemRow: { backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center", marginRight: 12 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  itemSub: { fontSize: 12, color: "#4B5563" },
  itemPrice: { fontSize: 14, fontWeight: "700", color: "#111827" },

  timelineRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  timelineTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  timelineSub: { fontSize: 12, color: "#2563EB" },

  phoneBtn: { width: "100%", zIndex:100, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: "#F9FAFB", borderRadius: 10 },

  // Estilos do Card de Pagamento Confirmado
  pagamentoConfirmadoCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pagamentoConfirmadoContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  pagamentoConfirmadoIconContainer: {
    backgroundColor: "#22C55E",
    borderRadius: 20,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  pagamentoConfirmadoTexto: {
    flex: 1,
  },
  pagamentoConfirmadoTitulo: {
    color: "#15803D",
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 2,
  },
  pagamentoConfirmadoResumo: {
    alignItems: "center",
  },
  pagamentoConfirmadoValor: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
  pagamentoConfirmadoMetodo: {
    color: "#6B7280",
    fontSize: 12,
  },
  pagamentoConfirmadoEditBtn: {
    padding: 4,
  },

  // Estilos do Card de Entrega Liberada
  entregaLiberadaCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  entregaLiberadaIconContainer: {
    backgroundColor: "#22C55E",
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  entregaLiberadaContent: {
    alignItems: "center",
    width: "100%",
  },
  entregaLiberadaTitulo: {
    color: "#15803D",
    fontWeight: "700",
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  entregaLiberadaSubtitulo: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  entregaLiberadaResumo: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
    maxWidth: 200,
  },
  entregaLiberadaResumoIcon: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  entregaLiberadaResumoTexto: {
    flex: 1,
    alignItems: "center",
  },
  entregaLiberadaResumoValor: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 16,
  },
  entregaLiberadaResumoMetodo: {
    color: "#6B7280",
    fontSize: 12,
  },
  entregaLiberadaInstrucao: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  entregaLiberadaProximo: {
    color: "#059669",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  progressContainer: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#22C55E",
    borderRadius: 2,
  },
  phoneIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 12 },
  phoneTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  phoneSub: { fontSize: 12, color: "#4B5563" },

  phoneMenu: {zIndex:100, position: "absolute", top: 48, left: 0, right: 0, backgroundColor: "#fff", borderColor: "#E5E7EB", borderWidth: 1, borderRadius: 10, overflow: "hidden", elevation: 3 },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  menuTxt: { marginLeft: 8, fontSize: 14, color: "#111827" },

  obsRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginTop: 12 },
  obsIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFEDD5", alignItems: "center", justifyContent: "center", marginRight: 12 },
  obsLabel: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  obsText: { fontSize: 14, color: "#111827" },

  secondaryBtn: { width: "100%", height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  secondaryTxt: { color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 8 },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,              // <- mantém colado no fundo
    alignSelf: "center",
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  

  squareIcon: { width: 16, height: 16, backgroundColor: "#9CA3AF", borderRadius: 4, alignItems: "center", justifyContent: "center", marginRight: 8 },
  squareDot: { width: 8, height: 8, backgroundColor: "#fff", borderRadius: 2 },
});
