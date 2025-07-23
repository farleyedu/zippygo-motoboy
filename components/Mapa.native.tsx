// components/Mapa.native.tsx

import React, { useEffect, useRef, useState } from 'react';
import MapView, { Marker, Region } from 'react-native-maps';
import * as SecureStore from 'expo-secure-store';
import { StyleSheet, Text, View } from 'react-native';

type Pedido = {
  id: number;
  id_ifood: number;
  endereco: string;
  bairro?: string;
  cliente: string;
  distanciaKm: number;
  horario: string;
  pagamento: string;
  statusPagamento: string;
  valorTotal: number;
  troco: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  itens: {
    nome: string;
    tipo: string;
    quantidade: number;
    valor: number;
  }[];
};

type Props = {
  pedidos: Pedido[];
  emEntrega: boolean;
};

export default function Mapa({ pedidos, emEntrega }: Props) {
  const [destinoCoords, setDestinoCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [indiceAtual, setIndiceAtual] = useState<number>(0);
  const [entregasFinalizadas, setEntregasFinalizadas] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Carrega destino atual e índice da rota
  useEffect(() => {
    async function carregarDestino() {
      const rawDestinos = await SecureStore.getItemAsync('destinos');
      const rawIndice = await SecureStore.getItemAsync('indiceAtual');
      const idx = parseInt(rawIndice || '0', 10);
      if (rawDestinos) {
        const destinos: { latitude: number; longitude: number }[] = JSON.parse(rawDestinos);
        if (idx >= destinos.length) {
          setEntregasFinalizadas(true);
          setDestinoCoords(null);
        } else {
          setIndiceAtual(idx);
          setDestinoCoords(destinos[idx]);
        }
      }
    }

    carregarDestino();
    const iv = setInterval(carregarDestino, 5000);
    return () => clearInterval(iv);
  }, []);

  // Quando todas as entregas terminam, limpa o marcador
  useEffect(() => {
    if (entregasFinalizadas) {
      setDestinoCoords(null);
    }
  }, [entregasFinalizadas]);

  // Pedido atual pelo índice
  const pedidoAtual = pedidos[indiceAtual];

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude: destinoCoords?.latitude ?? -18.91899,
        longitude: destinoCoords?.longitude ?? -48.24674,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      }}
      showsUserLocation
      onUserLocationChange={e => {
        const coord = e.nativeEvent.coordinate;
        if (!coord) return;
        mapRef.current?.animateToRegion({
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        });
      }}
    >
      {/* Antes de iniciar rota: mostra todos os destinos em sequência */}
      {!emEntrega && pedidos.map((p, i) => (
        <Marker
          key={p.id}
          coordinate={p.coordinates}
          title={`Pedido #${p.id_ifood}`}
        >
          <View style={styles.seqMarker}>
            <Text style={styles.seqText}>{i + 1}</Text>
          </View>
        </Marker>
      ))}

      {/* Depois de iniciar rota: mostra apenas o próximo destino */}
      {emEntrega && destinoCoords && pedidoAtual && (
        <Marker coordinate={destinoCoords}>
          <View style={styles.markerIdBox}>
            <Text style={styles.markerIdText}>#{pedidoAtual.id_ifood}</Text>
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  seqMarker: {
    backgroundColor: '#1ecb7b',
    padding: 6,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
  },
  seqText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  markerIdBox: {
    backgroundColor: '#1ecb7b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerIdText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
