import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type UserLocationChangeEvent } from 'react-native-maps';
import { useIsFocused } from 'expo-router/react-navigation';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Pedido } from '../types/pedido';
import { useZippyTheme } from '../src/ui/theme';

import { MapaProps } from './mapTypes';

type Props = MapaProps & {
  pedidos: Pedido[];
  emEntrega: boolean;
  recenterToken?: number;
  routeMode?: boolean;
  mapClean?: boolean;
  onOrderPress?: (pedidoId: number) => void;
  view3D?: boolean;
};

const getPedidoCoordinate = (pedido: Pedido): { latitude: number; longitude: number } | null => {
  const coordinates = pedido.coordinates;
  if (!coordinates) {
    return null;
  }

  if (typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
    return { latitude: coordinates.lat, longitude: coordinates.lng };
  }

  return null;
};

export default function Mapa({ pedidos, emEntrega, recenterToken, routeMode = false, mapClean = false, onOrderPress, view3D = false, onMapPress, pathSegments, path, historical }: Props) {
  const { dark, reducedMotion } = useZippyTheme();
  const focused = useIsFocused();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationAuthorized, setLocationAuthorized] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [trackMarkers, setTrackMarkers] = useState(true);
  const hasCenteredOnceRef = useRef(false);
  const lastRecenterTokenRef = useRef<number | undefined>(0);
  const headingRef = useRef(0);
  // Garante que marcadores customizados renderizem imediatamente no Android
  useEffect(() => {
    setTrackMarkers(true);
    const t = setTimeout(() => setTrackMarkers(false), 800);
    return () => clearTimeout(t);
  }, [pedidos, emEntrega]);

const centerTo = useCallback((coords: { latitude: number; longitude: number }) => {
    if (mapRef.current) {
      if (routeMode) {
        mapRef.current.animateCamera({ center: coords, pitch: view3D ? 48 : 0, heading: headingRef.current, zoom: 17 }, { duration: reducedMotion ? 0 : 650 });
        return;
      }
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      });
    }
  }, [routeMode, view3D, reducedMotion]);

  const fitHistory = useCallback(() => {
    if (!historical) return;
    const coords = [...(pathSegments || (path?.length ? [path] : [])).flat().map(p => ({ latitude: p.lat, longitude: p.lng })), ...pedidos.map(getPedidoCoordinate).filter((p): p is { latitude: number; longitude: number } => !!p)].filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    if (coords.length) mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 40, bottom: 40, left: 40, right: 40 }, animated: !reducedMotion });
  }, [historical, pathSegments, path, pedidos, reducedMotion]);
  useEffect(() => { if (focused) fitHistory(); }, [focused, fitHistory]);

  const handleUserLocationChange = useCallback((e: UserLocationChangeEvent) => {
    const coord = e.nativeEvent.coordinate;
    if (historical || !coord) return;
    if (typeof coord.heading === 'number' && coord.heading >= 0 && (!coord.speed || coord.speed > 1)) headingRef.current = coord.heading;
    setUserLocation({ latitude: coord.latitude, longitude: coord.longitude });
    if (routeMode) centerTo({ latitude: coord.latitude, longitude: coord.longitude });
    if (!hasCenteredOnceRef.current) {
      hasCenteredOnceRef.current = true;
      centerTo({ latitude: coord.latitude, longitude: coord.longitude });
    }
  }, [centerTo, routeMode, historical]);

  useEffect(() => {
    if (historical) return;
    if (userLocation) centerTo(userLocation);
    if (!routeMode) mapRef.current?.animateCamera({ pitch: view3D ? 48 : 0, heading: 0 }, { duration: reducedMotion ? 0 : 450 });
  }, [routeMode, view3D, reducedMotion, centerTo, historical]);

  // Cada toque centraliza uma vez; atualizacoes do GPS nao prendem o mapa livre.
  useEffect(() => {
    if (!focused || !recenterToken || historical) return;
    if (!locationAuthorized) return;
    if (lastRecenterTokenRef.current === recenterToken) return;
    lastRecenterTokenRef.current = recenterToken;
    let alive = true;
    if (userLocation) {
      centerTo(userLocation);
    } else {
      (async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          if (!alive) return;
          setUserLocation(loc.coords);
          centerTo(loc.coords);
        } catch (error) {
          // GPS/permissões são apresentados pela preparação operacional.
        }
      })();
    }
    return () => { alive = false; };
  }, [focused, recenterToken, userLocation, locationAuthorized, centerTo, historical]);

  useEffect(() => {
    // Ao organizar rota (não emEntrega), enquadra todos os pedidos no mapa
    if (!historical && !emEntrega && pedidos && pedidos.length > 0) {
      const coords = pedidos
        .filter((p) => p?.coordinates)
        .map(getPedidoCoordinate)
        .filter((coord): coord is { latitude: number; longitude: number } => !!coord);
      if (coords.length > 0) {
        // 1) Tentativa com fitToCoordinates
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 80, bottom: 80, left: 80, right: 80 },
            animated: true,
          });
        }
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
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: latDelta,
              longitudeDelta: lngDelta,
            });
          }
        }, 150);
      }
    }
  }, [pedidos, emEntrega, historical]);

  useEffect(() => {
    if (!focused || historical) return;
    let alive = true;
    (async () => {
      try {
        const allowed = (await Location.getForegroundPermissionsAsync()).granted;
        if (!alive) return;
        setLocationAuthorized(allowed);
        if (allowed) {
          const location = await Location.getCurrentPositionAsync({});
          if (!alive) return;
          setUserLocation(location.coords);
          // Centraliza assim que obtemos a primeira localização
          if (!hasCenteredOnceRef.current) {
            hasCenteredOnceRef.current = true;
            centerTo(location.coords);
          }
        }
      } catch (error) {
        // A preparação mostra permissões/GPS; abrir o mapa não solicita acesso.
      }
    })();
    return () => { alive = false; };
  }, [centerTo, focused, historical]);

  // Memoize os marcadores para evitar re-renders desnecessários
  const markers = useMemo(() => {
    if (!emEntrega) {
      return pedidos.map((p, i) => {
        const coordinate = getPedidoCoordinate(p);
        if (!coordinate) return null;

        return (
          <React.Fragment key={`${p.id}-${i}`}>
            <Marker
              coordinate={coordinate}
              onPress={() => onOrderPress?.(p.id)}
              anchor={{ x: 0.5, y: 1 }}
              image={require('../assets/images/alfinete_85x85.png')}
              tracksViewChanges={false}
            />
            <Marker
              coordinate={coordinate}
              anchor={{ x: 0, y: 0.5 }}
              centerOffset={{ x: 8, y: 6 }}
              tracksViewChanges={trackMarkers}
            >
              <View style={[styles.floatingNumber, { backgroundColor: '#2C79FF' }]} pointerEvents="none">
                <Text style={styles.floatingNumberText} allowFontScaling={false}>{i + 1}</Text>
              </View>
            </Marker>
          </React.Fragment>
        );
      });
    }

    return pedidos.map((p, i) => {
      const coordinate = getPedidoCoordinate(p);
      if (!coordinate) return null;

      const isAtual = i === 0;
      const isFuturo = i > 0;

      if (isAtual) {
        return (
          <Marker
            key={`${p.id}-atual`}
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 1 }}
            pinColor="#2872e3"
            onPress={() => onOrderPress?.(p.id)}
            tracksViewChanges={false}
            zIndex={999}
          />
        );
      }

      if (isFuturo) {
        return (
          <React.Fragment key={`${p.id}-${i}`}>
            <Marker
              coordinate={coordinate}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => onOrderPress?.(p.id)}
              image={require('../assets/images/alfinete_32x23.png')}
              tracksViewChanges={false}
            />
            <Marker
              coordinate={coordinate}
              anchor={{ x: 0, y: 0.5 }}
              centerOffset={{ x: 8, y: 6 }}
              tracksViewChanges={trackMarkers}
            >
              <View style={[styles.floatingNumber, { backgroundColor: '#777' }]} pointerEvents="none">
                <Text style={styles.floatingNumberText} allowFontScaling={false}>{i + 1}</Text>
              </View>
            </Marker>
          </React.Fragment>
        );
      }

      return null;
    });
  }, [pedidos, emEntrega, trackMarkers, mapClean, onOrderPress]);

  return (
    <MapView
      ref={mapRef}
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', margin: 0, padding: 0 }]}
      // iOS nao tem chave do Google Maps configurada (nem o Expo Go a inclui): usa o mapa da Apple.
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      onPress={event => { if (event.nativeEvent.action !== 'marker-press') onMapPress?.(); }}
      moveOnMarkerPress={false}
      showsCompass={!mapClean}
      showsScale={!mapClean}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      loadingEnabled
      scrollEnabled
      zoomEnabled
      pitchEnabled
      rotateEnabled
      customMapStyle={dark ? [
        { elementType: 'geometry', stylers: [{ color: '#19283f' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#a9c4e5' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#18283f' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d4768' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a678d' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#102037' }] },
      ] : []}
      onMapReady={async () => {
        if (historical) { fitHistory(); return; }
        try {
          if (!locationAuthorized) return;
          if (userLocation) {
            centerTo(userLocation);
          } else {
            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation(loc.coords);
            centerTo(loc.coords as any);
          }
        } catch (error) {
          // Preserve a localização real recebida pelo GPS.
        }
      }}
      initialRegion={{
        latitude: userLocation?.latitude ?? -18.91899,
        longitude: userLocation?.longitude ?? -48.24674,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      showsUserLocation={!historical && locationAuthorized && focused}
      onUserLocationChange={handleUserLocationChange}
    >
      {(pathSegments || (path?.length ? [path] : [])).filter(segment => segment.length > 1).map((segment, i) => <Polyline key={i} coordinates={segment.map(p => ({ latitude: p.lat, longitude: p.lng }))} strokeColor="#4c91f6" strokeWidth={5} />)}
      {markers}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 14,
    height: 18,
  },
  currentContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    width: 14,
    height: 18,
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
    right: -6,
    top: 12,
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
