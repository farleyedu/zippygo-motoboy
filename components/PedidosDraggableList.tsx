import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle } from 'react-native-reanimated';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ItemPedido = { nome: string; tipo: 'comida' | 'bebida'; quantidade: number; valor: number };

type Pedido = {
  id: number;
  cliente: string;
  pagamento: string;
  statusPagamento: 'pago' | 'a_receber';
  valorTotal: number;
  endereco: string;
  bairro: string;
  distanciaKm: number;
  horario: string;
  troco: string;
  itens: ItemPedido[];
};

type Props = {
  pedidos: Pedido[];
  onAtualizarPedidosAceitos: (pedidos: Pedido[]) => void;
  bottomInset?: number;
};

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

export default function PedidosDraggableList({ pedidos, onAtualizarPedidosAceitos, bottomInset = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Pedido[]>(pedidos);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Pedido>, index: number) => {
    const isExpanded = expandedId === item.id;
    const animatedStyle = useAnimatedStyle(() => {
      const listHeight = 160;
      const screenHeight = 700;
      const positionY = index * 150;
      const distanceFromBottom = screenHeight - positionY + scrollY.value;
      const isBehindButton = distanceFromBottom < listHeight + 40;
      return { opacity: isBehindButton ? 0.3 : 1 };
    });

    return (
      <Animated.View style={[animatedStyle]}>
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
          {isExpanded && (
            <View style={[styles.itensBox, { borderLeftColor: getPagamentoColor(item.pagamento, item.statusPagamento) }]}>
              <Text style={styles.itensTitle}>Itens do pedido:</Text>
              {item.itens.map((it, idx) => (
                <View key={idx} style={styles.itemLinha}>
                  {getItemIcon(it.tipo)}
                  <Text style={styles.itemNome}>{it.nome}</Text>
                  <Text style={styles.itemQtd}>x{it.quantidade}</Text>
                  <MaterialCommunityIcons name="currency-usd" size={15} color="#4CAF50" style={{ marginLeft: 10, marginRight: 2 }} />
                  <Text style={styles.itemValor}>R${(it.valor * it.quantidade).toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <DraggableFlatList
      data={data}
      onDragEnd={({ data }) => {
        setData(data);
        onAtualizarPedidosAceitos(data);
      }}
      keyExtractor={(item) => item.id?.toString() ?? Math.random().toString()}
      renderItem={(params) => renderItem(params, (params as any).index)}
      contentContainerStyle={{ padding: 14, paddingBottom: 160 + insets.bottom + bottomInset }}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
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
