import React, { useEffect, useRef, useState } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as SecureStore from 'expo-secure-store';
import { StyleSheet, Text, View, Image } from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  recenterToken?: number;
};

export default function Mapa({ pedidos, emEntrega, recenterToken }: Props) {
  const [destinoCoords, setDestinoCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const indiceAtualRef = useRef<number>(0);
  const [entregasFinalizadas, setEntregasFinalizadas] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);
  const [trackMarkers, setTrackMarkers] = useState(true);
  const hasCenteredOnceRef = useRef(false);

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
          indiceAtualRef.current = idx;
          setDestinoCoords(destinos[idx]);
        }
      }
    }

    carregarDestino();
    const iv = setInterval(carregarDestino, 5000);
    return () => clearInterval(iv);
  }, []);

  // Garante que marcadores customizados renderizem imediatamente no Android
  useEffect(() => {
    setTrackMarkers(true);
    const t = setTimeout(() => setTrackMarkers(false), 800);
    return () => clearTimeout(t);
  }, [pedidos, emEntrega]);

  useEffect(() => {
    if (entregasFinalizadas) {
      setDestinoCoords(null);
    }
  }, [entregasFinalizadas]);

  const centerTo = (coords: { latitude: number; longitude: number }) => {
    mapRef.current?.animateToRegion({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    });
  };

  const handleUserLocationChange = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    if (!coord) return;
    setUserLocation({ latitude: coord.latitude, longitude: coord.longitude });
    if (!hasCenteredOnceRef.current) {
      hasCenteredOnceRef.current = true;
      centerTo({ latitude: coord.latitude, longitude: coord.longitude });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (userLocation) {
        centerTo(userLocation);
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [userLocation]);

  // Recentraliza imediatamente quando a tela volta ao foco (token muda)
  useEffect(() => {
    if (!recenterToken) return;
    if (userLocation) {
      centerTo(userLocation);
    } else {
      (async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation(loc.coords);
          centerTo(loc.coords as any);
        } catch {}
      })();
    }
  }, [recenterToken]);

  useEffect(() => {
    // Ao organizar rota (não emEntrega), enquadra todos os pedidos no mapa
    if (!emEntrega && pedidos && pedidos.length > 0) {
      const coords = pedidos
        .filter((p) => p?.coordinates)
        .map((p) => ({ latitude: p.coordinates.latitude, longitude: p.coordinates.longitude }));
      if (coords.length > 0) {
        // 1) Tentativa com fitToCoordinates
        mapRef.current?.fitToCoordinates(coords as any, {
          edgePadding: { top: 80, bottom: 80, left: 80, right: 80 },
          animated: true,
        });
        // 2) Fallback com animateToRegion (em alguns devices o fit falha antes do layout)
        const minLat = Math.min(...coords.map((c) => c.latitude));
        const maxLat = Math.max(...coords.map((c) => c.latitude));
        const minLng = Math.min(...coords.map((c) => c.longitude));
        const maxLng = Math.max(...coords.map((c) => c.longitude));
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latDelta = Math.max(0.005, (maxLat - minLat) * 1.4);
        const lngDelta = Math.max(0.005, (maxLng - minLng) * 1.4);
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: latDelta,
            longitudeDelta: lngDelta,
          });
        }, 150);
      }
    }
  }, [pedidos, emEntrega]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
        // Centraliza assim que obtemos a primeira localização
        if (!hasCenteredOnceRef.current) {
          hasCenteredOnceRef.current = true;
          centerTo(location.coords as any);
        }
      }
    })();
  }, []);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_GOOGLE}
      moveOnMarkerPress={false}
      loadingEnabled
      scrollEnabled
      zoomEnabled
      pitchEnabled={false}
      rotateEnabled={false}
      onMapReady={async () => {
        try {
          if (userLocation) {
            centerTo(userLocation);
          } else {
            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation(loc.coords);
            centerTo(loc.coords as any);
          }
        } catch {}
      }}
      initialRegion={{
        latitude: userLocation?.latitude ?? -18.91899,
        longitude: userLocation?.longitude ?? -48.24674,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      showsUserLocation
      onUserLocationChange={handleUserLocationChange}
    >
      {!emEntrega && pedidos.map((p, i) => (
        <Marker
          key={p.id}
          coordinate={p.coordinates}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={trackMarkers}
        >
          <View style={styles.pinContainer} collapsable={false}>
            <Image
              source={require('../assets/images/alfinete.png')}
              style={styles.pinImage}
            />
            <View style={[styles.secondaryLabel, { backgroundColor: '#2C79FF' }]} pointerEvents="none">
              <Text style={styles.secondaryLabelText} allowFontScaling={false}>{i + 1}</Text>
            </View>
          </View>
        </Marker>
      ))}

      {emEntrega && pedidos.map((p, i) => {
  const isAtual = i === indiceAtualRef.current;
  const isFuturo = i > indiceAtualRef.current;

  if (isAtual) {
    return (
      <Marker
        key={p.id}
        coordinate={p.coordinates}
        tracksViewChanges={trackMarkers}
        flat
        anchor={{ x: 0.5, y: 1 }}
        centerOffset={{ x: 0, y: -10 }}
        zIndex={999}
      >
        <View style={styles.currentContainer} collapsable={false}>
          <MaterialCommunityIcons name="map-marker" size={34} color="#d32f2f" />
        </View>
      </Marker>
    );
  }

  if (isFuturo) {
    return (
      <Marker
        key={p.id}
        coordinate={p.coordinates}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges={trackMarkers}
      >
          <View style={styles.pinContainer} collapsable={false}>
          <Image
            source={require('../assets/images/alfinete.png')}
              style={styles.pinImage}
          />
          <View style={[styles.secondaryLabel, { backgroundColor: '#777' }]} pointerEvents="none">
            <Text style={styles.secondaryLabelText} allowFontScaling={false}>{i + 1}</Text>
          </View>
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
  pinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 34,
  },
  currentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 34,
  },
  pinContainerLarge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 17,
    height: 21,
  },
  pinImage: {
    width: 24,
    height: 30,
    transform: [{ translateY: -0.5 }],
  },
  pinImageLarge: {
    width: 17,
    height: 21,
    transform: [{ translateY: -0.5 }],
  },
  pinBadge: {
    position: 'absolute',
    top: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 9,
    lineHeight: 10,
  },
  pinNumeroLarge: {
    position: 'absolute',
    top: 5,
    textAlign: 'center',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  secondaryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 24,
  },
  secondaryImage: {
    width: 14,
    height: 17,
    transform: [{ translateY: -0.5 }],
  },
  secondaryLabel: {
    position: 'absolute',
    right: -3,
    top: 16,
    backgroundColor: '#777',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  secondaryLabelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  floatingNumber: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#2C79FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
    lineHeight: 12,
  },
});
