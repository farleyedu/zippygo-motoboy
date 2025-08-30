import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getSecureItem, setSecureItem } from '../utils/secureStorage';
import * as Linking from 'expo-linking';
import { AppState } from 'react-native';

const LOCATION_TASK_NAME = 'background-location-task';

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

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  console.log('[TASK] Rodando task de localização...');

  if (error) {
    console.error('[TASK] Erro:', error);
    return;
  }

  const locations = data?.locations;
  if (!locations?.length) {
    console.log('[TASK] Nenhuma localização recebida.');
    return;
  }

  const location = locations[0];
  const emEntrega = await getSecureItem('emEntrega');
if (emEntrega !== 'true') {
  console.log('[TASK] Ignorado pois não está em rota.');
  return;
}

  console.log('[TASK] Local atual recebido:', location.coords);

  const rawDestinos = await getSecureItem('destinos');
  const rawPedidos = await getSecureItem('pedidosCompletos');
  const indiceAtual = parseInt(await getSecureItem('indiceAtual') || '0', 10);

  if (!rawDestinos || !rawPedidos) {
    console.warn('[TASK] Dados necessários ainda não foram carregados. Ignorando verificação de destino.');
    return;
  }

  const destinos = JSON.parse(rawDestinos);
  const destinoAtual = destinos[indiceAtual];

  if (!destinoAtual) {
    console.log('[TASK] Nenhum destino ativo no índice atual.');
    return;
  }

  const distancia = calcularDistancia(location.coords, destinoAtual);
  console.log(`[TASK] Verificação: distância até destino[${indiceAtual}] = ${distancia.toFixed(2)} metros`);

  if (distancia <= 100) {
    console.log('[TASK] Dentro do raio!');

    const destinosNotificadosRaw = await getSecureItem('destinosNotificados');
    const destinosNotificados = destinosNotificadosRaw ? JSON.parse(destinosNotificadosRaw) : [];

    if (destinosNotificados.includes(indiceAtual)) {
      console.log(`[TASK] Destino ${indiceAtual} já foi notificado. Ignorando.`);
      return;
    }

    destinosNotificados.push(indiceAtual);
    await setSecureItem('destinosNotificados', JSON.stringify(destinosNotificados));
    await setSecureItem('chegouNoDestino', 'true');

    const appState = AppState.currentState;
    const isForeground = appState === 'active';

    if (isForeground) {
      console.log('[TASK] App em foreground - navegando direto.');
      await setSecureItem('abrirConfirmacaoImediata', 'true');
    } else {
      console.log('[TASK] App em background - enviando notificação.');
    
      try {
        // Garante que o canal exista dentro do contexto da task
        await Notifications.setNotificationChannelAsync('default', {
          name: 'ZippyGo Notificações',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
    
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Você chegou ao destino!',
            body: 'Toque para confirmar a entrega.',
            data: {
              url: Linking.createURL('confirmacaoEntrega'),
            },
            sound: 'default',
            vibrate: [0, 250, 250, 250],
            color: '#2C79FF',
          },
          trigger: null,
        });
      } catch (err) {
        console.error('[TASK] Erro ao enviar notificação:', err);
      }
    }
    
  }
});
