import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  Image,
  TextInput,
  ScrollView,
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
  const [pagamentoStatus, setPagamentoStatus] = useState<PagamentoStatus>(jaFoiPago ? 'confirmado' : 'nao_iniciado');
  const [pagamentoResumo, setPagamentoResumo] = useState<PagamentoResumo | null>(null);
  const [modalCodigo, setModalCodigo] = useState(false);
  const [isUltimaEntrega, setIsUltimaEntrega] = useState(false);
  const quantidadePedidos = parseInt(params.quantidadePedidos as string, 10) || 1;
  const [expandido, setExpandido] = useState(false);
  
  // Estados do pagamento simples
  const [pagamentoExpandido, setPagamentoExpandido] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('Dinheiro'); // pré-selecionado
  const [metodoPickerAberto, setMetodoPickerAberto] = useState(false); // toque para trocar
  const [trocoPara, setTrocoPara] = useState<number | undefined>();
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false); // toggle para PIX/Cartão

  // Animações (reservado)
  const pagamentoAnimacao = useRef(new Animated.Value(0)).current;
  
  // Determina se pode liberar para próxima entrega
  const podeLiberar = codigoStatus === 'validado' && pagamentoStatus === 'confirmado';

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
      
      // Se já foi pago ou não precisa cobrar, marca como pago
      if (jaFoiPago || !precisaCobrar) {
        setPagamentoStatus('confirmado');
      }

      // Carrega status de pagamento salvo
      const pagamentoStatusSalvo = await SecureStore.getItemAsync(`pagamentoStatus_${id_ifood}`);
      if (pagamentoStatusSalvo) {
        setPagamentoStatus(pagamentoStatusSalvo as PagamentoStatus);
      }

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

  // Validações de pagamento simples (valor fixo = valorTotal)
  const podeConfirmarPagamentoSimples = () => {
    if (valorTotal < 0.5) return false; // Valor mínimo R$ 0,50
    if ((metodoPagamento === 'PIX' || metodoPagamento === 'Débito' || metodoPagamento === 'Crédito') && !pagamentoConfirmado) return false;
    if (metodoPagamento === 'Dinheiro' && trocoPara && trocoPara < valorTotal) return false;
    return true;
  };

  const handleConfirmarPagamentoSimples = async () => {
    if (!podeConfirmarPagamentoSimples()) {
      alert('Verifique se todos os campos estão preenchidos corretamente.');
      return;
    }

    const resumo: PagamentoResumo = {
      tipo: 'simples',
      metodo: metodoPagamento,
      valor: valorTotal,   // valor fixo e destacado
      trocoPara,
    };

    // Salva o resumo do pagamento
    await SecureStore.setItemAsync(`pagamentoResumo_${id_ifood}`, JSON.stringify(resumo));
    await SecureStore.setItemAsync(`pagamentoStatus_${id_ifood}`, 'confirmado');
    
    setPagamentoStatus('confirmado');
    setPagamentoResumo(resumo);
    setPagamentoExpandido(false);
    setMetodoPickerAberto(false);

    alert('Pagamento confirmado!');
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
            SecureStore.setItemAsync('codigoCallback', 'true');
            router.push('/VerificationScreen');
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


return (
  <KeyboardAvoidingView
    style={styles.tela}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  >
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
      showsVerticalScrollIndicator
    >

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
                Pedido {isIfood ? id_ifood : 'Estabelecimento'}
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
  
        {podeLiberar ? (
          <View style={styles.tudoLiberadoBox}>
            <Ionicons name="checkmark-circle" size={22} color="#4caf50" />
            <Text style={styles.tudoLiberadoTexto}>
              Tudo liberado! Você pode ir para a próxima entrega.
            </Text>
          </View>
        ) : (
          isIfood
            ? renderCodigoEntrega()
            : (
              <View style={styles.codigoConfirmado}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#4caf50" />
                <Text style={styles.codigoConfirmadoTexto}>Não precisa de código</Text>
              </View>
            )
        )}

        {pagamentoStatus !== 'confirmado' && precisaCobrar && (
          <TouchableOpacity
            style={[styles.botaoOutline, { borderColor: '#2e7d32' }]}
            onPress={() => {
              setPagamentoExpandido(!pagamentoExpandido);
              setMetodoPickerAberto(false);
            }}
          >
            <Text style={[styles.textoBotaoOutline, { color: '#2e7d32' }]}>Cobrar</Text>
          </TouchableOpacity>
        )}

        {/* Resumo de pagamento confirmado */}
        {pagamentoStatus === 'confirmado' && pagamentoResumo && (
          <View style={styles.resumoPagamento}>
            <View style={styles.resumoPagamentoHeader}>
              <Ionicons name="checkmark-circle" size={18} color="#4caf50" />
              <Text style={styles.resumoPagamentoTitulo}>
                Pagamento: ✅ Confirmado {pagamentoResumo.tipo === 'dividido' ? '(Dividido)' : ''}
              </Text>
            </View>
            {pagamentoResumo.tipo === 'simples' && (
              <Text style={styles.resumoPagamentoDetalhes}>
                {pagamentoResumo.metodo} R$ {pagamentoResumo.valor?.toFixed(2).replace('.', ',')}
                {pagamentoResumo.trocoPara && ` (Troco p/ ${pagamentoResumo.trocoPara.toFixed(2).replace('.', ',')})`}
              </Text>
            )}
            {pagamentoResumo.tipo === 'dividido' && pagamentoResumo.partes && (
              <Text style={styles.resumoPagamentoDetalhes}>
                {pagamentoResumo.partes.map((parte, index) => (
                  `${parte.metodo} R$ ${parte.valor.toFixed(2).replace('.', ',')}${parte.trocoPara ? ` (Troco p/ ${parte.trocoPara.toFixed(2).replace('.', ',')})` : ''}${parte.confirmado ? ' (Confirmado)' : ''}`
                )).join(' + ')}
              </Text>
            )}
          </View>
        )}

        {/* Seção de pagamento embutida */}
        {pagamentoExpandido && (
          <Animated.View style={styles.secaoPagamento}>
            <View style={styles.divisor} />

            {/* VALOR EM DESTAQUE (não editável) */}
            <View style={styles.valorDestaqueContainer}>
              <Text style={styles.valorDestaqueLabel}>Total a cobrar</Text>
              <Text style={styles.valorDestaqueValor}>
                R$ {valorTotal.toFixed(2).replace('.', ',')}
              </Text>
            </View>
            
            {/* Forma de pagamento (chip atual + toque para trocar) */}
            <View style={styles.campoContainer}>
              <Text style={styles.campoLabel}>Forma de pagamento</Text>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.metodoAtualChip}
                onPress={() => setMetodoPickerAberto(prev => !prev)}
              >
                <Text style={styles.metodoAtualTexto}>{metodoPagamento}</Text>
                <Ionicons
                  name={metodoPickerAberto ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#2C79FF"
                />
                <Text style={styles.metodoHint}>Toque para trocar</Text>
              </TouchableOpacity>

              {metodoPickerAberto && (
                <View style={styles.pickerContainer}>
                  {(['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Outros'] as MetodoPagamento[]).map((metodo) => (
                    <TouchableOpacity
                      key={metodo}
                      style={[
                        styles.opcaoMetodo,
                        metodoPagamento === metodo && styles.opcaoMetodoSelecionada
                      ]}
                      onPress={() => {
                        setMetodoPagamento(metodo);
                        setMetodoPickerAberto(false);
                        setPagamentoConfirmado(false);
                        setTrocoPara(undefined);
                      }}
                    >
                      <Text style={[
                        styles.textoOpcaoMetodo,
                        metodoPagamento === metodo && styles.textoOpcaoMetodoSelecionada
                      ]}>
                        {metodo}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Condicionais baseadas no método */}
            {metodoPagamento === 'Dinheiro' && (
              <View style={styles.campoContainer}>
                <Text style={styles.campoLabel}>Troco para (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="R$ 0,00"
                  keyboardType="numeric"
                  value={typeof trocoPara === 'number' ? `R$ ${trocoPara.toFixed(2).replace('.', ',')}` : ''}
                  onChangeText={(text) => {
                    const valor = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                    setTrocoPara(valor);
                  }}
                />
              </View>
            )}

            {(metodoPagamento === 'PIX') && (
              <View style={styles.campoContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setPagamentoConfirmado(!pagamentoConfirmado)}
                >
                  <Ionicons 
                    name={pagamentoConfirmado ? "checkbox" : "square-outline"} 
                    size={20} 
                    color={pagamentoConfirmado ? "#4caf50" : "#666"} 
                  />
                  <Text style={styles.checkboxLabel}>PIX confirmado</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botaoCopiar}>
                  <Text style={styles.textoBotaoCopiar}>Copiar chave</Text>
                </TouchableOpacity>
              </View>
            )}

            {(metodoPagamento === 'Débito' || metodoPagamento === 'Crédito') && (
              <View style={styles.campoContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setPagamentoConfirmado(!pagamentoConfirmado)}
                >
                  <Ionicons 
                    name={pagamentoConfirmado ? "checkbox" : "square-outline"} 
                    size={20} 
                    color={pagamentoConfirmado ? "#4caf50" : "#666"} 
                  />
                  <Text style={styles.checkboxLabel}>Aprovado no POS</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Ações */}
            <View style={styles.acoesPagamento}>
              <TouchableOpacity
                style={styles.botaoCancelarPagamento}
                onPress={() => {
                  setPagamentoExpandido(false);
                  setMetodoPickerAberto(false);
                }}
              >
                <Text style={styles.textoBotaoCancelarPagamento}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.botaoConfirmarPagamento,
                  podeConfirmarPagamentoSimples() ? styles.botaoConfirmarPagamentoAtivo : styles.botaoConfirmarPagamentoInativo
                ]}
                onPress={handleConfirmarPagamentoSimples}
                disabled={!podeConfirmarPagamentoSimples()}
              >
                <Text style={styles.textoBotaoConfirmarPagamento}>Confirmar pagamento</Text>
              </TouchableOpacity>
            </View>

            {/* Botão dividir pagamento */}
            <TouchableOpacity
              style={styles.botaoDividirPagamento}
              onPress={() => router.push({
                pathname: '/dividirPagamento',
                params: { total: valorTotal.toString(), pedidoId: id_ifood.toString() }
              })}
            >
              <Text style={styles.textoBotaoDividirPagamento}>🧮 Dividir pagamento</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
  
      {/* Espaço extra para não cobrir conteúdo */}
      </ScrollView>

{/* Rodapé fixo */}
<View style={[styles.rodapeFixo, { paddingBottom: 24 + insets.bottom }]}>

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
        <TouchableOpacity
          onPress={async () => {
            const confirmar = true;
            if (confirmar) {
              await SecureStore.deleteItemAsync('emEntrega');
              await SecureStore.deleteItemAsync('indiceAtual');
              await SecureStore.deleteItemAsync('pedidosCompletos');
              await SecureStore.deleteItemAsync('destinos');
              router.replace('/');
            }
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
  header: {
    height: 80,
    paddingTop: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titulo: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  leftButton: { position: 'absolute', left: 16, top: 40, padding: 8 },
  rightButton: { position: 'absolute', right: 16, top: 40, padding: 8 },
  overlay: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: 250,
    elevation: 10,
  },
  opcao: { paddingVertical: 12 },
  opcaoTexto: { fontSize: 16, color: '#333' },
  cardEnderecoNovo: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  topoEndereco: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  blocoTextoEndereco: {
    flex: 1,
    paddingRight: 12,
  },
  tituloEndereco: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  enderecoLinha1: {
    fontSize: 14,
    color: '#000',
    flexShrink: 1,
  },
  enderecoLinha2: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  botaoMapa: {
    alignItems: 'center',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    width: 70,
  },
  iconeMapa: {
    width: 28,
    height: 28,
    marginBottom: 2,
  },
  textoMapa: {
    fontSize: 12,
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  alertaCodigo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  textoAlerta: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  cardCliente: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  nomeCliente: { fontSize: 16, fontWeight: 'bold' },
  bairro: { fontSize: 14, color: '#888', marginTop: 2 },
  statusLinha: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  statusTexto: { fontSize: 12, marginLeft: 4 },
  iconeContainer: {
    padding: 4,
  },
  collapseCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  pedidoId: { fontWeight: 'bold', fontSize: 14, marginVertical: 12 },
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
  },
  textoBotaoOutline: {
    fontSize: 13,
    fontWeight: '600',
  },
  
  botaoProximaEntrega: {
    paddingVertical: 10,
    borderRadius: 6,
    alignSelf: 'center',
    width: 350,
  },
  botaoProximaEntregaDesabilitado: {
    backgroundColor: '#ccc',
  },
  botaoProximaEntregaAtivo: {
    backgroundColor: '#d32f2f',
  },
  textoProximaEntrega: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 15,
  },
  rodapeFixo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  botaoSair: {
    marginTop: 10,
    alignSelf: 'center',
    padding: 8,
  },
  textoSair: {
    color: '#888',
    fontSize: 15,
    textDecorationLine: 'underline',
    opacity: 0.7,
  },
  rodape: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  botaoEntrega: {
    backgroundColor: '#c62828',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  textoEntrega: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  badgeOrigemContainer: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 10,
  },
  badgeOrigem: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeIfood: {
    backgroundColor: '#ff004f',
  },
  badgeEstabelecimento: {
    backgroundColor: '#2c79ff',
  },
  badgeOrigemTexto: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  detalhesPedido: {
    marginTop: 12,
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
    padding: 12,
  },
  detalheLabel: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  detalheValor: {
    fontWeight: 'normal',
    color: '#222',
  },
  pedidoIdDestaque: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#222',
  },
  detalheLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tudoLiberadoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  tudoLiberadoTexto: {
    color: '#4caf50',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },

  // Seção de pagamento
  secaoPagamento: {
    marginTop: 16,
    paddingTop: 16,
  },
  divisor: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: 16,
  },

  // Valor destacado
  valorDestaqueContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  valorDestaqueLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
  },
  valorDestaqueValor: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
  },

  campoContainer: {
    marginBottom: 16,
  },
  campoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  // Chip da forma atual
  metodoAtualChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2C79FF',
    backgroundColor: '#EAF1FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  metodoAtualTexto: {
    color: '#2C79FF',
    fontWeight: '700',
  },
  metodoHint: {
    color: '#2C79FF',
    fontSize: 12,
    marginLeft: 4,
  },

  // Grade de opções (quando aberto)
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  opcaoMetodo: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  opcaoMetodoSelecionada: {
    borderColor: '#2C79FF',
    backgroundColor: '#2C79FF',
  },
  textoOpcaoMetodo: {
    fontSize: 14,
    color: '#666',
  },
  textoOpcaoMetodoSelecionada: {
    color: '#fff',
    fontWeight: '600',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },

  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  botaoCopiar: {
    backgroundColor: '#2C79FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  textoBotaoCopiar: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  acoesPagamento: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  botaoCancelarPagamento: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginRight: 8,
    alignItems: 'center',
  },
  textoBotaoCancelarPagamento: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  botaoConfirmarPagamento: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  botaoConfirmarPagamentoAtivo: {
    backgroundColor: '#4caf50',
  },
  botaoConfirmarPagamentoInativo: {
    backgroundColor: '#ccc',
  },
  textoBotaoConfirmarPagamento: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  botaoDividirPagamento: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2C79FF',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  textoBotaoDividirPagamento: {
    color: '#2C79FF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Resumo pagamento
  resumoPagamento: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  resumoPagamentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resumoPagamentoTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4caf50',
    marginLeft: 6,
  },
  resumoPagamentoDetalhes: {
    fontSize: 13,
    color: '#666',
    marginLeft: 24,
  },

});
