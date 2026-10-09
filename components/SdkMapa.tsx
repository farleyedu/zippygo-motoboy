import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { AudioGuidance, CameraPerspective, MapColorScheme, MapView, NavigationSessionStatus, NavigationView, NavigationNightMode, RouteStatus, TravelMode, useNavigation, type MapViewController, type NavigationViewController } from '@googlemaps/react-native-navigation-sdk';
import { useZippyTheme } from '../src/ui/theme';
import { waitForNavigationReset } from '../src/delivery/NativeNavigationProvider';
import type { MapaProps, MapCoordinate } from './mapTypes';

const coordinate = (value: MapCoordinate | undefined): value is MapCoordinate => !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
const center = (points: MapCoordinate[]) => ({ lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lng: points.reduce((s, p) => s + p.lng, 0) / points.length });

function useMarkers(controller: MapViewController | null, props: MapaProps, ready: boolean) {
  const previous = useRef(new Set<string>());
  const owner = useRef<MapViewController | null>(null);
  const pending = useRef(Promise.resolve());
  const key = props.pedidos.map(p => p.id + ':' + p.coordinates?.lat + ':' + p.coordinates?.lng).join('|') + ':' + props.collectionDestination?.lat + ':' + props.collectionDestination?.lng;
  useEffect(() => {
    if (!controller || !ready) return;
    let alive = true;
    const markers = props.pedidos.filter(p => coordinate(p.coordinates));
    pending.current = pending.current.catch(() => {}).then(async () => {
      if (!alive) return;
      if (owner.current !== controller) { previous.current.clear(); owner.current = controller; }
      const desired = new Set(markers.map(p => 'order:' + p.id));
      if (coordinate(props.collectionDestination)) desired.add('store');
      for (const id of previous.current) {
        if (!desired.has(id)) { await controller.removeMarker(id); previous.current.delete(id); }
      }
      if (!alive) return;
      if (coordinate(props.collectionDestination)) {
        const store = await controller.addMarker({ id: 'store', position: props.collectionDestination, title: 'Coleta no estabelecimento', imgPath: 'zippy-pin:store' });
        if (alive) previous.current.add(store.id);
        else { await controller.removeMarker(store.id); previous.current.delete(store.id); return; }
      }
      for (let i = 0; i < markers.length; i++) {
        if (!alive) return;
        const p = markers[i], index = props.pedidos.findIndex(item => item.id === p.id);
        const highlighted = index === 0 || p.id === props.selectedPedidoId;
        const marker = await controller.addMarker({ id: 'order:' + p.id, position: p.coordinates!, title: (index + 1) + 'ª parada · pedido #' + p.id, snippet: p.nomeCliente || p.cliente_nome || '', imgPath: 'zippy-pin:' + (highlighted ? 'current:' : 'future:') + (index + 1), alpha: highlighted ? 1 : .85 });
        if (!alive) { await controller.removeMarker(marker.id); previous.current.delete(marker.id); return; }
        previous.current.add(marker.id);
      }
    }).catch(() => { /* A tela informa problemas de mapa; os pedidos continuam na lista. */ });
    return () => { alive = false; };
  }, [controller, key, ready, props.selectedPedidoId]);
}

function OverviewMap(props: MapaProps) {
  const { dark } = useZippyTheme(), focused = useIsFocused();
  const [controller, setController] = useState<MapViewController | null>(null), [ready, setReady] = useState(false);
  const location = useRef<MapCoordinate | null>(null);
  const segments = props.pathSegments || (props.path?.length ? [props.path] : []);
  const points = [...segments.flat(), ...props.pedidos.map(p => p.coordinates).filter(coordinate)];
  const pointKey = points.map(p => p.lat + ':' + p.lng).join('|');
  useMarkers(controller, props, ready);
  useEffect(() => {
    if (!controller || !ready || !focused) return;
    let alive = true;
    if (points.length) {
      const spread = Math.max(...points.map(p => p.lat)) - Math.min(...points.map(p => p.lat)) + Math.max(...points.map(p => p.lng)) - Math.min(...points.map(p => p.lng));
      controller.moveCamera({ target: center(points), zoom: spread > .2 ? 10 : spread > .05 ? 12 : 14, tilt: props.view3D ? 45 : 0 });
    } else if (!props.historical) void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(p => { if (alive) { location.current = { lat: p.coords.latitude, lng: p.coords.longitude }; controller.moveCamera({ target: location.current, zoom: 15 }); } }).catch(() => {});
    return () => { alive = false; };
  }, [controller, ready, focused, pointKey, props.view3D]);
  useEffect(() => {
    if (!controller || !ready || !props.recenterToken) return;
    let alive = true; void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(p => { if (alive) controller.moveCamera({ target: { lat: p.coords.latitude, lng: p.coords.longitude }, zoom: 16, tilt: props.view3D ? 45 : 0 }); }).catch(() => {});
    return () => { alive = false; };
  }, [controller, ready, props.recenterToken]);
  useEffect(() => { if (!controller || !ready) return; segments.forEach((points, i) => { if (points.length > 1) void controller.addPolyline({ id: 'recorded-path-' + i, points, color: '#2872e3', width: 7 }); }); return () => segments.forEach((_, i) => controller.removePolyline('recorded-path-' + i)); }, [controller, ready, pointKey]);
  return <MapView style={StyleSheet.absoluteFill} onMapViewControllerCreated={setController} onMapReady={() => setReady(true)} mapColorScheme={dark ? MapColorScheme.DARK : MapColorScheme.LIGHT} myLocationEnabled={!props.historical} myLocationButtonEnabled={false} mapToolbarEnabled={false} zoomControlsEnabled={false} onMapClick={props.onMapPress} onMarkerClick={marker => { const id = Number(marker.id.split(':')[1]); if (Number.isSafeInteger(id) && id > 0) props.onOrderPress?.(id); }} />;
}

function RouteMap(props: MapaProps) {
  const { dark, sound } = useZippyTheme(), focused = useIsFocused(), insets = useSafeAreaInsets();
  const nav = useNavigation(), { navigationController: engine } = nav;
  const [map, setMap] = useState<MapViewController | null>(null), [view, setView] = useState<NavigationViewController | null>(null), [mapReady, setMapReady] = useState(false), [initialized, setInitialized] = useState(false), [gpsReady, setGpsReady] = useState(false), [routeReady, setRouteReady] = useState(false);
  const generation = useRef(0), observer = useRef(props.onNavigationState); observer.current = props.onNavigationState;
  const arrived = useRef(false), receivedGps = useRef(false), initComplete = useRef(false), latest = useRef(props); latest.current = props;
  const routing = useRef(Promise.resolve());
  const targets = props.collectionDestination ? [props.collectionDestination].filter(coordinate) : props.pedidos.map(p => p.coordinates).filter(coordinate);
  const targetKey = targets.map(p => p.lat + ':' + p.lng).join('|');
  useMarkers(map, props, mapReady);
  useEffect(() => {
    if (!focused || !mapReady) return;
    initComplete.current = false; receivedGps.current = false; setInitialized(false); setGpsReady(false); setRouteReady(false);
    let alive = true;
    nav.setOnLocationChanged(() => { if (alive) { receivedGps.current = true; setGpsReady(true); } });
    nav.setOnArrival(() => { if (!alive) return; arrived.current = true; void engine.stopGuidance(); observer.current?.({ status: 'arrived' }); });
    nav.setOnReroutingRequestedByOffRoute(() => observer.current?.({ status: 'rerouting', message: 'Recalculando o caminho…' }));
    nav.setOnRouteChanged(() => { if (!arrived.current) observer.current?.({ status: latest.current.routeMode ? 'guiding' : 'ready' }); });
    nav.setOnRemainingTimeOrDistanceChanged(value => observer.current?.({ status: arrived.current ? 'arrived' : latest.current.routeMode ? 'guiding' : 'ready', meters: value.meters, seconds: value.seconds }));
    observer.current?.({ status: 'loading', message: 'Preparando sua localização e o percurso…' });
    void (async () => {
      await waitForNavigationReset(); if (!alive) return;
      const accepted = await engine.areTermsAccepted() || await engine.showTermsAndConditionsDialog();
      if (!accepted || !alive) { if (alive) observer.current?.({ status: 'error', message: 'Aceite os termos da navegação para abrir o percurso no app.' }); return; }
      const status = await engine.init();
      if (!alive) return;
      if (status !== NavigationSessionStatus.OK) throw new Error(status === NavigationSessionStatus.NOT_AUTHORIZED ? 'O serviço de navegação ainda não está habilitado para este app.' : status === NavigationSessionStatus.LOCATION_PERMISSION_MISSING ? 'Permita a localização para iniciar a navegação.' : 'A navegação não iniciou. Confira a conexão e tente novamente.');
      initComplete.current = true; setInitialized(true);
    })().catch(error => { if (alive) observer.current?.({ status: 'error', message: error instanceof Error ? error.message : 'Não foi possível iniciar a navegação.' }); });
    const timeout = setTimeout(() => { if (alive && !receivedGps.current) observer.current?.({ status: 'error', message: 'Ainda aguardando o GPS. Confira a localização do aparelho.' }); }, 20000);
    return () => { alive = false; clearTimeout(timeout); generation.current++; nav.setOnLocationChanged(null); nav.setOnArrival(null); nav.setOnRouteChanged(null); nav.setOnReroutingRequestedByOffRoute(null); nav.setOnRemainingTimeOrDistanceChanged(null); void engine.stopGuidance().catch(() => {}); };
  }, [focused, mapReady, engine, props.retryToken, props.sessionKey]);
  useEffect(() => {
    if (!initComplete.current || !initialized || !gpsReady || !focused || !view) return;
    const run = ++generation.current; setRouteReady(false); arrived.current = false;
    if (!targets.length || !props.collectionDestination && targets.length !== props.pedidos.length) { observer.current?.({ status: 'error', message: 'Há pedido sem coordenadas. Confira o endereço com a loja antes de iniciar a rota.' }); return; }
    routing.current = routing.current.catch(() => {}).then(async () => {
      if (run !== generation.current || !initComplete.current) return;
      observer.current?.({ status: 'loading', message: 'Calculando o caminho pelas ruas…' });
      await engine.stopGuidance();
      if (run !== generation.current || !initComplete.current) return;
      const result = await engine.setDestinations(targets.map((position, index) => ({ position, title: props.collectionDestination ? 'Coleta no estabelecimento' : 'Pedido #' + props.pedidos[index]?.id, vehicleStopover: true })), { routingOptions: { travelMode: TravelMode.DRIVING }, displayOptions: { showDestinationMarkers: false } });
      if (run !== generation.current) return;
      if (result !== RouteStatus.OK) throw new Error(result === RouteStatus.QUOTA_CHECK_FAILED ? 'A navegação está indisponível no momento. Fale com a loja.' : 'Não foi possível calcular o percurso. Confira o GPS e a conexão.');
      setRouteReady(true); await view.showRouteOverview(); observer.current?.({ status: 'ready' });
    }).catch(error => { if (run === generation.current) observer.current?.({ status: 'error', message: error instanceof Error ? error.message : 'Não foi possível calcular a rota.' }); });
  }, [initialized, gpsReady, focused, view, targetKey]);
  useEffect(() => {
    if (!routeReady || !focused || !view) return;
    engine.setAudioGuidanceType(props.routeMode && sound ? AudioGuidance.VOICE_ALERTS_AND_GUIDANCE | AudioGuidance.BLUETOOTH_AUDIO : AudioGuidance.SILENT);
    void view.setNavigationUIEnabled(!!props.routeMode);
    if (props.routeMode && !arrived.current) void engine.startGuidance().then(() => view.setFollowingPerspective(props.view3D ? CameraPerspective.TILTED : CameraPerspective.TOP_DOWN_HEADING_UP)).then(() => { if (!arrived.current) observer.current?.({ status: 'guiding' }); }).catch(() => observer.current?.({ status: 'error', message: 'Não foi possível iniciar as instruções. Tente novamente.' }));
    else { void engine.stopGuidance(); void view.showRouteOverview(); }
  }, [routeReady, focused, props.routeMode, props.view3D, props.recenterToken, sound, engine, view]);
  return <View style={[StyleSheet.absoluteFill, { top: props.routeMode && !props.mapClean ? insets.top : 0 }]}><NavigationView style={{ flex: 1 }} onMapViewControllerCreated={setMap} onNavigationViewControllerCreated={setView} onMapReady={() => setMapReady(true)} mapColorScheme={dark ? MapColorScheme.DARK : MapColorScheme.LIGHT} navigationNightMode={dark ? NavigationNightMode.FORCE_NIGHT : NavigationNightMode.FORCE_DAY} headerEnabled={!!props.routeMode && !props.mapClean} footerEnabled={false} tripProgressBarEnabled={false} recenterButtonEnabled={false} reportIncidentButtonEnabled={false} myLocationButtonEnabled={false} speedLimitIconEnabled={!!props.routeMode && !props.mapClean} navigationUIEnabledPreference={1} androidStylingOptions={{ primaryDayModeThemeColor: '#2872e3', primaryNightModeThemeColor: '#1b3051', headerInstructionsTextColor: '#ffffff', headerDistanceValueTextColor: '#ffffff' }} iOSStylingOptions={{ navigationHeaderPrimaryBackgroundColor: '#2872e3', navigationHeaderPrimaryBackgroundColorNightMode: '#1b3051', navigationHeaderInstructionsTextColor: '#ffffff' }} onMapClick={props.onMapPress} onMarkerClick={marker => { const id = Number(marker.id.split(':')[1]); if (id > 0) props.onOrderPress?.(id); }} /></View>;
}
export default function SdkMapa(props: MapaProps) { return props.navigationEnabled ? <RouteMap {...props} /> : <OverviewMap {...props} />; }
