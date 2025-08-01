import React, { useEffect, useRef, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import * as SecureStore from 'expo-secure-store';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

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
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);

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

  useEffect(() => {
    if (entregasFinalizadas) {
      setDestinoCoords(null);
    }
  }, [entregasFinalizadas]);

  const handleUserLocationChange = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    if (!coord) return;
    setUserLocation({ latitude: coord.latitude, longitude: coord.longitude });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (userLocation) {
        mapRef.current?.animateToRegion({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        });
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [userLocation]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
      }
    })();
  }, []);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude: userLocation?.latitude ?? -18.91899,
        longitude: userLocation?.longitude ?? -48.24674,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      showsUserLocation
      onUserLocationChange={handleUserLocationChange}
    >
      {!emEntrega && pedidos.map((p) => (
        <Marker
          key={p.id}
          coordinate={p.coordinates}
          pinColor="red"
        />
      ))}

      {emEntrega && pedidos.map((p, i) => {
        const isAtual = i === indiceAtual;
        const isFuturo = i > indiceAtual;

        if (isAtual) {
          return (
            <Marker
              key={p.id}
              coordinate={p.coordinates}
              pinColor="red"
            />
          );
        }

        if (isFuturo) {
          return (
            <Marker key={p.id} coordinate={p.coordinates} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.pinCinza}>
                <Text style={styles.ordemTexto}>{i + 1}</Text>
              </View>
            </Marker>
          );
        }

        return null;
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pinCinza: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#777',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#fff',
    borderWidth: 1,
  },
  ordemTexto: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
