import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getTrackingMode, maintainOperationalPresence, sendLocation } from '../services/trackingService';

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
    // Cada serviço confere o contexto operacional. GPS e presença não precisam
    // esperar um ao outro; o backend valida sessão/epoch/TTL em ambos.
    await Promise.all([maintainOperationalPresence(), sendLocation(location, trackingMode)]);

    // A API V2 controla as etapas da entrega; a tarefa renova presença e envia GPS.
  },
);
