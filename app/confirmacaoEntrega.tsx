import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  Image,
  PanResponder,            // ⬅️ ADICIONE
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { Animated } from 'react-native';

type MetodoPagamento = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito' | 'Outros';

type CodigoStatus = 'pendente' | 'validando' | 'validado' | 'invalido';
type PagamentoStatus = 'nao_iniciado' | 'em_andamento' | 'confirmado';

interface PagamentoResumo {
  tipo: 'simples' | 'dividido';
  metodo?: MetodoPagamento;
  valor?: number;
  trocoPara?: number;
  observacao?: string; // mantido opcionalmente no tipo, mas UI removida
  total?: number;
  partes?: Array<{
    metodo: MetodoPagamento;
    valor: number;
    confirmado?: boolean;
    trocoPara?: number;
    observacao?: string;
  }>;
}

export default function ConfirmacaoEntrega() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [modalVisible, setModalVisible] = useState(false);

  // Extrai dados do pedido dos params
  const nomeCliente = params.nome || 'Cliente';
  const bairro = params.bairro || 'Bairro';
  const endereco = params.endereco || 'Endereço';
  const id_ifood = parseInt(params.id_ifood as string, 10) || 0;
  const id_estabelecimento = parseInt(params.id_estabelecimento as string, 10) || 0;
  // id do pedido (um ou outro terá valor)
  const pedidoId = (id_ifood && id_ifood > 0) ? id_ifood : id_estabelecimento;

  const statusPagamento = params.statusPagamento || 'a_receber';
  const valorTotal = parseFloat(params.valorTotal as string) || 0;
  const telefone = params.telefone || '';
  const valor = params.valor || '';
  const itens = params.itens || [];
  const previsaoEntrega = params.previsaoEntrega || '';

  // Determina se é iFood ou estabelecimento baseado no id_ifood
  const isIfood = id_ifood > 0;
  const origem = isIfood ? 'ifood' : 'estabelecimento';

  // Determina se precisa cobrar baseado no status de pagamento
  const precisaCobrar = statusPagamento === 'a_receber';
  const jaFoiPago = statusPagamento === 'pago';

  // Estados
  const [codigoStatus, setCodigoStatus] = useState<CodigoStatus>(!isIfood ? 'validado' : 'pendente');
  const [codigoValor, setCodigoValor] = useState('');
  const [pagamentoStatus, setPagamentoStatus] = useState<PagamentoStatus>(
    statusPagamento === 'pago' ? 'confirmado' : 'nao_iniciado'
  );
    const [pagamentoResumo, setPagamentoResumo] = useState<PagamentoResumo | null>(null);
  const [modalCodigo, setModalCodigo] = useState(false);
  const [isUltimaEntrega, setIsUltimaEntrega] = useState(false);
  const quantidadePedidos = parseInt(params.quantidadePedidos as string, 10) || 1;
  const [expandido, setExpandido] = useState(false);

  // controla quando o botão "Próxima entrega" deve APARECER (visibilidade)
  // ele só habilita quando podeLiberar === true
  const [mostrarBotaoProximaEntrega, setMostrarBotaoProximaEntrega] = useState(false);

  // Estados do pagamento simples
  const [pagamentoExpandido, setPagamentoExpandido] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('Dinheiro');


  // Animações (reservado)
  const pagamentoAnimacao = useRef(new Animated.Value(0)).current;

  // Determina se pode liberar para próxima entrega
  const podeLiberar = codigoStatus === 'validado' && pagamentoStatus === 'confirmado';
  // Garante que o botão apareça quando tudo estiver liberado
  useEffect(() => {
    if (podeLiberar) {
      setMostrarBotaoProximaEntrega(true);
    }
  }, [podeLiberar]);


  // --- Swipe-to-Confirm (refs/estado) ---
  const THUMB_SIZE = 44;               // diâmetro do “pino”
  const COMPLETE_PCT = 0.8;            // % do curso para concluir (80%)

  const [sliderWidth, setSliderWidth] = useState(0);
  const sliderX = useRef(new Animated.Value(0)).current;   // posição X do pino
  const sliderXValRef = useRef(0);                         // valor “vivo” do X
  const sliderStartRef = useRef(0);                        // X no início do gesto

  useEffect(() => {
    const id = sliderX.addListener(({ value }) => (sliderXValRef.current = value));
    return () => sliderX.removeListener(id);
  }, [sliderX]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        sliderStartRef.current = sliderXValRef.current;
      },
      onPanResponderMove: (_evt, g) => {
        const max = Math.max(0, sliderWidth - THUMB_SIZE);
        const next = Math.min(Math.max(sliderStartRef.current + g.dx, 0), max);
        sliderX.setValue(next);
      },
      onPanResponderRelease: () => {
        const max = Math.max(0, sliderWidth - THUMB_SIZE);
        const done = sliderXValRef.current >= max * COMPLETE_PCT;
        if (done) {
          Animated.timing(sliderX, { toValue: max, duration: 120, useNativeDriver: false }).start(
            () => handleConfirmarPagamentoSimples()
          );
        } else {
          Animated.spring(sliderX, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;


  useEffect(() => {
    (async () => {
      const lista = await SecureStore.getItemAsync('pedidosCompletos');
      const indiceAtualStr = await SecureStore.getItemAsync('indiceAtual');
      if (lista && indiceAtualStr) {
        const pedidos = JSON.parse(lista);
        const indiceAtual = parseInt(indiceAtualStr, 10);
        setIsUltimaEntrega(indiceAtual >= pedidos.length - 1);
      } else {
        setIsUltimaEntrega(false);
      }

      // Se não for iFood, código já está confirmado
      if (!isIfood) {
        setCodigoStatus('validado');
      } else {
        // Checa status de código confirmado individual por pedido
        const status = await SecureStore.getItemAsync(`codigoConfirmado_${id_ifood}`);
        console.log('Status código confirmado', id_ifood, status);
        if (status === 'true') {
          setCodigoStatus('validado');
        }
      }

      // Define estado inicial de pagamento **sempre a partir dos params**
      if (statusPagamento === 'pago') {
        setPagamentoStatus('confirmado');
      } else {
        setPagamentoStatus('nao_iniciado');
      }

      // ❌ Não sobrescreve mais com SecureStore na inicialização



      // Carrega resumo de pagamento salvo
      const pagamentoResumoSalvo = await SecureStore.getItemAsync(`pagamentoResumo_${id_ifood}`);
      if (pagamentoResumoSalvo) {
        setPagamentoResumo(JSON.parse(pagamentoResumoSalvo));
      }
    })();
  }, [id_ifood, isIfood, jaFoiPago, precisaCobrar]);

  // Monitora quando a tela volta ao foco para verificar se o código foi validado
  useFocusEffect(
    React.useCallback(() => {
      const verificarCodigoValidado = async () => {
        if (isIfood) {
          const codigoValidado = await SecureStore.getItemAsync('codigoValidado');
          if (codigoValidado === 'true') {
            await SecureStore.setItemAsync(`codigoConfirmado_${id_ifood}`, 'true');
            await SecureStore.deleteItemAsync('codigoValidado');
            setCodigoStatus('validado');
          }
        }
      };
      verificarCodigoValidado();
    }, [isIfood, id_ifood])
  );

  // Monitora quando volta da tela de divisão de pagamento
  useFocusEffect(
    React.useCallback(() => {
      const verificarPagamentoDividido = async () => {
        const pagamentoStatusSalvo = await SecureStore.getItemAsync(`pagamentoStatus_${id_ifood}`);
        if (pagamentoStatusSalvo === 'confirmado') {
          setPagamentoStatus('confirmado');
          setPagamentoExpandido(false);

          const pagamentoResumoSalvo = await SecureStore.getItemAsync(`pagamentoResumo_${id_ifood}`);
          if (pagamentoResumoSalvo) {
            setPagamentoResumo(JSON.parse(pagamentoResumoSalvo));
          }
        }
      };
      verificarPagamentoDividido();
    }, [id_ifood])
  );

  const handleCodigoValidado = async () => {
    await SecureStore.setItemAsync(`codigoConfirmado_${id_ifood}`, 'true');
    setCodigoStatus('validado');
  };



  const handleConfirmarPagamentoSimples = async () => {
    const resumo: PagamentoResumo = {
      tipo: 'simples',
      metodo: metodoPagamento,
      valor: valorTotal,
    };

    await SecureStore.setItemAsync(`pagamentoResumo_${id_ifood}`, JSON.stringify(resumo));
    await SecureStore.setItemAsync(`pagamentoStatus_${id_ifood}`, 'confirmado');

    setPagamentoStatus('confirmado');  // ✅ Só confirma aqui
    setPagamentoResumo(resumo);
    setPagamentoExpandido(false);
    setMostrarBotaoProximaEntrega(true);
  };



  const abrirWhatsApp = (tipo: 'pizzaria' | 'cliente') => {
    const numero = tipo === 'pizzaria' ? '553499999999' : '553498888888';
    Linking.openURL(`https://wa.me/${numero}`);
    setModalVisible(false);
  };

  const toggleExpand = () => {
    setExpandido(!expandido);
  };

  // Função para avançar para a próxima entrega
  const handleProximaEntrega = async () => {
    if (!podeLiberar) {
      if (isIfood && codigoStatus !== 'validado') {
        alert('Você precisa validar o código do iFood primeiro!');
        return;
      }
      if (precisaCobrar && pagamentoStatus !== 'confirmado') {
        alert('Você precisa confirmar o pagamento primeiro!');
        return;
      }
      return;
    }

    const lista = await SecureStore.getItemAsync('pedidosCompletos');
    const indiceAtualStr = await SecureStore.getItemAsync('indiceAtual');
    if (lista && indiceAtualStr) {
      const pedidos = JSON.parse(lista);
      let indiceAtual = parseInt(indiceAtualStr, 10);
      await SecureStore.deleteItemAsync(`codigoConfirmado_${id_ifood}`);
      if (indiceAtual < pedidos.length - 1) {
        indiceAtual += 1;
        await SecureStore.setItemAsync('indiceAtual', indiceAtual.toString());
        router.replace('/');
      } else {
        await SecureStore.deleteItemAsync('emEntrega');
        await SecureStore.deleteItemAsync('indiceAtual');
        await SecureStore.deleteItemAsync('pedidosCompletos');
        await SecureStore.deleteItemAsync('destinos');
        await SecureStore.deleteItemAsync(`codigoConfirmado_${id_ifood}`);
        router.replace('/');
      }
    }
  };

  const handleFinalizarRota = async () => {
    await SecureStore.deleteItemAsync('emEntrega');
    await SecureStore.deleteItemAsync('indiceAtual');
    await SecureStore.deleteItemAsync('pedidosCompletos');
    await SecureStore.deleteItemAsync('destinos');
    await SecureStore.deleteItemAsync(`codigoConfirmado_${id_ifood}`);
    router.replace('/');
  };

  // Renderização do código de entrega
  const renderCodigoEntrega = () => (
    codigoStatus !== 'validado' ? (
      <View style={styles.linhaCodigo}>
        <TouchableOpacity
          style={[styles.botaoOutline, { borderColor: '#b71c1c' }]}
          onPress={() => {
            router.push({
              pathname: '/VerificationScreen',
              params: { id_ifood: String(id_ifood) }
            });
          }}



        >
          <Text style={[styles.textoBotaoOutline, { color: '#b71c1c' }]}>Validar</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={styles.codigoConfirmado}>
        <Ionicons name="checkmark-circle-outline" size={18} color="#4caf50" />
        <Text style={styles.codigoConfirmadoTexto}>
          Código confirmado
        </Text>
      </View>
    )
  );

  // Status "Cobrar/Pago" agora baseado em pagamentoStatus
  const renderStatusPago = () => (
    <View style={styles.statusItem}>
      {pagamentoStatus === 'confirmado' ? (
        <>
          <FontAwesome name="check-circle-o" size={14} color="#4caf50" />
          <Text style={[styles.statusTexto, { color: '#4caf50', fontWeight: 'bold' }]}>pago</Text>
        </>
      ) : (
        <>
          <FontAwesome name="times-circle" size={14} color="#d32f2f" />
          <Text style={[styles.statusTexto, { color: '#d32f2f', fontWeight: 'bold' }]}>Cobrar</Text>
        </>
      )}
    </View>
  );
  // Helper para exibir "validado/validar" (iFood)
  const renderStatusValidar = () => (
    <View style={styles.statusItem}>
      <MaterialCommunityIcons
        name={codigoStatus === 'validado' ? 'check-circle' : 'alert-circle'}
        size={14}
        color={codigoStatus === 'validado' ? '#4caf50' : '#d32f2f'}
      />
      <Text
        style={[
          styles.statusTexto,
          {
            color: codigoStatus === 'validado' ? '#4caf50' : '#d32f2f',
            fontWeight: 'bold',
          },
        ]}
      >
        {codigoStatus === 'validado' ? 'validado' : 'validar'}
      </Text>
    </View>
  );
  // tipagem direta no glyphMap
  const metodoIconName: Record<MetodoPagamento, keyof typeof MaterialCommunityIcons.glyphMap> = {
    Dinheiro: 'cash-multiple',
    PIX: 'qrcode',
    Débito: 'credit-card-outline',
    Crédito: 'credit-card-outline',
    Outros: 'dots-horizontal-circle-outline',
  };

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* CONTEÚDO PRINCIPAL (sem scroll) */}
      <View style={styles.conteudo}>

        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.leftButton} onPress={() => nav.goBack()}>
            <Ionicons name="arrow-back-sharp" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.titulo}>ENTREGA</Text>
          <TouchableOpacity style={styles.rightButton} onPress={() => setModalVisible(true)}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Modal de chat */}
        <Modal transparent visible={modalVisible} animationType="fade">
          <TouchableOpacity style={styles.overlay} onPress={() => setModalVisible(false)}>
            <View style={styles.modal}>
              <TouchableOpacity style={styles.opcao} onPress={() => abrirWhatsApp('pizzaria')}>
                <Text style={styles.opcaoTexto}>Falar com a pizzaria</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.opcao} onPress={() => abrirWhatsApp('cliente')}>
                <Text style={styles.opcaoTexto}>Falar com o cliente</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Endereço */}
        <View style={styles.cardEnderecoNovo}>
          <View style={styles.topoEndereco}>
            <View style={styles.blocoTextoEndereco}>
              <Text style={styles.tituloEndereco}>Endereço de entrega</Text>
              <Text style={styles.enderecoLinha1}>{endereco}</Text>
              <Text style={styles.enderecoLinha2}>{bairro}</Text>
            </View>
            <TouchableOpacity style={styles.botaoMapa}>
              <Image
                source={require('../assets/images/mapa.png')}
                style={styles.iconeMapa}
              />
              <Text style={styles.textoMapa}>Mapa</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Aviso de solicitação de código */}
        {isIfood && (
          <View style={styles.alertaCodigo}>
            <Ionicons name="alert-circle-outline" size={18} color="#888" />
            <Text style={styles.textoAlerta}>Solicite o código de entrega</Text>
          </View>
        )}

        {/* Cliente/Pedido */}
        <View style={styles.cardCliente}>
          <View style={styles.linhaTopo}>
            <View>
              <Text style={styles.nomeCliente}>{nomeCliente}</Text>
              <Text style={styles.bairro}>{bairro}</Text>
              <View style={styles.statusLinha}>
                <View style={styles.statusItem}>
                  <MaterialCommunityIcons name="shopping-outline" size={14} color="#555" />
                  <Text style={styles.statusTexto}>
                    {quantidadePedidos} pedido{quantidadePedidos > 1 ? 's' : ''}
                  </Text>
                </View>
                {isIfood ? renderStatusValidar() : (
                  <View style={styles.statusItem}>
                    <FontAwesome name="check-circle-o" size={14} color="#4caf50" />
                    <Text style={[styles.statusTexto, { color: '#4caf50', fontWeight: 'bold' }]}>Validado</Text>
                  </View>
                )}
                {precisaCobrar ? renderStatusPago() : (
                  <View style={styles.statusItem}>
                    <FontAwesome name="check-circle-o" size={14} color="#4caf50" />
                    <Text style={[styles.statusTexto, { color: '#4caf50', fontWeight: 'bold' }]}>Pago</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={[
                styles.badgeOrigem,
                isIfood ? styles.badgeIfood : styles.badgeEstabelecimento,
                { marginRight: 8, marginTop: 2 }
              ]}>
                <Text style={styles.badgeOrigemTexto}>
                  {isIfood ? 'iFood' : 'Estabelecimento'}
                </Text>
              </View>
              <TouchableOpacity onPress={toggleExpand} style={[styles.iconeContainer, { marginTop: 2 }]}>
                <Ionicons name={expandido ? "chevron-up" : "chevron-down"} size={22} color="#888" />
              </TouchableOpacity>
            </View>
          </View>

          {expandido ? (
            <View style={styles.detalhesPedido}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <FontAwesome name="file-text-o" size={22} color="#333" style={{ marginRight: 8 }} />
                <Text style={styles.pedidoIdDestaque}>
                  Pedido {isIfood ? id_ifood : id_estabelecimento}
                </Text>
              </View>
              <View style={styles.detalheLinha}>
                <FontAwesome name="phone" size={16} color="#888" style={{ marginRight: 6 }} />
                <Text style={styles.detalheLabel}>Telefone: <Text style={styles.detalheValor}>{telefone}</Text></Text>
              </View>
              <View style={styles.detalheLinha}>
                <FontAwesome name="money" size={16} color="#888" style={{ marginRight: 6 }} />
                <Text style={styles.detalheLabel}>Valor: <Text style={styles.detalheValor}>R$ {valorTotal.toFixed(2)}</Text></Text>
              </View>
              <View style={styles.detalheLinha}>
                <FontAwesome name="list" size={16} color="#888" style={{ marginRight: 6 }} />
                <Text style={styles.detalheLabel}>
                  Itens:{' '}
                  <Text style={styles.detalheValor}>
                    {Array.isArray(itens)
                      ? itens.map((item: any, idx: number) =>
                        typeof item === 'string'
                          ? item
                          : item?.nome || `Item ${idx + 1}`
                      ).join(', ')
                      : itens}
                  </Text>
                </Text>
              </View>
              {previsaoEntrega && (
                <View style={styles.detalheLinha}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#888" style={{ marginRight: 6 }} />
                  <Text style={styles.detalheLabel}>
                    Previsão de entrega: <Text style={styles.detalheValor}>{previsaoEntrega}</Text>
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.pedidoId}>
              Pedido {isIfood ? id_ifood : 'Estabelecimento'}
            </Text>
          )}

          {/* Cards compactos */}
          {isIfood ? (
            codigoStatus === 'validado' ? (
              <View style={styles.cardConfirmacao}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#4caf50" />
                <Text style={styles.cardConfirmacaoTxt} numberOfLines={1}>Código confirmado</Text>
              </View>
            ) : renderCodigoEntrega()
          ) : (
            <View style={styles.cardConfirmacao}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#4caf50" />
              <Text style={styles.cardConfirmacaoTxt} numberOfLines={1}>Não precisa de código</Text>
            </View>
          )}

          {pagamentoStatus === 'confirmado' && pagamentoResumo && (
            <View style={styles.cardConfirmado}>
              <Ionicons name="checkmark-circle" size={18} color="#4caf50" style={{ marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardConfirmadoTitulo}>Pagamento confirmado</Text>
                {pagamentoResumo.tipo === 'simples' && (
                  <Text style={styles.cardConfirmadoValor}>
                    💵 {pagamentoResumo.metodo} — R$ {pagamentoResumo.valor?.toFixed(2).replace('.', ',')}
                    {pagamentoResumo.trocoPara && ` (Troco p/ ${pagamentoResumo.trocoPara.toFixed(2).replace('.', ',')})`}
                  </Text>
                )}
                {pagamentoResumo.tipo === 'dividido' && pagamentoResumo.partes && (
                  <Text style={styles.cardConfirmadoValor}>
                    {pagamentoResumo.partes.map((parte, index) => (
                      `${parte.metodo} R$ ${parte.valor.toFixed(2).replace('.', ',')}${parte.trocoPara ? ` (Troco p/ ${parte.trocoPara.toFixed(2).replace('.', ',')})` : ''}${parte.confirmado ? ' (Confirmado)' : ''}`
                    )).join(' + ')}
                  </Text>
                )}
              </View>
            </View>
          )}



          {podeLiberar && (
            <View style={styles.tudoLiberadoBoxCompact}>
              <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
              <Text style={styles.tudoLiberadoTxtCompact} numberOfLines={1}>
                Tudo liberado! Você pode ir para a próxima entrega.
              </Text>
            </View>
          )}

          {pagamentoStatus !== 'confirmado' && precisaCobrar && (
            <TouchableOpacity
              style={[styles.botaoOutline, { borderColor: '#2e7d32' }]}
              onPress={() => setPagamentoExpandido(v => !v)}
            >
              <Text style={[styles.textoBotaoOutline, { color: '#2e7d32' }]}>Cobrar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rodapé fixo */}
      <View style={[styles.rodapeFixo, { paddingBottom: 24 + insets.bottom }]}>
        {(pagamentoExpandido || podeLiberar || mostrarBotaoProximaEntrega) && (
          <>
            {pagamentoExpandido ? (
              // 🔹 Estado: Escolhendo método de pagamento
              <View style={styles.confirmarPagamentoWrapper} onLayout={e => setSliderWidth(e.nativeEvent.layout.width)}>
                {/* Valor total no rodapé */}
                <Text style={styles.valorPagamentoTxt}>
                  Total: R$ {valorTotal.toFixed(2)}
                </Text>

                {/* Chips de método de pagamento */}
                <View style={styles.chipsMetodoWrapper}>
                  {(['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Outros'] as MetodoPagamento[]).map(metodo => (
                    <TouchableOpacity
                      key={metodo}
                      style={[
                        styles.acaoChipRodape,
                        metodoPagamento === metodo && styles.acaoChipRodapeAtivo,
                      ]}
                      onPress={() => setMetodoPagamento(metodo)}
                    >
                      <MaterialCommunityIcons
                        name={metodoIconName[metodo]}
                        size={16}
                        color={metodoPagamento === metodo ? '#fff' : '#2C79FF'}
                        style={styles.metodoIcon}
                      />
                      <Text
                        style={[
                          styles.acaoChipRodapeTxt,
                          metodoPagamento === metodo && styles.acaoChipRodapeTxtAtivo,
                        ]}
                      >
                        {metodo}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Slider para confirmar */}
                <View style={styles.confirmarPagamentoTrack}>
                  <Text style={styles.confirmarPagamentoTxt}>Arraste para confirmar</Text>
                </View>
                <Animated.View
                  style={[styles.confirmarPagamentoThumb, { transform: [{ translateX: sliderX }] }]}
                  {...panResponder.panHandlers}
                >
                  <MaterialCommunityIcons name="chevron-double-right" size={20} color="#fff" />
                </Animated.View>

                {/* Botão de dividir pagamento */}
                <TouchableOpacity
                  style={styles.acaoChipSecundariaRodape}
                  onPress={() =>
                    router.push({
                      pathname: '/dividirPagamento',
                      params: { total: valorTotal.toString(), pedidoId: String(pedidoId) },
                    })
                  }
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="calculator-variant" size={16} color="#2C79FF" style={{ marginRight: 6 }} />
                  <Text style={styles.acaoChipSecundariaTxt}>Dividir</Text>
                </TouchableOpacity>
              </View>
            ) : pagamentoStatus === 'confirmado' ? (
              // 🔹 Estado: Pagamento confirmado → mostrar resumo fixo
              <View style={styles.resumoPagamentoWrapper}>
                <Text style={styles.resumoPagamentoTxt}>
                  Pagamento confirmado: {metodoPagamento} - R$ {valorTotal.toFixed(2)}
                </Text>
              </View>
            ) : (
              // 🔹 Estado: Próxima entrega / Finalizar rota
              <TouchableOpacity
                disabled={!podeLiberar}
                style={[
                  styles.botaoProximaEntrega,
                  podeLiberar ? styles.botaoProximaEntregaAtivo : styles.botaoProximaEntregaDesabilitado,
                ]}
                onPress={isUltimaEntrega ? handleFinalizarRota : handleProximaEntrega}
              >
                <Text style={styles.textoProximaEntrega}>
                  {isUltimaEntrega ? 'Finalizar rota' : 'Próxima entrega'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}



        <TouchableOpacity
          onPress={async () => {
            await SecureStore.deleteItemAsync('emEntrega');
            await SecureStore.deleteItemAsync('indiceAtual');
            await SecureStore.deleteItemAsync('pedidosCompletos');
            await SecureStore.deleteItemAsync('destinos');
            router.replace('/');
          }}
          style={styles.botaoSair}
          activeOpacity={0.6}
        >
          <Text style={styles.textoSair}>Finalizar rota</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#f2f2f2' },

  // ===== HEADER =====
  header: {
    height: 80,
    paddingTop: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  titulo: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#111' },
  leftButton: { position: 'absolute', left: 16, top: 40, padding: 8 },
  rightButton: { position: 'absolute', right: 16, top: 40, padding: 8 },

  // ===== MODAL =====
  overlay: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    width: 260,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  opcao: { paddingVertical: 12 },
  opcaoTexto: { fontSize: 16, color: '#333' },

  // ===== ENDEREÇO =====
  cardEnderecoNovo: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  topoEndereco: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  blocoTextoEndereco: { flex: 1, paddingRight: 12 },
  tituloEndereco: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  enderecoLinha1: { fontSize: 14, color: '#000', flexShrink: 1 },
  enderecoLinha2: { fontSize: 14, color: '#666', marginTop: 4 },
  botaoMapa: {
    alignItems: 'center',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    width: 70,
    backgroundColor: '#fff',
  },
  iconeMapa: { width: 28, height: 28, marginBottom: 2 },
  textoMapa: { fontSize: 12, color: '#d32f2f', fontWeight: 'bold' },

  // ===== AVISO CODIGO =====
  alertaCodigo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  textoAlerta: { fontSize: 14, color: '#555', marginLeft: 8 },

  // ===== CARD CLIENTE/PEDIDO =====
  cardCliente: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  nomeCliente: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  bairro: { fontSize: 14, color: '#888', marginTop: 2 },
  statusLinha: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  statusTexto: { fontSize: 12, marginLeft: 4, color: '#444' },
  iconeContainer: { padding: 4 },

  // BADGES
  badgeOrigemContainer: { position: 'absolute', top: 8, right: 12, zIndex: 10 },
  badgeOrigem: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeIfood: { backgroundColor: '#ff004f' },
  badgeEstabelecimento: { backgroundColor: '#2c79ff' },
  badgeOrigemTexto: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // DETALHES PEDIDO
  pedidoId: { fontWeight: 'bold', fontSize: 14, marginVertical: 12, color: '#222' },
  detalhesPedido: { marginTop: 12, backgroundColor: '#f7f7f7', borderRadius: 8, padding: 12 },
  detalheLabel: { fontWeight: 'bold', color: '#333', marginBottom: 2 },
  detalheValor: { fontWeight: 'normal', color: '#222' },
  pedidoIdDestaque: { fontWeight: 'bold', fontSize: 20, color: '#222' },
  detalheLinha: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },

  // ===== ENTRADA CODIGO (LEGADO) =====
  linhaCodigo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  inputCodigo: {
    borderColor: '#ccc',
    borderWidth: 1.5,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    width: 100,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 10,
    textAlign: 'center',
    backgroundColor: '#fff',
    marginRight: 10,
  },
  codigoConfirmado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  codigoConfirmadoTexto: {
    color: '#4caf50',
    fontWeight: 'bold',
    fontSize: 20,
    marginLeft: 6,
    marginTop: -3,
  },

  // ===== CONFIRMAÇÕES COMPACTAS =====
  cardConfirmacao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4caf50',
  },
  cardConfirmacaoTxt: {
    marginLeft: 8,
    color: '#2e7d32',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },

  // ===== FRASE FINAL COMPACTA =====
  tudoLiberadoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, marginTop: 8 },
  tudoLiberadoTexto: { color: '#4caf50', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  // versão compacta usada agora
  tudoLiberadoBoxCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tudoLiberadoTxtCompact: {
    marginLeft: 6,
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
  },

  // ===== BOTÕES GERAIS =====
  botaoOutline: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: 350,
    borderColor: '#ddd',
  },
  textoBotaoOutline: { fontSize: 13, fontWeight: '600' },

  // ===== RODAPÉ / AÇÕES =====
  rodapeFixo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 24, // + insets.bottom no JSX
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#eee',
  },

  botaoProximaEntrega: {
    paddingVertical: 10,
    borderRadius: 6,
    alignSelf: 'center',
    width: 350,
  },
  botaoProximaEntregaDesabilitado: { backgroundColor: '#ccc' },
  botaoProximaEntregaAtivo: { backgroundColor: '#d32f2f' },
  textoProximaEntrega: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },

  botaoSair: { marginTop: 10, alignSelf: 'center', padding: 8 },
  textoSair: { color: '#888', fontSize: 15, textDecorationLine: 'underline', opacity: 0.7 },

  // ===== PAGAMENTO EMBUTIDO =====
  secaoPagamento: { marginTop: 16, paddingTop: 16 },
  divisor: { height: 1, backgroundColor: '#e0e0e0', marginBottom: 16 },
  campoContainer: { marginBottom: 10 },

  // Valor destaque (mantém seu layout)
  valorDestaqueContainer: { alignItems: 'center', marginTop: 15, marginBottom: 90 },
  valorDestaqueLabel: { fontSize: 13, color: '#777' },
  valorDestaqueValor: { fontSize: 60, fontWeight: 'bold', color: '#222' },

  // Métodos (chips)
  metodosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  metodoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C79FF',
    backgroundColor: '#EAF1FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  metodoChipSelecionado: { backgroundColor: '#2C79FF', borderColor: '#2C79FF' },
  metodoIcon: { marginRight: 4 },
  metodoLabel: { color: '#2C79FF', fontWeight: '600', fontSize: 13 },
  metodoLabelSelecionado: { color: '#fff' },

  // ===== SLIDER (MORPH NO RODAPÉ) =====
  // Wrapper ocupa o MESMO espaço do botão de próxima entrega
  confirmarPagamentoWrapper: {
    width: 350,
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Trilha do slider (estilo “botão grande”)
  confirmarPagamentoTrack: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#EFF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmarPagamentoTxt: {
    color: '#5A6B87',
    fontWeight: '700',
    fontSize: 14,
  },
  // Pino que arrasta
  confirmarPagamentoThumb: {
    position: 'absolute',
    left: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C79FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Chip "Dividir" ancorado à direita
  acaoChipSecundariaRodape: {
    position: 'absolute',
    right: -6, // levemente fora para não invadir o track
    top: 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C79FF',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  // ===== LEGADO / OPCIONAIS =====
  rodape: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
  botaoEntrega: { backgroundColor: '#c62828', borderRadius: 6, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  textoEntrega: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  opcaoMetodo: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  opcaoMetodoSelecionada: { borderColor: '#2C79FF', backgroundColor: '#2C79FF' },
  textoOpcaoMetodo: { fontSize: 14, color: '#666' },
  textoOpcaoMetodoSelecionada: { color: '#fff', fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  conteudo: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: 'flex-start',
  },

  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkboxLabel: { fontSize: 14, color: '#333', marginLeft: 8 },
  botaoCopiar: { backgroundColor: '#2C79FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, alignSelf: 'flex-start' },
  textoBotaoCopiar: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Slider antigo (se ainda usar em outro lugar)
  barraAcoesFixa: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  botaoDividirPequeno: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C79FF',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  textoBotaoDividirPequeno: { color: '#2C79FF', fontSize: 14, fontWeight: '600' },
  acaoChipSecundaria: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C79FF',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  acaoChipSecundariaTxt: {
    color: '#2C79FF',
    fontSize: 14,
    fontWeight: '700',
  },
  acaoFantasma: {
    flex: 1,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  acaoFantasmaTxt: { color: '#444', fontSize: 14, fontWeight: '600' },

  // Slider genérico (se reutilizar)
  sliderArea: { flex: 1, height: 48, position: 'relative', justifyContent: 'center' },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTxt: { color: '#5A6B87', fontWeight: '700', fontSize: 13 },
  sliderThumb: {
    position: 'absolute',
    left: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C79FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumoPagamentoGrande: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 4,
  },
  resumoPagamentoTituloGrande: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },
  resumoPagamentoValor: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1b5e20',
    textAlign: 'center',
  },
  cardConfirmado: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
    paddingVertical: 12, // mais alto que o código confirmado
    paddingHorizontal: 14,
    marginTop: 8,
  },

  cardConfirmadoTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },

  cardConfirmadoValor: {
    fontSize: 15,
    color: '#2e7d32',
    fontWeight: '500',
  },
  // confirmacaoEntrega.tsx (StyleSheet)

  valorPagamentoTxt: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C79FF',
    marginBottom: 12,
    textAlign: 'center',
  },

  chipsMetodoWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 10,
  },

  acaoChipRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C79FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    marginHorizontal: 4,
  },
  acaoChipRodapeAtivo: {
    backgroundColor: '#2C79FF',
  },
  acaoChipRodapeTxt: {
    fontSize: 14,
    color: '#2C79FF',
  },
  acaoChipRodapeTxtAtivo: {
    color: '#fff',
    fontWeight: '500',
  },

  resumoPagamentoWrapper: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
  },
  resumoPagamentoTxt: {
    fontSize: 14,
    color: '#444',
  },


});


