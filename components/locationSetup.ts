import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { getSecureItem } from '../utils/secureStorage';
import { browserNativeTest, reportBrowserMock } from '../services/browserNativeTest';
import { expoGo } from '../services/expoGo';
import { restartBackgroundLocation, stopBackgroundLocation } from '../services/backgroundLocationLifecycle';
import { createWebForegroundLocation, subscribeWebForeground } from '../services/webForegroundLocation';
import { readWebLocationPermission, rememberWebLocationPermission, requestWebLocationPermission } from '../services/webLocationPermission';
import {
  maintainOperationalPresence,
  sendCurrentLocation,
  sendLocation,
  setTrackingMode,
  TrackingMode,
} from '../services/trackingService';

let expoGoWatch: Location.LocationSubscription | null = null;
let stopWebLocation: (() => void) | null = null;

// Expo Go nao tem localizacao em segundo plano: acompanha so com o app aberto,
// fazendo o mesmo que a tarefa nativa (presenca + GPS), para percorrer os fluxos.
async function iniciarAcompanhamentoExpoGo(mode: TrackingMode): Promise<boolean> {
  if (!(await Location.getForegroundPermissionsAsync()).granted || !(await Location.hasServicesEnabledAsync())) return false;
  await setTrackingMode(mode);
  expoGoWatch?.remove();
  expoGoWatch = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 0, timeInterval: 5000 },
    (location) => { void Promise.all([maintainOperationalPresence(), sendLocation(location, mode)]).catch(() => undefined); },
  );
  void sendCurrentLocation(mode).catch(() => undefined);
  return true;
}

export function showLocationSettingsAlert(message: string) {
  Alert.alert('Permissão de localização necessária', message, [
    { text: 'Agora não', style: 'cancel' },
    {
      text: 'Abrir configurações',
      onPress: () => {
        Linking.openSettings().catch((error) => {
          console.warn('[SETUP] Não foi possível abrir as configurações:', error);
        });
      },
    },
  ]);
}

export async function requestForegroundLocationPermission(): Promise<boolean> {
  if (browserNativeTest) return true;
  if (Platform.OS === 'web') {
    try { await requestWebLocationPermission(); return true; } catch { return false; }
  }
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;

  const requested = await Location.requestForegroundPermissionsAsync();
  if (requested.status === 'granted') return true;

  showLocationSettingsAlert(
    'Permita o acesso à localização enquanto o app estiver em uso para visualizar sua posição e iniciar as entregas.',
  );
  return false;
}

export async function iniciarMonitoramentoLocalizacao(mode: TrackingMode = 'online_idle'): Promise<boolean> {
  try {
    if (browserNativeTest) { await setTrackingMode(mode); reportBrowserMock('GPS e segundo plano MOCK no navegador. Nenhuma coordenada simulada enviada a loja.'); return true; }
    const token = await getSecureItem('authToken');
    const operationalToken = await getSecureItem('operationalAccessToken');

    if (!token || !operationalToken) {
      console.log('[ZIPPY] Ignorado - sem sessao operacional.');
      return false;
    }
    if (Platform.OS === 'web') {
      if (!(await readWebLocationPermission()).granted) return false;
      const rawSession = await getSecureItem('operationalSession');
      const session = rawSession ? JSON.parse(rawSession) as { sessionId: string; epoch: number } : null;
      if (!session) return false;
      await setTrackingMode(mode);
      stopWebLocation?.();
      stopWebLocation = createWebForegroundLocation({
        geolocation: navigator.geolocation,
        visible: () => document.visibilityState === 'visible',
        subscribe: subscribeWebForeground,
        permission: rememberWebLocationPermission,
        send: (position, force) => sendLocation({ ...position, coords: {
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracy: position.coords.accuracy, altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy, heading: position.coords.heading, speed: position.coords.speed,
        }, timestamp: position.timestamp }, mode, { force, expectedScopeId: `${session.sessionId}.${session.epoch}` }),
      });
      return true;
    }
    if (expoGo) return await iniciarAcompanhamentoExpoGo(mode);

    // A preparação solicita permissões. Restaurar sessão não abre diálogos do sistema.
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();
    if (!foreground.granted || !background.granted || !(await Location.hasServicesEnabledAsync())) return false;

    await setTrackingMode(mode);

    const activeRoute = mode === 'active_route';
    const rawSession = await getSecureItem('operationalSession');
    const session = rawSession ? JSON.parse(rawSession) as { heartbeatIntervalSeconds?: number } : null;
    const heartbeatMs = Math.max(5, Math.min(session?.heartbeatIntervalSeconds || 25, 60)) * 1000;

    const confirmed = await restartBackgroundLocation({
      accuracy: Location.Accuracy.Balanced,
      // Receber callbacks mesmo parado para renovar presença. O envio de GPS
      // continua filtrado por distância/tempo em trackingService.
      distanceInterval: 0,
      timeInterval: activeRoute ? 5000 : heartbeatMs,
      deferredUpdatesInterval: activeRoute ? 5000 : heartbeatMs,
      deferredUpdatesDistance: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'ZippyGo em execucao',
        notificationBody: activeRoute
          ? 'Rota ativa: compartilhando sua localizacao.'
          : 'Voce esta online: compartilhando localizacao com economia.',
        notificationColor: '#2C79FF',
      },
    });

    // Registrar o serviço confirma o início. Esperar fix de GPS + HTTP aqui
    // prendia a tela de preparação mesmo com o acompanhamento já em execução.
    if (confirmed) void sendCurrentLocation(mode).catch(() => console.warn('[GPS] Aguardando a primeira posição; o acompanhamento continua ativo.'));
    return confirmed;
  } catch (error) {
    console.error('[SETUP] Erro ao iniciar monitoramento:', error);
    return false;
  }
}

export async function pararMonitoramentoLocalizacao() {
  stopWebLocation?.(); stopWebLocation = null;
  expoGoWatch?.remove();
  expoGoWatch = null;
  if (Platform.OS === 'web') return;
  try {
    await stopBackgroundLocation();
  } catch (error) {
    console.error('[SETUP] Erro ao parar monitoramento:', error);
  }
}
