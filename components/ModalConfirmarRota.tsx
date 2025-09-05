import { View, Text, Modal, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type Pedido = {
  id: number;
  id_ifood: number;
  cliente: string;
  pagamento: string;
  statusPagamento: string;
  tipoPagamento?: string;
  valorTotal: number;
  endereco: string;
  bairro?: string;
  distanciaKm: number;
  horario: string;
  troco: string;
  coordinates: { latitude: number; longitude: number };
  itens: {
    nome: string;
    tipo: string;
    quantidade: number;
    valor: number;
  }[];
};


type Destino = {
  tempo: string;
  distancia: string;
  endereco: string;
  cor: string;
  numeroPedido?: string;
  bairro?: string;
  valor?: string;
};

type ModalConfirmarRotaProps = {
  visible: boolean;
  onAceitar: (pedidos: Pedido[]) => void;
  onRecusar: () => void;
  pedidos: Pedido[];
};

export default function ModalConfirmarRota({ visible, onAceitar, onRecusar, pedidos }: ModalConfirmarRotaProps) {
  const destinos: Destino[] = pedidos.map((pedido) => ({
    tempo: pedido.horario || '5min',
    distancia: `${pedido.distanciaKm.toFixed(1)} km`,
    endereco: pedido.endereco,
    cor: '#1ecb7b',
    numeroPedido: pedido.id_ifood.toString(),
    bairro: pedido.bairro || 'Sem bairro',
    valor: pedido.valorTotal?.toFixed(2).replace('.', ',') || '',
  }));
  

  const valorTotal = pedidos.reduce((acc, p) => acc + (p.valorTotal || 0), 0);
  const valorFormatado = `R$${valorTotal.toFixed(2).replace('.', ',')}`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Valor principal */}
          <Text style={styles.valor}>{valorFormatado}</Text>

          {/* Destinos */}
          <View style={styles.destinosBox}>
            {destinos.map((dest: Destino, idx: number) => (
              <View key={idx} style={styles.destinoLinha}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  {dest.numeroPedido && (
                    <Text style={styles.destinoPedido}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#1ecb7b" /> Pedido {dest.numeroPedido}
                    </Text>
                  )}
                  <Text style={[styles.destinoTempo, { color: dest.cor }]}>
                    {'  '}{dest.tempo} ({dest.distancia})
                  </Text>
                  <Text style={styles.destinoBairro}>
                    {'  • '}{dest.bairro}
                  </Text>
                </View>
                <Text style={styles.destinoEndereco} numberOfLines={1}>{dest.endereco}</Text>
              </View>
            ))}
          </View>

          {/* Botões */}
          <View style={styles.botoesRow}>
            <TouchableOpacity style={styles.botaoRecusar} onPress={onRecusar}>
              <Text style={styles.textoRecusar}>Recusar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botaoAceitar} onPress={() => onAceitar(pedidos)}>
              <Text style={styles.textoAceitar}>Aceitar</Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: width * 0.92,
    backgroundColor: '#23232b',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    elevation: 10,
  },
  valor: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  destinosBox: {
    width: '100%',
    backgroundColor: '#23232b',
    borderRadius: 10,
    marginBottom: 16,
    marginTop: 2,
  },
  destinoLinha: {
    flexDirection: 'column',
    marginBottom: 2,
    paddingVertical: 2,
  },
  destinoPedido: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 6,
    alignItems: 'center',
    flexDirection: 'row',
  },
  destinoTempo: {
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 6,
  },
  destinoBairro: {
    color: '#bdbdbd',
    fontSize: 13,
    marginLeft: 4,
  },
  destinoEndereco: {
    color: '#fff',
    fontSize: 13,
    marginTop: 2,
  },
  botoesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  botaoRecusar: {
    flex: 1,
    backgroundColor: '#23232b',
    borderWidth: 1.5,
    borderColor: '#ff6b57',
    borderRadius: 10,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  textoRecusar: {
    color: '#ff6b57',
    fontWeight: 'bold',
    fontSize: 16,
  },
  botaoAceitar: {
    flex: 1,
    backgroundColor: '#1ecb7b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  textoAceitar: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
