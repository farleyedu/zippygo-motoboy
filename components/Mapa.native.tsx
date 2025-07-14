import React, { useEffect, useRef, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { StyleSheet } from 'react-native';

export default function Mapa() {
  const [destinoAtual, setDestinoAtual] = useState<{ latitude: number; longitude: number } | null>(null);
  const [entregasFinalizadas, setEntregasFinalizadas] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const carregarDestino = async () => {
      try {
        const rawDestinos = await SecureStore.getItemAsync('destinos');
        const indice = parseInt(await SecureStore.getItemAsync('indiceAtual') || '0', 10);

        if (rawDestinos) {
          const destinos = JSON.parse(rawDestinos);
          if (indice >= destinos.length) {
            setEntregasFinalizadas(true); // Todas as entregas foram feitas
            setDestinoAtual(null); // Limpa marcador
          } else {
            setDestinoAtual(destinos[indice]);
          }
        }
      } catch (e) {
        console.log('[MAPA] Erro ao carregar destino:', e);
      }
    };

    carregarDestino();
    const interval = setInterval(carregarDestino, 5000);

    return () => clearInterval(interval);
  }, []);

  const focarNoMotoboy = (location: Location.LocationObject) => {
    mapRef.current?.animateToRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.003,
      longitudeDelta: 0.003,
    });
  };

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude: destinoAtual?.latitude || -18.91899,
        longitude: destinoAtual?.longitude || -48.24674,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      }}
      showsUserLocation
      onUserLocationChange={(event) => {
        const loc = event.nativeEvent.coordinate;
        if (!loc) return;
      
        const region = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        };
      
        mapRef.current?.animateToRegion(region);
      
        // Só centraliza no final da rota uma vez
        if (entregasFinalizadas) {
          mapRef.current?.animateToRegion(region);
          setEntregasFinalizadas(false);
        }
      }}
      
      
      
    >
      {destinoAtual && (
        <Marker
          coordinate={{
            latitude: destinoAtual.latitude,
            longitude: destinoAtual.longitude,
          }}
          title="Próxima Entrega"
          description="Destino atual"
        />
      )}
    </MapView>
  );
}
