import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Animated as RNAnimated } from 'react-native';
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, useBottomSheet, BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import {
  MapPin,
  AlertTriangle,
  Check,
  Clock,
  Settings,
  Edit3,
  DollarSign,
  QrCode,
  CreditCard,
  Key,
  Phone,
  ChevronDown,
  FileText,
  Ban,
  Coffee,
  Utensils,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react-native';
import Feather from '@expo/vector-icons/Feather';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secureStorage';

// Componente de background transparente customizado
const TransparentBackground: React.FC<BottomSheetBackgroundProps> = ({ style }) => {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          backgroundColor: 'transparent',
        },
      ]}
    />
  );
};

// Tela de demonstração do comportamento de Sacola (iFood-like)
// Requisitos atendidos:
// - @gorhom/bottom-sheet v4+ (usando v5.x) com nested scrolling via BottomSheetScrollView
// - enableContentPanningGesture para permitir arrastar em qualquer área do conteúdo
// - enablePanDownToClose desabilitado para evitar fechamentos acidentais
// - Snap points responsivos: ['100%', '70%', '35%']
// - Backdrop animado com animatedIndex (appearsOnIndex={1}, disappearsOnIndex={0})
// - Animação sutil no cabeçalho: altura/sombra variando conforme o índice
// - TestIDs adicionados
// - keyboardBehavior="interactive" no iOS para testar input no topo

export default function ExemploSacolaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const sheetRef = useRef<React.ElementRef<typeof BottomSheet>>(null);
  const snapPoints = useMemo(() => ['100%', '70%', '35%'], []);

  // Extrai dados do pedido dos params
  const nomeCliente = params.nome || 'Cliente';
  const bairro = params.bairro || 'Bairro';
  const endereco = params.endereco || 'Endereço';
  const id_ifood = parseInt(params.id_ifood as string, 10) || 0;
  const id_estabelecimento = parseInt(params.id_estabelecimento as string, 10) || 0;
  const pedidoId = (id_ifood && id_ifood > 0) ? id_ifood : id_estabelecimento;
  const statusPagamento = params.statusPagamento || 'a_receber';
  const valorTotal = parseFloat(params.valorTotal as string) || 0;
  const telefone = params.telefone || '';
  const pagamento = params.pagamento || '';
  const horario = params.horario || '';
  const troco = params.troco || '';
  const itens = params.itens ? JSON.parse(params.itens as string) : [];
  
  // Determina se é iFood ou estabelecimento baseado no id_ifood
  const isIfood = id_ifood > 0;
  const origem = isIfood ? 'ifood' : 'estabelecimento';
  
  // Determina se precisa cobrar baseado no status de pagamento
  // pagoApp sempre deve ser tratado como pago
  const tipoPagamento = params.tipoPagamento || '';
  const precisaCobrar = statusPagamento === 'a_receber' && tipoPagamento !== 'pagoApp';
  const jaFoiPago = statusPagamento === 'pago' || tipoPagamento === 'pagoApp';
  
  // Cria o objeto pedidoAtual com dados mock completos
  const pedidoAtual = {
    id: pedidoId,
    id_ifood: id_ifood,
    id_estabelecimento: id_estabelecimento,
    cliente: {
      nome: nomeCliente,
      telefone: telefone,
      endereco: endereco,
      bairro: bairro
    },
    itens: [
      {
        id: 1,
        nome: "Big Mac",
        quantidade: 2,
        valor: 15.90,
        tipo: "lanche",
        observacoes: "Sem cebola"
      },
      {
        id: 2,
        nome: "Batata Frita Grande",
        quantidade: 1,
        valor: 8.50,
        tipo: "acompanhamento",
        observacoes: ""
      },
      {
        id: 3,
        nome: "Coca-Cola 500ml",
        quantidade: 2,
        valor: 5.00,
        tipo: "bebida",
        observacoes: "Gelada"
      }
    ],
    timeline: [
      {
        id: 1,
        evento: "Pedido confirmado",
        horario: "14:30",
        local: "Zippy Food",
        status: "concluido"
      },
      {
        id: 2,
        evento: "Preparando pedido",
        horario: "14:35",
        local: "Zippy Food",
        status: "concluido"
      },
      {
        id: 3,
        evento: "Saiu para entrega",
        horario: "14:45",
        local: "Zippy Food",
        status: "concluido"
      },
      {
        id: 4,
        evento: "A caminho",
        horario: "14:50",
        local: "Em trânsito",
        status: "em_andamento"
      },
      {
        id: 5,
        evento: "Entregue",
        horario: "15:10",
        local: endereco,
        status: "pendente"
      }
    ],
    pagamento: {
      metodo: pagamento || 'dinheiro',
      status: statusPagamento,
      valor: valorTotal,
      troco: troco
    },
    origem: origem,
    horario: horario,
    observacoes: "Apartamento 45, interfone 4501"
  };
  
  // Estados para controle de última entrega
  const [isUltimaEntrega, setIsUltimaEntrega] = useState(false);

  // Estados necessários
  const [metodoSelecionado, setMetodoSelecionado] = useState<null | "dinheiro" | "pix" | "debito" | "credito">(null);
  const [mostrarAvisoMetodo, setMostrarAvisoMetodo] = useState(false);
  const [mostrarAcoesTelefone, setMostrarAcoesTelefone] = useState(false);
  const [codigoSolicitado, setCodigoSolicitado] = useState(false);
  const [codigoValidado, setCodigoValidado] = useState(!isIfood); // Se não é iFood, código já está validado
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(jaFoiPago); // Se já foi pago, pagamento confirmado
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [refundProgress, setRefundProgress] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  // useEffect para inicialização
  useEffect(() => {
    (async () => {
      const lista = await getSecureItem('pedidosCompletos');
      const indiceAtualStr = await getSecureItem('indiceAtual');
      if (lista && indiceAtualStr) {
        const pedidos = JSON.parse(lista);
        const indiceAtual = parseInt(indiceAtualStr, 10);
        setIsUltimaEntrega(indiceAtual >= pedidos.length - 1);
      } else {
        setIsUltimaEntrega(false);
      }

      // Se é iFood, verifica se código já foi confirmado
      if (isIfood) {
        const status = await getSecureItem(`codigoConfirmado_${pedidoId}`);
        if (status === 'true') {
          setCodigoValidado(true);
        }
      }
    })();
  }, [pedidoId, isIfood]);

  // Funções necessárias
  const handleSolicitarCodigo = () => {
    setCodigoSolicitado(true);
    console.log('Código solicitado');
    // Navegar para VerificationScreen
    router.push({
      pathname: '/VerificationScreen',
      params: { id_ifood: String(id_ifood) }
    });
  };

  // Detectar retorno da VerificationScreen com código confirmado
  useFocusEffect(
    useCallback(() => {
      const verificarCodigoValidado = async () => {
        try {
          if (isIfood) {
            const codigoValidado = await getSecureItem('codigoValidado');
            if (codigoValidado === 'true') {
              await setSecureItem(`codigoConfirmado_${pedidoId}`, 'true');
              setCodigoValidado(true);
              setCodigoSolicitado(false);
              await deleteSecureItem('codigoValidado');
              console.log('Código confirmado retornado da VerificationScreen para pedido:', pedidoId);
            }
          }
        } catch (error) {
          console.error('Erro ao verificar código validado:', error);
        }
      };
      
      verificarCodigoValidado();
    }, [isIfood, pedidoId])
  );

  const handleCobrar = () => {
    if (!metodoSelecionado) {
      setMostrarAvisoMetodo(true);
      return;
    }
    setPagamentoConfirmado(true);
    setMostrarAvisoMetodo(false);
    console.log('Pagamento confirmado:', metodoSelecionado);
  };

  // Função para avançar para a próxima entrega
  const handleProximaEntrega = async () => {
    const podeLiberar = codigoValidado && (pagamentoConfirmado || jaFoiPago);
    
    if (!podeLiberar) {
      if (isIfood && !codigoValidado) {
        alert('Você precisa validar o código do iFood primeiro!');
        return;
      }
      if (precisaCobrar && !pagamentoConfirmado) {
        alert('Você precisa confirmar o pagamento primeiro!');
        return;
      }
      return;
    }

    const lista = await getSecureItem('pedidosCompletos');
    const indiceAtualStr = await getSecureItem('indiceAtual');
    if (lista && indiceAtualStr) {
      const pedidos = JSON.parse(lista);
      let indiceAtual = parseInt(indiceAtualStr, 10);
      await deleteSecureItem(`codigoConfirmado_${pedidoId}`);
      
      if (indiceAtual < pedidos.length - 1) {
        // Avança para próxima entrega
        indiceAtual += 1;
        await setSecureItem('indiceAtual', indiceAtual.toString());
        router.replace('/');
      } else {
        // Finaliza rota
        await handleFinalizarRota();
      }
    }
  };

  const handleFinalizarRota = async () => {
    await deleteSecureItem('emEntrega');
    await deleteSecureItem('indiceAtual');
    await deleteSecureItem('pedidosCompletos');
    await deleteSecureItem('destinos');
    await deleteSecureItem(`codigoConfirmado_${pedidoId}`);
    router.replace('/');
  };
  const handleAcaoTelefone = (acao: "ligar" | "whatsapp") => {
    // Em RN puro, usar Linking; mantendo stub por enquanto
    // Linking.openURL("tel:+5511999999999") etc.
    setMostrarAcoesTelefone(false);
  };
  const handleReverterPagamento = () => {
    setPagamentoConfirmado(false);
    console.log('Pagamento revertido');
  };

  const handleEditarPagamento = () => {
    setPagamentoConfirmado(false);
    console.log('Editando pagamento');
  };

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
  }) => {
    const [isPressed, setIsPressed] = useState(false);

    const handlePress = () => {
      console.log(`[Chip ${label}] Clique processado`);
      onPress();
    };
    
    return (
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
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
          isPressed && {
            transform: [{ scale: 0.96 }],
            opacity: 0.85,
          },
        ]}
        activeOpacity={0.5}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={{ top: 20, bottom: 20, left: 16, right: 16 }}
        pressRetentionOffset={{ top: 20, bottom: 20, left: 16, right: 16 }}
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
  };

  // Constante para margem do conteúdo
  const CONTENT_TOP_MARGIN = 8;

  // Removendo o backdrop para que o mapa fique visível por trás
// Remove duplicate declaration since renderBackdrop is already defined below
  const renderBackdrop = useCallback(() => null, []);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enableContentPanningGesture={true}
        enablePanDownToClose={false}
        keyboardBehavior={Platform.OS === 'ios' ? 'interactive' : 'extend'}
        bottomInset={0}
        backdropComponent={renderBackdrop}
        backgroundComponent={TransparentBackground}
        handleComponent={() => null}
        style={styles.sheet}
        detached={false}
        animateOnMount={true}
      >
        <SacolaHeader onClose={() => router.back()} />

        <BottomSheetScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator
          testID="sacola-scroll"
        >
          {/* <ScrollView 
            contentContainerStyle={{ paddingBottom: 220 }}
            scrollEventThrottle={16}
            bounces={false}
            onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
          > */}
          <View style={[styles.cardOuter, { marginTop: CONTENT_TOP_MARGIN }]}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: "row" }}>
                <View style={styles.pinCircle}>
                  <MapPin size={16} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.addrTitle}>{endereco}</Text>
                  <Text style={styles.addrSub}>{bairro}</Text>
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
                <Text style={styles.clientName}>{nomeCliente}</Text>
                <Text style={styles.ifoodTag}>{isIfood ? 'iFood' : 'Estabelecimento'}</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>
                  {typeof nomeCliente === 'string' 
                    ? nomeCliente.split(' ').map(n => n[0]).join('').toUpperCase()
                    : nomeCliente[0]?.[0]?.toUpperCase() || ''}
                </Text>
              </View>
            </View>

            {/* ID e Itens */}
            <View style={[styles.rowBetween, { marginBottom: 12 }]}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>ID do Pedido</Text>
                <Text style={styles.infoValue}>#{pedidoId}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Itens</Text>
                <Text style={styles.infoValue}>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</Text>
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
              <TouchableOpacity onPress={jaFoiPago ? undefined : handleReverterPagamento} activeOpacity={jaFoiPago ? 1 : 0.9}>
                <RNAnimated.View
                  style={[
                    styles.entregaLiberadaCard,
                    {
                      transform: [{ scale: scaleAnim }],
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
                    {jaFoiPago ? 'Código validado e pagamento no app já confirmado.' : 'Código validado e pagamento registrado com sucesso.'}
                  </Text>
                  <View style={styles.entregaLiberadaResumo}>
                    <View style={styles.entregaLiberadaResumoIcon}>
                      <CreditCard size={16} color="#6B7280" />
                    </View>
                    <View style={styles.entregaLiberadaResumoTexto}>
                      <Text style={styles.entregaLiberadaResumoValor}>R$ {valorTotal.toFixed(2).replace('.', ',')}</Text>
                      <Text style={styles.entregaLiberadaResumoMetodo}>
                        {jaFoiPago
                          ? 'Pago no app'
                          : metodoSelecionado === 'dinheiro' ? 'Dinheiro'
                          : metodoSelecionado === 'pix' ? 'PIX'
                          : metodoSelecionado === 'debito' ? 'Débito'
                          : 'Crédito'}
                      </Text>
                    </View>
                  </View>
                </View>
                {!jaFoiPago && (
                  <Text style={styles.entregaLiberadaInstrucao}>Toque para desfazer a cobrança</Text>
                )}
                <Text style={styles.entregaLiberadaProximo}>
                  Tudo pronto. Avance para a próxima entrega.
                </Text>
                
                {/* Barra de progresso */}
                 {isProcessingRefund && (
                   <View style={styles.progressContainer}>
                     <RNAnimated.View 
                                           style={[
                     styles.progressBar, 
{
  transform: [{ scaleX: progressAnim }],
  backgroundColor: glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgb(34, 197, 94)', 'rgb(22, 163, 74)']
  })
}
                                           ]} 
                     />
                   </View>
                 )}
                {/* Removido progresso por hold; ação agora é toque único */}
                </RNAnimated.View>
              </TouchableOpacity>
          ) : pagamentoConfirmado ? (
            /* Card de Pagamento Confirmado */
            <View style={styles.pagamentoConfirmadoCard}>
              <View style={styles.pagamentoConfirmadoContent}>
                <View style={styles.pagamentoConfirmadoIconContainer}>
                  <CreditCard size={16} color="#fff" />
                </View>
                <View style={styles.pagamentoConfirmadoTexto}>
                  <Text style={styles.pagamentoConfirmadoTitulo}>{jaFoiPago ? 'Pago no app' : 'Pagamento Confirmado'}</Text>
                  <View style={styles.pagamentoConfirmadoResumo}>
                    <Text style={styles.pagamentoConfirmadoValor}>R$ {valorTotal.toFixed(2).replace('.', ',')}</Text>
                    {jaFoiPago ? (
                      <Text style={styles.pagamentoConfirmadoMetodo}>Este pedido já foi pago anteriormente.</Text>
                    ) : (
                      <Text style={styles.pagamentoConfirmadoMetodo}>
                        {metodoSelecionado === 'dinheiro' ? 'Dinheiro' :
                         metodoSelecionado === 'pix' ? 'PIX' :
                         metodoSelecionado === 'debito' ? 'Débito' : 'Crédito'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              {!jaFoiPago && (
                <TouchableOpacity 
                  onPress={handleEditarPagamento}
                  style={styles.pagamentoConfirmadoEditBtn}
                >
                  <Edit3 size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
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
                />

                <Chip
                  ativo={metodoSelecionado === "pix"}
                  onPress={() => setMetodoSelecionado("pix")}
                  icon={<QrCode size={14} color="#06b6d4" />}
                  label="PIX"
                  ringColor="#06b6d4"
                  bgLight="#ECFEFF"
                  textColor="#0E7490"
                />

                <Chip
                  ativo={metodoSelecionado === "debito"}
                  onPress={() => setMetodoSelecionado("debito")}
                  icon={<CreditCard size={14} color="#a855f7" />}
                  label="Débito"
                  ringColor="#a855f7"
                  bgLight="#FAF5FF"
                  textColor="#6B21A8"
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

          {pedidoAtual?.itens?.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <View style={styles.itemIcon}>
                  {item.tipo === 'bebida' ? (
                    <Coffee size={16} color="#6b7280" />
                  ) : item.tipo === 'acompanhamento' ? (
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#9CA3AF" }} />
                  ) : (
                    <Utensils size={16} color="#6b7280" />
                  )}
                </View>
                <View>
                  <Text style={styles.itemTitle}>{item.nome}</Text>
                  <Text style={styles.itemSub}>Quantidade: {item.quantidade}</Text>
                </View>
              </View>
              <Text style={styles.itemPrice}>R$ {(item.quantidade * item.valor).toFixed(2).replace('.', ',')}</Text>
            </View>
          )) || (
            <Text style={styles.itemSub}>Nenhum item encontrado</Text>
          )}
        </View>

        {/* Linha do Tempo */}
        <View style={styles.cardOuter}>
          <Text style={styles.sectionTitle}>Linha do Tempo</Text>

          {pedidoAtual?.timeline?.map((evento, index) => {
            const isCompleted = evento.status === 'concluido';
            const isCurrent = evento.status === 'atual';
            
            return (
              <View key={index} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { 
                  backgroundColor: isCompleted ? "#22C55E" : isCurrent ? "#3B82F6" : "#E5E7EB" 
                }]}>
                  {isCompleted ? (
                    <Check size={14} color="#fff" />
                  ) : isCurrent ? (
                    <MapPin size={14} color="#fff" />
                  ) : (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#9CA3AF" }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>{evento.evento}</Text>
                  <Text style={styles.timelineSub}>{evento.horario} - {evento.local}</Text>
                </View>
              </View>
            );
          }) || (
            <Text style={styles.itemSub}>Timeline não disponível</Text>
          )}
        </View>

        {/* Informações do Cliente */}
        <View style={[styles.cardOuter, {marginBottom: !codigoValidado ? 70 : 75}]}>
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
        </BottomSheetScrollView>
                  {/* Barra fixa inferior */}
          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: 12 + insets.bottom,
              },
            ]}
          >
            {codigoValidado && pagamentoConfirmado ? (
              /* Estado: Entrega Liberada */
              <TouchableOpacity 
                activeOpacity={0.8} 
                style={[styles.primaryBtn, { backgroundColor: "#22C55E" }]}
                onPress={handleProximaEntrega}
              >
                <View style={[styles.squareIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}> 
                  <View style={[styles.squareDot, { backgroundColor: "#fff" }]} />
                </View>
                <Text style={[styles.primaryBtnTxt, { color: "#fff" }]}>{isUltimaEntrega ? 'Finalizar rota' : 'Próxima Entrega'}</Text>
              </TouchableOpacity>
            ) : (
              /* Estado: Aguardando */
              <>
                <View style={{ alignItems: "center", marginBottom: 6}}>
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
                  <Text style={styles.primaryBtnTxt}>{isUltimaEntrega ? 'Finalizar rota' : 'Próxima Entrega'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
      </BottomSheet>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    width: '100%',
    margin: 0,
    padding: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  sheet: {
    zIndex: 1000,
    elevation: 1000,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  subtotalPill: {
    marginLeft: 10,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  subtotalText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  closeBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',

  },
  scrollContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  couponInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    color: '#111827',
  },
  applyBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  line: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 10,
  },
  itemName: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  itemQty: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
    marginLeft: 8,
  },
  longText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  hintOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
  },
  hintText: {
    backgroundColor: 'rgba(17,24,39,0.7)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 12,
  },
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
    height: 40,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
  },

  // header: {
  //   backgroundColor: "#fff",
  //   paddingHorizontal: 16,
  //   paddingVertical: 12,
  //   flexDirection: "row",
  //   alignItems: "center",
  //   justifyContent: "space-between",
  // },
  // headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },

  cardOuter: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
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
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
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

  chipsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4, gap: 8 },
  chip: { 
    flex: 1, 
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    borderRadius: 10, 
    backgroundColor: "#fff", 
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    elevation: 2,
  },
  chipOff: { backgroundColor: "#fff", borderColor: "#E5E7EB", borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: "600", marginLeft: 6 },

  warnSelect: { marginTop: 6, marginBottom: 8, fontSize: 12, color: "#DC2626" },

  primaryBtn: { marginTop: 6, backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  primaryBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800", marginLeft: 8 },

  // sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },

   itemRow: { backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
   itemLeft: { flexDirection: "row", alignItems: "center" },
   itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center", marginRight: 12 },
   itemTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
   itemSub: { fontSize: 12, color: "#4B5563" },
  // itemPrice: { fontSize: 14, fontWeight: "700", color: "#111827" },

  timelineRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  timelineTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  timelineSub: { fontSize: 12, color: "#2563EB" },

  phoneBtn: { width: "100%", zIndex:100, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: "#F9FAFB", borderRadius: 10 },
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
  // rowCenter: { 
  //   flexDirection: "row", 
  //   alignItems: "center", 
  //   justifyContent: "center" 
  // },
  squareIcon: { 
    width: 16, 
    height: 16, 
    backgroundColor: "#9CA3AF", 
    borderRadius: 4, 
    alignItems: "center", 
    justifyContent: "center", 
    marginRight: 8 
  },
  squareDot: { 
    width: 8, 
    height: 8, 
    backgroundColor: "#fff", 
    borderRadius: 2 
  },
  phoneIcon: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: "#DBEAFE", 
    alignItems: "center", 
    justifyContent: "center", 
    marginRight: 12 
  },
  phoneTitle: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#111827" 
  },
  phoneSub: { 
    fontSize: 12, 
    color: "#4B5563" 
  },
  phoneMenu: {
    zIndex: 100, 
    position: "absolute", 
    top: 48, 
    left: 0, 
    right: 0, 
    backgroundColor: "#fff", 
    borderColor: "#E5E7EB", 
    borderWidth: 1, 
    borderRadius: 10, 
    overflow: "hidden", 
    elevation: 3 
  },
  menuRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 12, 
    gap: 8 
  },
  menuTxt: { 
    marginLeft: 8, 
    fontSize: 14, 
    color: "#111827" 
  },
  obsRow: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    gap: 12, 
    backgroundColor: "#F9FAFB", 
    borderRadius: 10, 
    padding: 12, 
    marginTop: 12 
  },
  obsIcon: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: "#FFEDD5", 
    alignItems: "center", 
    justifyContent: "center", 
    marginRight: 12 
  },
  obsLabel: { 
    fontSize: 12, 
    color: "#6B7280", 
    marginBottom: 4 
  },
  obsText: { 
    fontSize: 14, 
    color: "#111827" 
  },
  secondaryBtn: { 
    width: "100%", 
    height: 48, 
    borderRadius: 12, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 8, 
  },
  secondaryTxt: { color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 8 },
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
    width: "100%",
    backgroundColor: "#22C55E",
    borderRadius: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 70,
    left: 0,
    right: 0,
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 99999,
    elevation: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    minHeight: 80,
  },
});


function SacolaHeader({ onClose }: { onClose: () => void }) {
  const { animatedIndex } = useBottomSheet();
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const idx = animatedIndex.value ?? 0;
    return {
      height: interpolate(idx, [0, 2], [72, 56], Extrapolation.CLAMP),
      shadowOpacity: interpolate(idx, [0, 2], [0.18, 0.06], Extrapolation.CLAMP),
      elevation: interpolate(idx, [0, 2], [6, 1], Extrapolation.CLAMP),
    };
  });
  return (
    <Animated.View style={[styles.header, headerAnimatedStyle]}>
      <View style={styles.grabber} />
      <View style={styles.headerRow}>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Fechar sacola"
          testID="btn-fechar-sacola"
          onPress={onClose}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
