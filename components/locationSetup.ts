import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getSecureItem } from '../utils/secureStorage';
import { Alert } from 'react-native';

const LOCATION_TASK_NAME = 'background-location-task';

export async function iniciarMonitoramentoLocalizacao() {
  try {
    const emEntrega = await getSecureItem('emEntrega');
    if (emEntrega !== 'true') {
      console.log('[ZIPPY] Ignorado - não está em rota.');
      return;
    }

    console.log('[ZIPPY] Solicitando permissões...');

    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    const { status: background } = await Location.requestBackgroundPermissionsAsync();

    if (foreground !== 'granted' || background !== 'granted') {
      Alert.alert('Permissões necessárias', 'Permita acesso à localização em segundo plano.');
      return;
    }

    const jaRodando = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('[ZIPPY] Task já registrada:', jaRodando);

    if (jaRodando) {
      console.log('[SETUP] Task já está rodando.');
      return;
    }

    console.log('[SETUP] Iniciando task de localização...');

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 10,
      timeInterval: 5000,
      deferredUpdatesInterval: 5000,
      deferredUpdatesDistance: 10,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: true,
      foregroundService: {
        notificationTitle: 'ZippyGo em execução',
        notificationBody: 'Monitorando sua localização...',
        notificationColor: '#2C79FF',
      },
    });

    const confirmado = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('[ZIPPY] Está rodando a task? ', confirmado);
  } catch (error) {
    console.error('[SETUP] Erro ao iniciar monitoramento:', error);
  }
}

export async function pararMonitoramentoLocalizacao() {
  try {
    const jaRodando = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (jaRodando) {
      console.log('[SETUP] Parando task de localização...');
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('[SETUP] Task parada com sucesso.');
    }
  } catch (error) {
    console.error('[SETUP] Erro ao parar monitoramento:', error);
  }
}
