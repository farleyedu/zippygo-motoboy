import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';

export default function ConfirmacaoEntregaScreen() {
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [modalCodigoVisivel, setModalCodigoVisivel] = useState(false);
  const [codigoConfirmado, setCodigoConfirmado] = useState(false);
  const [pago, setPago] = useState(false);
  const [modalPagamentoVisivel, setModalPagamentoVisivel] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('Dinheiro');
  const [detalhesVisiveis, setDetalhesVisiveis] = useState(false);

  const validarCodigo = () => {
    if (codigoDigitado === '1234') {
      setCodigoConfirmado(true);
      setModalCodigoVisivel(false);
    }
  };

  const confirmarPagamento = () => {
    setPago(true);
    setModalPagamentoVisivel(false);
  };

  const irParaProximoPedido = async () => {
    try {
      const raw = await SecureStore.getItemAsync('destinos');
      if (!raw) return;

      const destinos = JSON.parse(raw);
      const indiceAtual = parseInt((await SecureStore.getItemAsync('indiceAtual')) || '0', 10);

      if (indiceAtual + 1 >= destinos.length) {
        Alert.alert('Fim das entregas', 'Todas as entregas foram finalizadas!');
        return;
      }

      await SecureStore.setItemAsync('indiceAtual', String(indiceAtual + 1));
      await Linking.openURL(Linking.createURL('/'));
    } catch (err) {
      console.error('Erro ao avançar entrega:', err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>ENTREGA</Text>
        <Ionicons name="chatbubble-ellipses-outline" size={24} color="gray" />
      </View>

      <View style={styles.enderecoContainer}>
        <Text style={styles.enderecoTitulo}>Endereço de entrega</Text>
        <Text style={styles.enderecoTexto}>R. Padre José De Anchieta, 574, Dom Pedro, Manaus, Brazil - Dom Pedro I</Text>
        <Text style={styles.complementoTexto}>Rua Da Casa Do Reforço</Text>
        <TouchableOpacity style={styles.botaoMapa}>
          <Text style={styles.botaoMapaTexto}>Mapa</Text>
        </TouchableOpacity>
      </View>

      {!codigoConfirmado && (
        <View style={styles.alertaCodigo}>
          <Text style={styles.alertaTexto}>Solicite o código de entrega</Text>
        </View>
      )}

      <View style={styles.cardCliente}>
        <TouchableOpacity onPress={() => setDetalhesVisiveis(!detalhesVisiveis)}>
          <View style={styles.cardTopo}>
            <View>
              <Text style={styles.nomeCliente}>Cristine Alencar</Text>
              <Text style={styles.bairroCliente}>Dom Pedro I</Text>
              <View style={styles.statusLinha}>
                <Text style={styles.statusTextoCinza}>1 pedido</Text>
                <Text style={styles.statusTextoVermelho}>validar</Text>
                <Text style={styles.statusTextoVerde}>pago</Text>
              </View>
            </View>
            <Ionicons name={detalhesVisiveis ? 'chevron-up' : 'chevron-down'} size={20} color="gray" />
          </View>
        </TouchableOpacity>

        <Text style={styles.pedidoId}>Pedido 0355</Text>

        {!codigoConfirmado ? (
          <TouchableOpacity onPress={() => setModalCodigoVisivel(true)} style={styles.botaoCodigo}>
            <Text style={styles.botaoCodigoTexto}>Digitar código do cliente</Text>
          </TouchableOpacity>
        ) : (
          <TextInput
            value={codigoDigitado}
            editable={false}
            style={[styles.inputCodigoDesabilitado, { color: 'green' }]}
          />
        )}

        {pago ? (
          <View style={styles.botaoPago}>
            <Text style={styles.botaoPagoTexto}>Pago</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setModalPagamentoVisivel(true)} style={styles.botaoCobrar}>
            <Text style={styles.botaoCobrarTexto}>Cobrar</Text>
          </TouchableOpacity>
        )}

        {/* 🔽 Detalhes Expansíveis */}
        {detalhesVisiveis && (
          <View style={{ marginTop: 16 }}>
            <Text>Telefone: (92) 99111-2222</Text>
            <Text>Endereço: Rua Da Casa Do Reforço</Text>
            <Text>Previsão de entrega: 12:45</Text>
            <Text>Forma de pagamento: {formaPagamento}</Text>
            <Text>Itens:</Text>
            <Text>- Pizza Calabresa</Text>
            <Text>- Coca 2L</Text>
          </View>
        )}
      </View>

      <View style={styles.botoesFinais}>
        {codigoConfirmado && (
          <TouchableOpacity style={styles.botaoProximaEntrega} onPress={irParaProximoPedido}>
            <Text style={styles.botaoProximaEntregaTexto}>Próxima entrega</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.botaoSairEntrega}>
          <Text style={styles.botaoSairEntregaTexto}>Sair da entrega</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Código */}
      <Modal visible={modalCodigoVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text>Digite o código do cliente:</Text>
            <TextInput value={codigoDigitado} onChangeText={setCodigoDigitado} style={styles.inputCodigo} />
            <TouchableOpacity onPress={validarCodigo} style={styles.botaoConfirmarCodigo}>
              <Text style={styles.botaoConfirmarCodigoTexto}>Validar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalCodigoVisivel(false)} style={styles.botaoVoltarCodigo}>
              <Text style={styles.botaoVoltarCodigoTexto}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Pagamento */}
      <Modal visible={modalPagamentoVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text>Pagamento</Text>
            <Text>Pizza Calabresa - R$39,90</Text>
            <Text>Coca 2L - R$10,00</Text>
            <Text style={{ marginTop: 10 }}>Forma de pagamento: {formaPagamento}</Text>
            <TouchableOpacity onPress={() => setFormaPagamento(formaPagamento === 'Dinheiro' ? 'Pix' : 'Dinheiro')}>
              <Text style={{ color: 'blue', marginTop: 5 }}>Editar forma de pagamento</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmarPagamento} style={styles.botaoConfirmarCodigo}>
              <Text style={styles.botaoConfirmarCodigoTexto}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '100%',
    marginBottom: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 20, fontWeight: 'bold' },
  enderecoContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  enderecoTitulo: { fontWeight: 'bold', marginBottom: 4 },
  enderecoTexto: { color: '#222' },
  complementoTexto: { color: '#555' },
  botaoMapa: {
    backgroundColor: '#FDEDED',
    borderRadius: 8,
    padding: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  botaoMapaTexto: { color: '#B00020', fontWeight: 'bold' },
  alertaCodigo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
  },
  alertaTexto: { color: '#856404', fontWeight: 'bold' },
  cardCliente: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nomeCliente: { fontWeight: 'bold', fontSize: 16 },
  bairroCliente: { color: '#555', marginBottom: 4 },
  statusLinha: { flexDirection: 'row', gap: 12 },
  statusTextoCinza: { color: '#666' },
  statusTextoVermelho: { color: '#B00020', fontWeight: 'bold' },
  statusTextoVerde: { color: '#388E3C', fontWeight: 'bold' },
  pedidoId: { fontWeight: 'bold', marginBottom: 8 },
  botaoCodigo: {
    borderWidth: 1,
    borderColor: '#B00020',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  botaoCodigoTexto: { color: '#B00020', textAlign: 'center', fontWeight: 'bold' },
  botaoCobrar: {
    borderWidth: 1,
    borderColor: '#388E3C',
    borderRadius: 8,
    padding: 12,
  },
  botaoCobrarTexto: { color: '#388E3C', textAlign: 'center', fontWeight: 'bold' },
  botaoPago: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    padding: 12,
  },
  botaoPagoTexto: { color: '#4F4F4F', textAlign: 'center', fontWeight: 'bold' },
  botoesFinais: { marginTop: 24, alignItems: 'center' },
  botaoProximaEntrega: {
    backgroundColor: '#388E3C',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
  },
  botaoProximaEntregaTexto: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  botaoSairEntrega: { marginTop: 10 },
  botaoSairEntregaTexto: { color: '#999' },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: '#000000aa', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  inputCodigo: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  botaoConfirmarCodigo: {
    marginTop: 10,
    backgroundColor: 'green',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  inputCodigoDesabilitado: {
    borderWidth: 1,
    borderColor: 'green',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    backgroundColor: '#f0fff0',
  },
  botaoConfirmarCodigoTexto: { color: '#fff', fontWeight: 'bold' },
  botaoVoltarCodigo: { marginTop: 10, padding: 10, alignItems: 'center' },
  botaoVoltarCodigoTexto: { color: 'gray', textAlign: 'center', fontSize: 14 },
});
