import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type MetodoPagamento = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito';

const icones: Record<MetodoPagamento, any> = {
  Dinheiro: 'cash',
  PIX: 'qrcode',
  Débito: 'credit-card-outline',
  Crédito: 'credit-card',
};

interface Props {
  visivel: boolean;
  valor: number;
  metodo: MetodoPagamento;
  onSelect: (m: MetodoPagamento) => void;
  onConfirmar: () => void;
  onVoltar: () => void;
}

export default function ModalPagamento({
  visivel,
  valor,
  metodo,
  onSelect,
  onConfirmar,
  onVoltar,
}: Props) {
  return (
    <Modal transparent visible={visivel} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.titulo}>Forma de pagamento</Text>
          <View style={styles.opcoes}>
            {(['Dinheiro', 'PIX', 'Débito', 'Crédito'] as MetodoPagamento[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.botaoMetodo, metodo === m && styles.botaoMetodoAtivo]}
                onPress={() => onSelect(m)}
              >
                <MaterialCommunityIcons
                  name={icones[m]}
                  size={18}
                  color={metodo === m ? '#fff' : '#2C79FF'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.botaoMetodoTxt, metodo === m && styles.botaoMetodoTxtAtivo]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.valor}>R$ {valor.toFixed(2).replace('.', ',')}</Text>

          <View style={styles.rodape}>
            <TouchableOpacity style={[styles.acao, styles.voltar]} onPress={onVoltar}>
              <Text style={[styles.acaoTxt, styles.voltarTxt]}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.acao, styles.confirmar]} onPress={onConfirmar}>
              <Text style={[styles.acaoTxt, styles.confirmarTxt]}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 300,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  opcoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  botaoMetodo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C79FF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  botaoMetodoAtivo: {
    backgroundColor: '#2C79FF',
  },
  botaoMetodoTxt: {
    color: '#2C79FF',
    fontWeight: '600',
  },
  botaoMetodoTxtAtivo: {
    color: '#fff',
  },
  valor: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#000',
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  acao: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  voltar: {
    borderWidth: 1,
    borderColor: '#999',
    marginRight: 8,
  },
  confirmar: {
    backgroundColor: '#2C79FF',
    marginLeft: 8,
  },
  acaoTxt: {
    fontWeight: '700',
  },
  voltarTxt: {
    color: '#666',
  },
  confirmarTxt: {
    color: '#fff',
  },
});

