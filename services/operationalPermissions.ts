import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform, Linking } from 'react-native';

export type PermissionKind = 'foreground' | 'background' | 'notifications' | 'services';
export type PermissionValue = { granted: boolean; canAskAgain: boolean; supported: boolean };
export type OperationalPermissions = {
  foreground: PermissionValue; background: PermissionValue; notifications: PermissionValue;
  services: boolean; ready: boolean;
};
const unsupported: PermissionValue = { granted: false, canAskAgain: false, supported: false };
const permission = (value: { granted: boolean; canAskAgain: boolean }): PermissionValue => ({ ...value, supported: true });

export async function readOperationalPermissions(): Promise<OperationalPermissions> {
  const foreground = permission(await Location.getForegroundPermissionsAsync());
  const services = await Location.hasServicesEnabledAsync();
  const background = Platform.OS === 'web' ? unsupported : permission(await Location.getBackgroundPermissionsAsync());
  const notifications = Platform.OS === 'web' ? unsupported : permission(await Notifications.getPermissionsAsync());
  return { foreground, background, notifications, services, ready: services && foreground.granted && background.granted };
}

// Chamadas de solicitação ocorrem apenas nas ações explicadas pela tela de preparação.
export async function askOperationalPermission(kind: PermissionKind): Promise<void> {
  if (kind === 'services') { await openOperationalSettings(); return; }
  if (kind === 'foreground') { await Location.requestForegroundPermissionsAsync(); return; }
  if (Platform.OS === 'web') throw new Error('Esta permissão precisa do aplicativo instalado no aparelho.');
  if (kind === 'background') {
    if (!(await Location.getForegroundPermissionsAsync()).granted) throw new Error('Permita primeiro a localização com o app aberto.');
    await Location.requestBackgroundPermissionsAsync();
    return;
  }
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', {
    name: 'ZippyGo Notificações', importance: Notifications.AndroidImportance.HIGH,
    sound: 'default', vibrationPattern: [0, 250, 250, 250], lightColor: '#2872e3',
  });
  await Notifications.requestPermissionsAsync();
}

export async function openOperationalSettings(): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Abra as permissões de localização nas configurações do navegador.');
  await Linking.openSettings();
}
