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
          <Ionicons name="chevron-down" size={20} color="gray" />
        </View>

        <Text style={styles.pedidoId}>Pedido 0355</Text>

        {codigoConfirmado ? (
          <TextInput
            value={codigoDigitado}
            editable={false}
            style={[styles.inputCodigoDesabilitado, { color: 'green' }]}
          />
        ) : (
          <TouchableOpacity onPress={() => setModalCodigoVisivel(true)} style={styles.botaoCodigo}>
            <Text style={styles.botaoCodigoTexto}>Digitar código do cliente</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => setModalPagamentoVisivel(true)}
          style={[styles.botaoCobrar, { backgroundColor: '#B00020' }]}
        >
          <Text style={[styles.botaoCobrarTexto, { color: '#fff' }]}>
            {pago ? 'Pago' : 'Cobrar'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.botoesFinais}>
        <TouchableOpacity
          style={[
            styles.botaoProximaEntrega,
            !(codigoConfirmado && pago) && { backgroundColor: '#ccc' },
          ]}
          onPress={irParaProximoPedido}
          disabled={!(codigoConfirmado && pago)}
        >
          <Text style={styles.botaoProximaEntregaTexto}>Próxima entrega</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoSairEntrega}>
          <Text style={styles.botaoSairEntregaTexto}>Sair da entrega</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Codigo */}
      <Modal visible={modalCodigoVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text>Digite o código do cliente:</Text>
            <TextInput
              value={codigoDigitado}
              onChangeText={setCodigoDigitado}
              style={styles.inputCodigo}
            />
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
            <TouchableOpacity onPress={() => setModalPagamentoVisivel(false)} style={styles.botaoVoltarCodigo}>
              <Text style={styles.botaoVoltarCodigoTexto}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
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
  inputCodigo: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  inputCodigoDesabilitado: {
    borderWidth: 1,
    borderColor: 'green',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    backgroundColor: '#f0fff0',
  },
  botaoCobrar: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  botaoCobrarTexto: { textAlign: 'center', fontWeight: 'bold' },
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
  botaoConfirmarCodigo: {
    marginTop: 10,
    backgroundColor: 'green',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  botaoConfirmarCodigoTexto: { color: '#fff', fontWeight: 'bold' },
  botaoVoltarCodigo: { marginTop: 10, padding: 10, alignItems: 'center' },
  botaoVoltarCodigoTexto: { color: 'gray', textAlign: 'center', fontSize: 14 },
});
