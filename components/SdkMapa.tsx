import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PixelRatio, Platform, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { AudioGuidance, CameraPerspective, MapColorScheme, MapView, NavigationSessionStatus, NavigationView, NavigationNightMode, NavigationUIEnabledPreference, RouteStatus, TravelMode, useNavigation, type MapViewController, type NavigationViewController } from '@googlemaps/react-native-navigation-sdk';
import { useZippyTheme } from '../src/ui/theme';
import { waitForNavigationReset, waitForNavigationStop } from '../src/delivery/NativeNavigationProvider';
import { NavigationJourney } from '../src/delivery/navigationJourney';
import { NavigationDiagnostics, diagnoseNavigationConnection } from '../src/delivery/navigationDiagnostics';
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
    const markers = props.routeMode ? [] : props.pedidos.filter(p => coordinate(p.coordinates));
    pending.current = pending.current.catch(() => {}).then(async () => {
      if (!alive) return;
      if (owner.current !== controller) { previous.current.clear(); owner.current = controller; }
      const desired = new Set(markers.map(p => 'order:' + p.id));
      if (!props.routeMode && coordinate(props.collectionDestination)) desired.add('store');
      for (const id of previous.current) {
        if (!desired.has(id)) { await controller.removeMarker(id); previous.current.delete(id); }
      }
      if (!alive) return;
      if (!props.routeMode && coordinate(props.collectionDestination)) {
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
  }, [controller, key, ready, props.selectedPedidoId, props.routeMode]);
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
  const { dark, sound } = useZippyTheme(), insets = useSafeAreaInsets();
  const mapPadding = useMemo(() => {
    // O SDK 0.16.3 recebe pixels físicos no Android e pontos no iOS.
    const nativeSize = (size: number) => Platform.OS === 'android' ? PixelRatio.getPixelSizeForLayoutSize(size) : size;
    return { top: 0, left: nativeSize(12), right: nativeSize(12), bottom: nativeSize(props.navigationBottomInset || 0) };
  }, [props.navigationBottomInset]);
  const nav = useNavigation(), { navigationController: engine } = nav;
  const [map, setMap] = useState<MapViewController | null>(null), [view, setView] = useState<NavigationViewController | null>(null);
  const [mapReady, setMapReady] = useState(false), [initialized, setInitialized] = useState(false), [gpsReady, setGpsReady] = useState(false);
  const observer = useRef(props.onNavigationState); observer.current = props.onNavigationState;
  const latest = useRef(props); latest.current = props;
  const perspective = useRef(props.view3D); perspective.current = props.view3D;
  const journey = useRef<NavigationJourney | null>(null);
  const diagnostic = useRef(new NavigationDiagnostics(__DEV__));
  const lastGps = useRef<number | null>(null);
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const targets = props.collectionDestination ? [{ position: props.collectionDestination, title: 'Endereço da coleta' }] : props.pedidos.map(p => ({
    position: p.coordinates, title: p.enderecoEntrega || p.bairro || 'Endereço de destino',
  }));
  const targetKey = targets.map(p => p.position?.lat + ':' + p.position?.lng).join('|');
  const destinationKey = props.collectionDestination ? 'store:' + targetKey : props.pedidos.map(p => p.id).join(',') + ':' + targetKey;
  // While driving, expose destination addresses, not order cards or product details.
  useMarkers(map, props, mapReady);

  useEffect(() => {
    if (!mapReady) { diagnostic.current.event('bootstrap.waiting.map', { retry: props.retryToken || 0, viewReady: !!view }); return; }
    let alive = true, receivedGps = false;
    const log = new NavigationDiagnostics(__DEV__); diagnostic.current = log; lastGps.current = null;
    log.event('bootstrap.begin', { retry: props.retryToken || 0, mapReady, viewReady: !!view });
    const appStateSubscription = __DEV__ ? AppState.addEventListener('change', state => log.event('app.state', { state })) : null;
    if (__DEV__) {
      log.event('environment', { platform: Platform.OS, osVersion: String(Platform.Version), appState: AppState.currentState });
      // Read-only checks: never open a permission dialog or delay SDK startup.
      void Promise.all([Location.getForegroundPermissionsAsync(), Location.hasServicesEnabledAsync()])
        .then(([permission, locationEnabled]) => { if (alive) log.event('gps.permission', { status: permission.status, canAskAgain: permission.canAskAgain, locationEnabled }); })
        .catch(error => { if (alive) log.error('gps.permission.error', error); });
    }
    setInitialized(false); setGpsReady(false);
    const seen = new Set<string>();
    const receiveGps = (source: string, value: MapCoordinate & { accuracy?: number; time?: number }) => {
      if (!alive) return;
      const valid = coordinate(value);
      if (!seen.has(source)) { seen.add(source); log.event('gps.first', { source, valid, accuracyMeters: value?.accuracy, fixAgeMs: value?.time ? Date.now() - value.time : undefined }, !valid); }
      if (valid) { lastGps.current = Date.now(); receivedGps = true; setGpsReady(true); }
    };
    nav.setOnLocationChanged(value => receiveGps('snapped', value));
    nav.setOnRawLocationChanged(value => receiveGps('raw', value));
    nav.setLogDebugInfo(message => log.event('sdk.native.message', { message }, true));
    nav.setOnArrival(() => { if (alive) { log.event('sdk.arrival'); journey.current?.arrival(); } });
    nav.setOnReroutingRequestedByOffRoute(() => { if (alive) { log.event('sdk.rerouting'); journey.current?.rerouting(); } });
    nav.setOnRemainingTimeOrDistanceChanged(value => { if (alive) journey.current?.remaining(value.meters, value.seconds); });
    observer.current?.({ status: 'loading', message: 'Preparando o GPS e a navegação…' });
    void (async () => {
      const resetFinished = log.operation('reset.wait');
      await waitForNavigationReset(); resetFinished(); if (!alive) return;
      log.event('reset.finished');
      const accepted = await engine.areTermsAccepted() || await engine.showTermsAndConditionsDialog();
      log.event('terms.result', { accepted });
      if (!alive) return;
      if (!accepted) throw new Error('Aceite os termos da navegação para abrir o percurso no app.');
      const initStarted = Date.now(); log.event('sdk.init.begin');
      const status = await engine.init();
      log.event('sdk.init.result', { status, durationMs: Date.now() - initStarted }, status !== NavigationSessionStatus.OK);
      if (!alive) return;
      if (status !== NavigationSessionStatus.OK) throw new Error(status === NavigationSessionStatus.NOT_AUTHORIZED ? 'O serviço de navegação ainda não está habilitado para este app.' : status === NavigationSessionStatus.LOCATION_PERMISSION_MISSING ? 'Permita a localização para iniciar a navegação.' : 'A navegação não iniciou. Confira a conexão e tente novamente.');
      // Registering the JS callback does not start the native location provider.
      // Raw GPS can arrive before the road-snapped position, especially stationary.
      engine.startUpdatingLocation();
      log.event('gps.updates.requested');
      if (__DEV__) void engine.getNavSDKVersion().then(version => { if (alive) log.event('sdk.version', { version }); }).catch(error => log.error('sdk.version.error', error));
      setInitialized(true);
    })().catch(error => { if (alive) { log.error('bootstrap.error', error); observer.current?.({ status: 'error', message: error instanceof Error ? error.message : 'Não foi possível iniciar a navegação.' }); } });
    const timeout = setTimeout(() => { if (alive && !receivedGps) { log.event('gps.timeout', { timeoutMs: 20000 }, true); observer.current?.({ status: 'error', message: 'Ainda aguardando o GPS. Confira a localização do aparelho.' }); } }, 20000);
    return () => {
      alive = false; clearTimeout(timeout); appStateSubscription?.remove(); log.close(); engine.stopUpdatingLocation(); if (journey.current) waitForNavigationStop(journey.current.dispose()); journey.current = null;
      log.event('bootstrap.dispose');
      nav.setLogDebugInfo(null);
      nav.setOnLocationChanged(null); nav.setOnRawLocationChanged(null); nav.setOnArrival(null); nav.setOnReroutingRequestedByOffRoute(null); nav.setOnRemainingTimeOrDistanceChanged(null);
      // Session lifecycle owns shutdown. Screen blur must not interrupt voice guidance.
    };
  }, [mapReady, engine, props.retryToken, props.sessionKey]);

  useEffect(() => {
    diagnostic.current.event('route.readiness', { retry: props.retryToken || 0, initialized, gpsReady, viewReady: !!view });
    if (!initialized || !gpsReady || !view) return;
    const coordinator = new NavigationJourney({
      prepare: async request => {
        const log = diagnostic.current, started = Date.now();
        log.event('route.begin', { destinations: request.destinations.length, validCoordinates: request.destinations.every(d => coordinate(d.position)), travelMode: 'TWO_WHEELER', lastGpsAgeMs: lastGps.current === null ? undefined : started - lastGps.current });
        if (!request.destinations.length || request.destinations.some(d => !coordinate(d.position))) throw new Error('Confira as coordenadas do endereço antes de iniciar a rota.');
        const finished = log.operation('route.native', { travelModeValue: TravelMode.TWO_WHEELER, vehicleStopover: true, showDestinationMarkers: true, appState: __DEV__ ? AppState.currentState : undefined });
        let result: RouteStatus;
        try { result = await engine.setDestinations(request.destinations.map(d => ({ ...d, vehicleStopover: true })), {
          routingOptions: { travelMode: TravelMode.TWO_WHEELER }, displayOptions: { showDestinationMarkers: true },
        }); } catch (error) { finished({ rejected: true }, true); log.error('route.exception', error); throw error; }
        finished({ status: result, lastGpsAgeMs: lastGps.current === null ? undefined : Date.now() - lastGps.current, appState: __DEV__ ? AppState.currentState : undefined }, result !== RouteStatus.OK);
        log.event('route.result', { status: result, durationMs: Date.now() - started }, result !== RouteStatus.OK);
        if (result !== RouteStatus.OK) {
          console.warn('[Navegação] Cálculo não concluído:', result);
          if (result === RouteStatus.NETWORK_ERROR) diagnoseNavigationConnection(log);
          throw new Error(result === RouteStatus.QUOTA_CHECK_FAILED ? 'A navegação está indisponível no momento. Fale com a loja.' : result === RouteStatus.LOCATION_UNKNOWN || result === RouteStatus.LOCATION_DISABLED ? 'O navegador ainda não recebeu uma posição válida. Aguarde o GPS e tente novamente.' : result === RouteStatus.NO_ROUTE_FOUND ? 'O navegador não encontrou um caminho para este endereço.' : result === RouteStatus.NETWORK_ERROR ? 'Não foi possível consultar o percurso. Confira a conexão e tente novamente.' : 'Não foi possível calcular o percurso. Confira o GPS e a conexão.');
        }
      },
      start: async () => { diagnostic.current.event('guidance.begin'); await engine.startGuidance(); diagnostic.current.event('guidance.started'); },
      stop: async () => {
        const log = diagnostic.current, finished = log.operation('guidance.stop');
        try { await engine.stopGuidance(); finished(); } catch (error) { finished({ rejected: true }, true); log.error('guidance.stop.error', error); throw error; }
      },
      navigationUI: value => view.setNavigationUIEnabled(value),
      audio: muted => engine.setAudioGuidanceType(muted ? AudioGuidance.SILENT : AudioGuidance.VOICE_ALERTS_AND_GUIDANCE | AudioGuidance.BLUETOOTH_AUDIO),
      follow: () => view.setFollowingPerspective(perspective.current ? CameraPerspective.TILTED : CameraPerspective.TOP_DOWN_HEADING_UP),
      overview: async () => { await view.showRouteOverview(); },
    }, state => observer.current?.(state));
    journey.current = coordinator;
    return () => { waitForNavigationStop(coordinator.dispose()); if (journey.current === coordinator) journey.current = null; };
  }, [initialized, gpsReady, view, engine, props.retryToken]);

  useEffect(() => {
    if (!initialized || !gpsReady || !view || !journey.current) return;
    void journey.current.sync({
      key: destinationKey, destinations: targets as { position: MapCoordinate; title: string }[],
      enabled: !!props.routeMode, follow: props.cameraFollowing !== false,
      cameraToken: String(props.recenterToken || 0) + ':' + !!props.view3D,
      muted: props.navigationMuted ?? !sound,
    });
  }, [initialized, gpsReady, view, destinationKey, props.routeMode, props.cameraFollowing, props.view3D, props.recenterToken, props.navigationMuted, sound, props.retryToken]);

  const inset = props.routeMode ? insets.top : 0;
  return <View style={[StyleSheet.absoluteFill, { top: inset }]}
    onTouchStart={event => { const p = event.nativeEvent; touch.current = { x: p.pageX, y: p.pageY, moved: false }; }}
    onTouchMove={event => {
      const start = touch.current, p = event.nativeEvent;
      if (props.routeMode && start && !start.moved && (p.touches.length > 1 || Math.hypot(p.pageX - start.x, p.pageY - start.y) > 8)) {
        start.moved = true; latest.current.onCameraExplore?.();
      }
    }}
    onTouchEnd={() => { touch.current = null; }}
    onTouchCancel={() => { touch.current = null; }}>
    <NavigationView style={{ flex: 1 }}
      onMapViewControllerCreated={setMap} onNavigationViewControllerCreated={setView} onMapReady={() => setMapReady(true)}
      mapColorScheme={dark ? MapColorScheme.DARK : MapColorScheme.LIGHT}
      navigationNightMode={dark ? NavigationNightMode.FORCE_NIGHT : NavigationNightMode.FORCE_DAY}
      mapPadding={mapPadding}
      headerEnabled={!!props.routeMode} footerEnabled={false} tripProgressBarEnabled={false}
      recenterButtonEnabled={false} reportIncidentButtonEnabled={false} myLocationButtonEnabled={false}
      speedLimitIconEnabled={!!props.routeMode} navigationUIEnabledPreference={NavigationUIEnabledPreference.AUTOMATIC}
      scrollGesturesEnabled zoomGesturesEnabled rotateGesturesEnabled tiltGesturesEnabled
      androidStylingOptions={{ primaryDayModeThemeColor: '#2872e3', primaryNightModeThemeColor: '#1b3051', headerInstructionsTextColor: '#ffffff', headerDistanceValueTextColor: '#ffffff' }}
      iOSStylingOptions={{ navigationHeaderPrimaryBackgroundColor: '#2872e3', navigationHeaderPrimaryBackgroundColorNightMode: '#1b3051', navigationHeaderInstructionsTextColor: '#ffffff' }}
      onMapClick={() => { if (!props.routeMode) props.onMapPress?.(); }}
      onMarkerClick={marker => { if (!props.routeMode) { const id = Number(marker.id.split(':')[1]); if (id > 0) props.onOrderPress?.(id); } }} />
  </View>;
}
export default function SdkMapa(props: MapaProps) { return props.navigationEnabled ? <RouteMap {...props} /> : <OverviewMap {...props} />; }
