import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getTrackingMode, sendLocation } from '../services/trackingService';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error) {
      console.error('[TASK] Erro:', error);
      return;
    }

    const locations = data?.locations;
    if (!locations?.length) {
      return;
    }

    const location = locations[locations.length - 1];
    const trackingMode = await getTrackingMode();

    await sendLocation(location, trackingMode);

    // A API V2 controla as etapas da entrega. A tarefa em segundo plano
    // fica responsavel somente pelo envio da localizacao.
  },
);
