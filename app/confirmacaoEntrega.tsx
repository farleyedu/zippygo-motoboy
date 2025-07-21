import React, { useState } from 'react';
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
  const [codigoConfirmado, setCodigoConfirmado] = useState(false);
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [modalCodigo, setModalCodigo] = useState(false);
  const codigoCorreto = '1234';

  // Extrai dados do pedido dos params
  const nomeCliente = params.nome || 'Cliente';
  const bairro = params.bairro || 'Bairro';
  const endereco = params.endereco || 'Endereço';
  const id_ifood = params.id_ifood || '----';
  // Adicione outros campos conforme necessário

  const abrirWhatsApp = (tipo: 'pizzaria' | 'cliente') => {
    const numero = tipo === 'pizzaria' ? '553499999999' : '553498888888';
    Linking.openURL(`https://wa.me/${numero}`);
    setModalVisible(false);
  };

  // Função para avançar para a próxima entrega
  const handleProximaEntrega = async () => {
    const lista = await SecureStore.getItemAsync('pedidosCompletos');
    const indiceAtualStr = await SecureStore.getItemAsync('indiceAtual');
    if (lista && indiceAtualStr) {
      const pedidos = JSON.parse(lista);
      let indiceAtual = parseInt(indiceAtualStr, 10);
      if (indiceAtual < pedidos.length - 1) {
        indiceAtual += 1;
        await SecureStore.setItemAsync('indiceAtual', indiceAtual.toString());
        // Volta para o mapa, que já vai mostrar o próximo destino
        router.replace('/');
      } else {
        // Última entrega, pode exibir mensagem ou voltar para tela inicial
        router.replace('/');
      }
    }
  };

  // Renderização do código de entrega
  const renderCodigoEntrega = () => (
    !codigoConfirmado ? (
      <View style={styles.linhaCodigo}>
        <TouchableOpacity
          style={[styles.botaoOutline, { borderColor: '#b71c1c' }]}
          onPress={() => {
            // @ts-ignore
            nav.navigate('VerificationScreen', { onSuccess: () => setCodigoConfirmado(true) });
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
      <View style={styles.alertaCodigo}>
        <Ionicons name="alert-circle-outline" size={18} color="#888" />
        <Text style={styles.textoAlerta}>Solicite o código de entrega</Text>
      </View>

      {/* Cliente/Pedido */}
      <View style={styles.cardCliente}>
        <View style={styles.linhaTopo}>
          <View>
            <Text style={styles.nomeCliente}>{nomeCliente}</Text>
            <Text style={styles.bairro}>{bairro}</Text>
            <View style={styles.statusLinha}>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons name="shopping-outline" size={14} color="#555" />
                <Text style={styles.statusTexto}>1 pedido</Text>
              </View>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#d32f2f" />
                <Text style={[styles.statusTexto, { color: '#d32f2f' }]}>validar</Text>
              </View>
              <View style={styles.statusItem}>
                <FontAwesome name="check-circle-o" size={14} color="#4caf50" />
                <Text style={[styles.statusTexto, { color: '#4caf50' }]}>pago</Text>
              </View>
            </View>
          </View>
          <View style={styles.iconeContainer} />
        </View>
        <Text style={styles.pedidoId}>Pedido {id_ifood}</Text>
        {renderCodigoEntrega()}
        <TouchableOpacity
          style={[
            styles.botaoOutline,
            { borderColor: '#2e7d32' },
          ]}
          disabled={!codigoConfirmado || pagamentoConfirmado}
          onPress={() => setPagamentoConfirmado(true)}
        >
          <Text style={[styles.textoBotaoOutline, { color: '#2e7d32' }]}>Pago</Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nomeCliente: { fontSize: 16, fontWeight: 'bold' },
  bairro: { fontSize: 14, color: '#888', marginTop: 2 },
  statusLinha: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  statusTexto: { fontSize: 12, marginLeft: 4 },
  iconeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 6,
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
  botaoSair: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  textoSair: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
  },

});

