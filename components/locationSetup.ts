import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { getSecureItem } from '../utils/secureStorage';
import {
  sendCurrentLocation,
  setTrackingMode,
  TrackingMode,
} from '../services/trackingService';

const LOCATION_TASK_NAME = 'background-location-task';

export async function iniciarMonitoramentoLocalizacao(mode: TrackingMode = 'online_idle'): Promise<boolean> {
  try {
    const token = await getSecureItem('authToken');
    const operationalToken = await getSecureItem('operationalAccessToken');

    if (!token || !operationalToken) {
      console.log('[ZIPPY] Ignorado - sem sessao operacional.');
      return false;
    }

    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    const { status: background } = await Location.requestBackgroundPermissionsAsync();

    if (foreground !== 'granted' || background !== 'granted') {
      Alert.alert('Permissoes necessarias', 'Permita acesso a localizacao em segundo plano.');
      return false;
    }

    await setTrackingMode(mode);

    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    const activeRoute = mode === 'active_route';

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: activeRoute ? 10 : 50,
      timeInterval: activeRoute ? 5000 : 60000,
      deferredUpdatesInterval: activeRoute ? 5000 : 60000,
      deferredUpdatesDistance: activeRoute ? 10 : 50,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: true,
      foregroundService: {
        notificationTitle: 'ZippyGo em execucao',
        notificationBody: activeRoute
          ? 'Rota ativa: compartilhando sua localizacao.'
          : 'Voce esta online: compartilhando localizacao com economia.',
        notificationColor: '#2C79FF',
      },
    });

    const confirmed = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    await sendCurrentLocation(mode);
    return confirmed;
  } catch (error) {
    console.error('[SETUP] Erro ao iniciar monitoramento:', error);
    return false;
  }
}

export async function pararMonitoramentoLocalizacao() {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (error) {
    console.error('[SETUP] Erro ao parar monitoramento:', error);
  }
}
