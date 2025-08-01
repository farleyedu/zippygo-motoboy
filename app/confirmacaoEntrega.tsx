import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  Image,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function ConfirmacaoEntrega() {
  const nav = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [modalVisible, setModalVisible] = useState(false);
  const origem = params.origem || 'estabelecimento';
  const [codigoConfirmado, setCodigoConfirmado] = useState(origem !== 'ifood');
  const precisaCobrar = String(params.precisaCobrar) === 'true';
  const pagamentoInicial = String(params.pago) === 'true' || !precisaCobrar;
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(pagamentoInicial);
  const [modalCodigo, setModalCodigo] = useState(false);
  const codigoCorreto = '1234';
  const [isUltimaEntrega, setIsUltimaEntrega] = useState(false);
  const quantidadePedidos = parseInt(params.quantidadePedidos as string, 10) || 1;
  const [expandido, setExpandido] = useState(false);
  const podeLiberar = (origem !== 'ifood' || codigoConfirmado) && (!precisaCobrar || pagamentoConfirmado);

  // Extrai dados do pedido dos params
  const nomeCliente = params.nome || 'Cliente';
  const bairro = params.bairro || 'Bairro';
  const endereco = params.endereco || 'Endereço';
  const id_ifood = params.id_ifood || '----';
  // Adicione outros campos conforme necessário

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
      if (origem !== 'ifood') {
        setCodigoConfirmado(true);
      } else {
        // Checa status de código confirmado individual por pedido
        const status = await SecureStore.getItemAsync(`codigoConfirmado_${id_ifood}`);
        console.log('Status código confirmado', id_ifood, status);
        setCodigoConfirmado(status === 'true');
      }
    })();
    if (!precisaCobrar) setPagamentoConfirmado(true);
  }, [id_ifood, origem, precisaCobrar]);

  const handleCodigoValidado = async () => {
    await SecureStore.setItemAsync(`codigoConfirmado_${id_ifood}`, 'true');
    setCodigoConfirmado(true);
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
    const lista = await SecureStore.getItemAsync('pedidosCompletos');
    const indiceAtualStr = await SecureStore.getItemAsync('indiceAtual');
    if (lista && indiceAtualStr) {
      const pedidos = JSON.parse(lista);
      let indiceAtual = parseInt(indiceAtualStr, 10);
      // Limpa status do pedido anterior
      await SecureStore.deleteItemAsync(`codigoConfirmado_${id_ifood}`);
      if (indiceAtual < pedidos.length - 1) {
        indiceAtual += 1;
        await SecureStore.setItemAsync('indiceAtual', indiceAtual.toString());
        router.replace('/');
      } else {
        // Última entrega, finalize a rota
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
    !codigoConfirmado ? (
      <View style={styles.linhaCodigo}>
        <TouchableOpacity
          style={[styles.botaoOutline, { borderColor: '#b71c1c' }]}
          onPress={() => {
            // @ts-ignore
            nav.navigate('VerificationScreen', { onSuccess: handleCodigoValidado });
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

  // Renderização do botão de pagamento
  const renderBotaoPago = () => (
    <TouchableOpacity
      style={
        codigoConfirmado && !pagamentoConfirmado
          ? [styles.botaoOutline, { borderColor: '#2e7d32' }]
          : pagamentoConfirmado
          ? [styles.botaoOutline, { borderColor: '#2e7d32' }]
          : styles.botaoOutline
      }
      disabled={!codigoConfirmado || pagamentoConfirmado}
      onPress={() => setPagamentoConfirmado(true)}
    >
      <Text style={[styles.textoBotaoOutline, { color: '#2e7d32' }]}>Pago</Text>
    </TouchableOpacity>
  );

  // Renderização do botão próxima entrega
  const renderBotaoProximaEntrega = () => (
    <TouchableOpacity
      disabled={!codigoConfirmado || !pagamentoConfirmado}
      style={[
        styles.botaoProximaEntrega,
        codigoConfirmado && pagamentoConfirmado
          ? styles.botaoProximaEntregaAtivo
          : styles.botaoProximaEntregaDesabilitado,
      ]}
      onPress={handleProximaEntrega}
    >
      <Text style={styles.textoProximaEntrega}>Próxima entrega</Text>
    </TouchableOpacity>
  );

  const renderStatusValidar = () => (
    <View style={styles.statusItem}>
      <MaterialCommunityIcons
        name={codigoConfirmado ? 'check-circle' : 'alert-circle'}
        size={14}
        color={codigoConfirmado ? '#4caf50' : '#d32f2f'}
      />
      <Text style={[
        styles.statusTexto,
        { color: codigoConfirmado ? '#4caf50' : '#d32f2f', fontWeight: 'bold' }
      ]}>
        {codigoConfirmado ? 'validado' : 'validar'}
      </Text>
    </View>
  );

  const renderStatusPago = () => (
    <View style={styles.statusItem}>
      {pagamentoConfirmado ? (
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

  return (
    <View style={styles.tela}>
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
      {origem === 'ifood' && (
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
              {origem === 'ifood' ? renderStatusValidar() : (
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
              origem === 'ifood' ? styles.badgeIfood : styles.badgeEstabelecimento,
              { marginRight: 8, marginTop: 2 }
            ]}>
              <Text style={styles.badgeOrigemTexto}>
                {origem === 'ifood' ? 'iFood' : 'Estabelecimento'}
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
              <Text style={styles.pedidoIdDestaque}>Pedido {id_ifood}</Text>
            </View>
            <View style={styles.detalheLinha}>
              <FontAwesome name="phone" size={16} color="#888" style={{ marginRight: 6 }} />
              <Text style={styles.detalheLabel}>Telefone: <Text style={styles.detalheValor}>{params.telefone}</Text></Text>
            </View>
            <View style={styles.detalheLinha}>
              <FontAwesome name="money" size={16} color="#888" style={{ marginRight: 6 }} />
              <Text style={styles.detalheLabel}>Valor: <Text style={styles.detalheValor}>R$ {params.valor}</Text></Text>
            </View>
            <View style={styles.detalheLinha}>
              <FontAwesome name="list" size={16} color="#888" style={{ marginRight: 6 }} />
              <Text style={styles.detalheLabel}>
                Itens:{' '}
                <Text style={styles.detalheValor}>
                  {Array.isArray(params.itens)
                    ? params.itens.map((item: any, idx: number) =>
                        typeof item === 'string'
                          ? item
                          : item?.nome || `Item ${idx + 1}`
                      ).join(', ')
                    : params.itens}
                </Text>
              </Text>
            </View>
            {params.previsaoEntrega && (
              <View style={styles.detalheLinha}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#888" style={{ marginRight: 6 }} />
                <Text style={styles.detalheLabel}>
                  Previsão de entrega: <Text style={styles.detalheValor}>{params.previsaoEntrega}</Text>
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.pedidoId}>Pedido {id_ifood}</Text>
        )}
  
        {podeLiberar ? (
          <View style={styles.tudoLiberadoBox}>
            <Ionicons name="checkmark-circle" size={22} color="#4caf50" />
            <Text style={styles.tudoLiberadoTexto}>
              Tudo liberado! Você pode ir para a próxima entrega.
            </Text>
          </View>
        ) : (
          origem === 'ifood'
            ? renderCodigoEntrega()
            : (
              <View style={styles.codigoConfirmado}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#4caf50" />
                <Text style={styles.codigoConfirmadoTexto}>Não precisa de código</Text>
              </View>
            )
        )}
  
        {!pagamentoConfirmado && precisaCobrar && (
          <TouchableOpacity
            style={[styles.botaoOutline, { borderColor: '#2e7d32' }]}
            onPress={() => setPagamentoConfirmado(true)}
          >
            <Text style={[styles.textoBotaoOutline, { color: '#2e7d32' }]}>Pagar</Text>
          </TouchableOpacity>
        )}
      </View>
  
      {/* Espaço extra para não cobrir conteúdo */}
      <View style={{ height: 120 }} />
  
      {/* Rodapé fixo */}
      <View style={styles.rodapeFixo}>
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
            await SecureStore.deleteItemAsync('emEntrega');
            await SecureStore.deleteItemAsync('indiceAtual');
            await SecureStore.deleteItemAsync('pedidosCompletos');
            await SecureStore.deleteItemAsync('destinos');
            router.replace('/');
          }}
          style={styles.botaoSair}
          activeOpacity={0.6}
        >
          <Text style={styles.textoSair}>Sair da rota</Text>
        </TouchableOpacity>
      </View>
    </View>
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

});

