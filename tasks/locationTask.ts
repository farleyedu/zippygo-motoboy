import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store'; // ✅ substituto compatível
import * as Linking from 'expo-linking';

const LOCATION_TASK_NAME = 'background-location-task';

const DESTINO = {
  latitude: -18.91899,
  longitude: -48.24674,
};

function calcularDistancia(coord1: any, coord2: any) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(coord1.latitude)) *
      Math.cos(toRad(coord2.latitude)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  console.log('[TASK] Rodando task de localização...');

  if (error) {
    console.error('[TASK] Erro:', error);
    return;
  }

  if (!intervalId) {
    intervalId = setInterval(async () => {
      const location = await Location.getCurrentPositionAsync({});
      console.log(`[TASK] Local atual recebido:`, location.coords);

      const distancia = calcularDistancia(location.coords, DESTINO);
      console.log(`[TASK] Verificação: distância até o destino = ${distancia.toFixed(2)} metros`);

      if (distancia <= 100) {
        console.log('[TASK] Está dentro do raio de 100m! Enviando notificação...');

        // ✅ Salva usando SecureStore
        await SecureStore.setItemAsync('chegouNoDestino', 'true');

        // Envia notificação com deep link
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Você chegou ao destino!',
            body: 'Toque para confirmar a entrega.',
            data: {
              url: Linking.createURL('confirmacao-entrega'),
            },
          },
          trigger: null,
        });

        clearInterval(intervalId!);
        intervalId = null;
      }
    }, 5000);
  }
});
