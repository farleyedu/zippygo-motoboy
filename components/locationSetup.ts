import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';

const LOCATION_TASK_NAME = 'background-location-task';

export async function iniciarMonitoramentoLocalizacao() {
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
    accuracy: Location.Accuracy.Highest, // usa o máximo disponível
    distanceInterval: 0,                 // envia sempre que possível
    timeInterval: 1000,                  // a cada 1 segundo
    deferredUpdatesInterval: 1000,       // força atualização mínima
    deferredUpdatesDistance: 1,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'ZippyGo em execução',
      notificationBody: 'Monitorando sua localização...',
      notificationColor: '#2C79FF',
    },
  });

  const confirmado = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  console.log('[ZIPPY] Está rodando a task? ', confirmado);
}
