import React, { useEffect, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { StyleSheet } from 'react-native';

export default function Mapa() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  return (
<MapView
  style={StyleSheet.absoluteFillObject}
  initialRegion={{
    latitude: -18.91899,
    longitude: -48.24674,
    latitudeDelta: 0.003, // 🔍 Mais zoom
    longitudeDelta: 0.003,
  }}
  showsUserLocation
>

      <Marker
        coordinate={{
          latitude: -18.91899,
          longitude: -48.24674,
        }}
        title="Alameda dos Mandarins, 500"
        description="Uberlândia - MG"
      />
    </MapView>
  );
}
