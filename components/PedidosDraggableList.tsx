import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const pedidosMock = [
  {
    id: 123,
    cliente: 'Rafael Andrade',
    pagamento: 'Pix',
    statusPagamento: 'pago', // 'pago' ou 'a_receber'
    valorTotal: 32.00,
    endereco: 'R. das Flores, 123',
    bairro: 'Centro',
    distanciaKm: 1.8,
    horario: '20:30',
    troco: 'R$50',
    itens: [
      { nome: 'X-Burguer', tipo: 'comida', quantidade: 1, valor: 18 },
      { nome: 'Coca 2L', tipo: 'bebida', quantidade: 1, valor: 10 },
      { nome: 'Batata Frita', tipo: 'comida', quantidade: 1, valor: 4 },
    ],
  },
  {
    id: 124,
    cliente: 'Maria Souza',
    pagamento: 'Dinheiro',
    statusPagamento: 'a_receber',
    valorTotal: 15.00,
    endereco: 'R. Amazonas, 124',
    bairro: 'Jardim América',
    distanciaKm: 2.6,
    horario: '19:22',
    troco: 'R$10',
    itens: [
      { nome: 'Guaraná', tipo: 'bebida', quantidade: 1, valor: 7 },
      { nome: 'Água', tipo: 'bebida', quantidade: 2, valor: 4 },
    ],
  },
  {
    id: 125,
    cliente: 'João Pedro',
    pagamento: 'Crédito',
    statusPagamento: 'pago',
    valorTotal: 8.00,
    endereco: 'R. Fortaleza, 100',
    bairro: 'Santa Mônica',
    distanciaKm: 0.9,
    horario: '20:00',
    troco: '',
    itens: [
      { nome: 'Sprite', tipo: 'bebida', quantidade: 1, valor: 8 },
    ],
  },
  {
    id: 126,
    cliente: 'Ana Paula',
    pagamento: 'Débito',
    statusPagamento: 'a_receber',
    valorTotal: 14.00,
    endereco: 'R. Angola, 107',
    bairro: 'Tabajaras',
    distanciaKm: 3.2,
    horario: '19:55',
    troco: '',
    itens: [
      { nome: 'Fanta', tipo: 'bebida', quantidade: 1, valor: 8 },
      { nome: 'Porção de Nuggets', tipo: 'comida', quantidade: 1, valor: 6 },
    ],
  },
  {
    id: 127,
    cliente: 'Carlos Lima',
    pagamento: 'Pix',
    statusPagamento: 'pago',
    valorTotal: 12.00,
    endereco: 'R. das Pedras, 127',
    bairro: 'Centro',
    distanciaKm: 2.1,
    horario: '21:10',
    troco: '',
    itens: [
      { nome: 'Coca L.', tipo: 'bebida', quantidade: 1, valor: 12 },
    ],
  },
];

type Pedido = typeof pedidosMock[0];
type ItemPedido = { nome: string; tipo: 'comida' | 'bebida'; quantidade: number; valor: number };

const getPagamentoColor = (pagamento: string, status: string) => {
  if (status === 'pago') return '#4CAF50';
  if (pagamento.toLowerCase() === 'dinheiro') return '#FFC107';
  if (pagamento.toLowerCase() === 'crédito') return '#2196F3';
  if (pagamento.toLowerCase() === 'débito') return '#00BCD4';
  return '#ccc';
};

const getPagamentoIcon = (pagamento: string) => {
  if (pagamento.toLowerCase() === 'pix') return <MaterialCommunityIcons name="qrcode" size={14} color="#4CAF50" style={{ marginRight: 2 }} />;
  if (pagamento.toLowerCase() === 'dinheiro') return <FontAwesome5 name="money-bill-wave" size={13} color="#FFC107" style={{ marginRight: 2 }} />;
  if (pagamento.toLowerCase() === 'crédito') return <MaterialCommunityIcons name="credit-card-outline" size={14} color="#2196F3" style={{ marginRight: 2 }} />;
  if (pagamento.toLowerCase() === 'débito') return <MaterialCommunityIcons name="credit-card-outline" size={14} color="#00BCD4" style={{ marginRight: 2 }} />;
  return <MaterialCommunityIcons name="credit-card-outline" size={14} color="#ccc" style={{ marginRight: 2 }} />;
};

const getStatusSelo = (status: string) => {
  if (status === 'pago') return <View style={styles.seloPago}><Text style={styles.seloPagoText}>PAGO</Text></View>;
  return <View style={styles.seloReceber}><Text style={styles.seloReceberText}>A RECEBER</Text></View>;
};

const getItemIcon = (tipo: string) => {
  if (tipo === 'comida') return <MaterialCommunityIcons name="food" size={16} color="#aaa" style={{ marginRight: 6 }} />;
  return <MaterialCommunityIcons name="cup" size={16} color="#aaa" style={{ marginRight: 6 }} />;
};

export default function PedidosDraggableList() {
  const [data, setData] = useState<Pedido[]>(pedidosMock);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Pedido>) => {
    const isExpanded = expandedId === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.card,
          isActive && { opacity: 0.85, backgroundColor: '#23232b', elevation: 8 },
          isExpanded && { transform: [{ scale: 1.01 }, { translateY: -2 }], borderColor: '#333', borderWidth: 1 },
        ]}
        onLongPress={drag}
        activeOpacity={0.95}
        delayLongPress={120}
        onPress={() => handleExpand(item.id)}
      >
        {/* Linha principal */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.infoRowCompactOneLine}>
              <Ionicons name="pricetag-outline" size={13} color="#999" style={styles.infoIcon} />
              <Text style={styles.cardId}>{item.id}</Text>
              <View style={styles.dot} />
              <Ionicons name="person-outline" size={13} color="#999" style={styles.infoIcon} />
              <Text style={styles.cardCliente}>{item.cliente}</Text>

              <View style={styles.dot} />
              <Ionicons name="time-outline" size={13} color="#999" style={styles.infoIcon} />
              <Text style={styles.cardHorario}>{item.horario}</Text>
              <View style={styles.dot} />
              <MaterialCommunityIcons name="map-marker-distance" size={15} color="#999" style={styles.infoIcon} />
              <Text style={styles.cardDistancia}>{item.distanciaKm} km</Text>
            </View>
            <View style={styles.infoRowCompact}>
              <Ionicons name="location-outline" size={15} color="#999" style={styles.infoIcon} />
              <Text style={styles.cardEndereco}>{item.endereco} - {item.bairro}</Text>

            </View>
            <View style={styles.infoRowCompact}>
  {item.troco ? (
    <>
      <Ionicons name="cash-outline" size={14} color="#FF7043" style={styles.infoIcon} />
      <Text style={styles.cardTroco}>Troco {item.troco}</Text>
      <View style={styles.dot} />
    </>
  ) : null}

  {getPagamentoIcon(item.pagamento)}
  <Text style={[styles.cardPagamento, { color: getPagamentoColor(item.pagamento, item.statusPagamento), marginRight: 6 }]}>
    {item.pagamento}
  </Text>

  {getStatusSelo(item.statusPagamento)}
</View>

          </View>
          <View style={styles.iconsRight}>
            <TouchableOpacity>
              <Ionicons name="map" size={20} color="#999" />
            </TouchableOpacity>
            <Ionicons name="reorder-three-outline" size={22} color="#666" style={{ marginLeft: 10 }} />
          </View>
        </View>
        {/* Detalhes dos itens do pedido */}
        {isExpanded && (
          <View style={[styles.itensBox, { borderLeftColor: getPagamentoColor(item.pagamento, item.statusPagamento) }]}> 
            <Text style={styles.itensTitle}>Itens do pedido:</Text>
            {item.itens.map((it, idx) => (
              <View key={idx} style={styles.itemLinha}>
                {getItemIcon((it as ItemPedido).tipo)}
                <Text style={styles.itemNome}>{(it as ItemPedido).nome}</Text>
                <Text style={styles.itemQtd}>x{(it as ItemPedido).quantidade}</Text>
                <MaterialCommunityIcons name="currency-usd" size={15} color="#4CAF50" style={{ marginLeft: 10, marginRight: 2 }} />
                <Text style={styles.itemValor}>R${((it as ItemPedido).valor * (it as ItemPedido).quantidade).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <DraggableFlatList
      data={data}
      onDragEnd={({ data }) => setData(data)}
      keyExtractor={item => item.id.toString()}
      renderItem={renderItem}
      contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#181820',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardId: {
    color: '#ccc',
    fontWeight: '500',
    fontSize: 13,
  },
  cardCliente: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cardPagamento: {
    fontWeight: '500',
    fontSize: 13,
  },
  cardHorario: {
    color: '#999',
    fontWeight: 'bold',
    fontSize: 12,
  },
  cardValorTotal: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 2,
  },
  cardEndereco: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 2,
  },
  cardDistancia: {
    color: '#aaa',
    fontSize: 13,
    marginLeft: 2,
    fontWeight: 'bold',
  },
  cardTroco: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  iconsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
    gap: 4,
  },
  infoRowCompactOneLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginBottom: 2,
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    marginHorizontal: 6,
  },
  infoIcon: {
    marginRight: 4,
  },
  seloPago: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginRight: 2,
  },
  seloPagoText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 1,
  },
  seloReceber: {
    backgroundColor: '#FFC107',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginRight: 2,
  },
  seloReceberText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 1,
  },
  itensBox: {
    backgroundColor: '#1c1c26',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 2,
    borderLeftWidth: 3,
  },
  itensTitle: {
    color: '#bbb',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  itemLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemNome: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 4,
  },
  itemQtd: {
    color: '#aaa',
    fontSize: 13,
    marginLeft: 2,
    marginRight: 8,
  },
  itemValor: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 2,
  },
});
