import AsyncStorage from '@react-native-async-storage/async-storage';

const promptKey = 'zippygo.notifications.permission-requested.v1';
let requested = false;

export async function notificationPermissionWasRequested(): Promise<boolean> {
  if (requested) return true;
  try {
    requested = (await AsyncStorage.getItem(promptKey)) === '1';
    return requested;
  } catch {
    // Sem histórico confiável, o pedido continua disponível pela ação explícita.
    return true;
  }
}

export async function markNotificationPermissionRequested(): Promise<void> {
  requested = true;
  try { await AsyncStorage.setItem(promptKey, '1'); } catch { /* A ação explícita não depende do armazenamento. */ }
}
