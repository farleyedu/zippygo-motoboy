import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

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
  onAceitar: () => void;
  onRecusar: () => void;
  rota?: {
    valor?: string;
    valorKm?: string;
    bonus?: string;
    taxa?: string;
    corridas?: string;
    nota?: string;
    perfil?: string;
    destinos?: Destino[];
  };
};

export default function ModalConfirmarRota({ visible, onAceitar, onRecusar, rota }: ModalConfirmarRotaProps) {
  // Exemplo de dados mockados, pode receber via props
  const valor = rota?.valor || 'R$20,00';
  const destinos: Destino[] = rota?.destinos || [
    { tempo: '5min', distancia: '1,8km', endereco: 'R Julien Fauvel 145 Nucleo Res Silvio Vilari, Nucleo Residencial Si...', cor: '#1ecb7b', numeroPedido: '2517', bairro: 'Santa Mônica', valor: '7,60' },
    { tempo: '7min', distancia: '2,6km', endereco: 'R. São Sebastião, 2467 , Santa Monica', cor: '#1ecb7b', numeroPedido: '2518', bairro: 'Santa Monica', valor: '8,20' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Valor principal */}
          <Text style={styles.valor}>{valor}</Text>

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
                  <Text style={[styles.destinoTempo, { color: dest.cor }]}>  {dest.tempo} ({dest.distancia})</Text>
                  <Text style={styles.destinoBairro}>  • {dest.bairro ? dest.bairro : 'Sem bairro'}</Text>
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
            <TouchableOpacity style={styles.botaoAceitar} onPress={onAceitar}>
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
  valorKm: {
    color: '#bdbdbd',
    fontSize: 16,
    marginBottom: 10,
  },
  indicadoresRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  indicadorAtivo: {
    backgroundColor: '#23232b',
    borderBottomWidth: 2,
    borderBottomColor: '#ffd600',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  indicadorAtivoTexto: {
    color: '#ffd600',
    fontWeight: 'bold',
    fontSize: 14,
  },
  indicadorInativo: {
    backgroundColor: '#23232b',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 8,
  },
  indicadorInativoTexto: {
    color: '#ffb300',
    fontWeight: 'bold',
    fontSize: 14,
  },
  corridasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nota: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 6,
    fontSize: 14,
  },
  corridas: {
    color: '#bdbdbd',
    marginRight: 6,
    fontSize: 14,
  },
  perfil: {
    color: '#4a90e2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  destinosBox: {
    width: '100%',
    backgroundColor: '#23232b',
    borderRadius: 10,
    marginBottom: 16,
    marginTop: 2,
  },
  destinoLinha: {
    flexDirection: 'column', // Changed to column for stacked layout
    marginBottom: 2,
    paddingVertical: 2,
  },
  destinoTempo: {
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 6,
  },
  destinoEndereco: {
    color: '#fff',
    fontSize: 13,
    marginTop: 2, // Added margin top for spacing
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
  destinoPedido: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginRight: 6,
    alignItems: 'center',
    flexDirection: 'row',
  },
  destinoBairro: {
    color: '#bdbdbd',
    fontSize: 13,
    marginLeft: 4,
  },
  destinoValor: {
    color: '#1ecb7b',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
}); 