import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';
let lifecycle: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = lifecycle.then(work, work);
  lifecycle = next.catch(() => undefined);
  return next;
}

async function stopRegisteredTask(): Promise<void> {
  if (!(await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))) return;
  try {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch (error) {
    // Another JS runtime/native cleanup can remove the task after our check.
    const message = error instanceof Error ? error.message : String(error);
    const missing = message.includes(BACKGROUND_LOCATION_TASK) &&
      (message.includes('TaskNotFoundException') || /Task ['"]background-location-task['"] not found/.test(message));
    if (!missing || await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) throw error;
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[GPS] Tarefa já removida; encerramento concluído.');
  }
}

export function stopBackgroundLocation(): Promise<void> {
  return serialize(stopRegisteredTask);
}

export function restartBackgroundLocation(options: Location.LocationTaskOptions): Promise<boolean> {
  return serialize(async () => {
    await stopRegisteredTask();
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, options);
    return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  });
}
