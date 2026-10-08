import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { getSecureItem } from '../utils/secureStorage';
import {
  sendCurrentLocation,
  setTrackingMode,
  TrackingMode,
} from '../services/trackingService';

const LOCATION_TASK_NAME = 'background-location-task';

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
    if (Platform.OS === 'web') return false;
    const token = await getSecureItem('authToken');
    const operationalToken = await getSecureItem('operationalAccessToken');

    if (!token || !operationalToken) {
      console.log('[ZIPPY] Ignorado - sem sessao operacional.');
      return false;
    }

    // A preparação solicita permissões. Restaurar sessão não abre diálogos do sistema.
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();
    if (!foreground.granted || !background.granted || !(await Location.hasServicesEnabledAsync())) return false;

    await setTrackingMode(mode);

    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    const activeRoute = mode === 'active_route';
    const rawSession = await getSecureItem('operationalSession');
    const session = rawSession ? JSON.parse(rawSession) as { heartbeatIntervalSeconds?: number } : null;
    const heartbeatMs = Math.max(5, Math.min(session?.heartbeatIntervalSeconds || 25, 60)) * 1000;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
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

    const confirmed = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
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
  if (Platform.OS === 'web') return;
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (error) {
    console.error('[SETUP] Erro ao parar monitoramento:', error);
  }
}
