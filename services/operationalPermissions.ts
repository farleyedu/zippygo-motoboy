import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform, Linking } from 'react-native';
import { browserNativeTest, reportBrowserMock } from './browserNativeTest';
import { expoGo } from './expoGo';
import { readWebLocationPermission, requestWebLocationPermission, webLocationAvailable } from './webLocationPermission';

export type PermissionKind = 'foreground' | 'background' | 'notifications' | 'services';
export type PermissionValue = { granted: boolean; canAskAgain: boolean; supported: boolean };
export type OperationalPermissions = {
  foreground: PermissionValue; background: PermissionValue; notifications: PermissionValue;
  services: boolean; ready: boolean;
};
const unsupported: PermissionValue = { granted: false, canAskAgain: false, supported: false };
const permission = (value: { granted: boolean; canAskAgain: boolean }): PermissionValue => ({ ...value, supported: true });
// Expo Go nao oferece segundo plano: o turno segue so com o app aberto.
const expoGoBackground: PermissionValue = { granted: true, canAskAgain: false, supported: false };

export async function readOperationalPermissions(): Promise<OperationalPermissions> {
  if (browserNativeTest) {
    const allowed = { granted: true, canAskAgain: false, supported: true };
    return { foreground: { ...allowed }, background: { ...allowed }, notifications: { ...allowed }, services: true, ready: true };
  }
  const foreground = Platform.OS === 'web' ? await readWebLocationPermission() : permission(await Location.getForegroundPermissionsAsync());
  const services = Platform.OS === 'web' ? webLocationAvailable() : await Location.hasServicesEnabledAsync();
  const background = Platform.OS === 'web' ? unsupported : expoGo ? expoGoBackground : permission(await Location.getBackgroundPermissionsAsync());
  const notifications = Platform.OS === 'web' ? unsupported : permission(await Notifications.getPermissionsAsync());
  return { foreground, background, notifications, services, ready: services && foreground.granted && (Platform.OS === 'web' || background.granted) };
}

// Chamadas de solicitação ocorrem apenas nas ações explicadas pela tela de preparação.
export async function askOperationalPermission(kind: PermissionKind): Promise<void> {
  if (browserNativeTest) { reportBrowserMock('Permissao MOCK liberada no navegador, sem dialogo nativo.'); return; }
  if (kind === 'services') { await openOperationalSettings(); return; }
  if (kind === 'foreground') {
    if (Platform.OS === 'web') await requestWebLocationPermission();
    else await Location.requestForegroundPermissionsAsync();
    return;
  }
  if (Platform.OS === 'web') throw new Error('Esta permissão precisa do aplicativo instalado no aparelho.');
  if (kind === 'background') {
    if (expoGo) return;
    if (!(await Location.getForegroundPermissionsAsync()).granted) throw new Error('Permita primeiro a localização com o app aberto.');
    await Location.requestBackgroundPermissionsAsync();
    return;
  }
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', {
    name: 'ZippyGo Notificações', importance: Notifications.AndroidImportance.HIGH,
    // O som padrao do Android e selecionado ao omitir sound.
    vibrationPattern: [0, 250, 250, 250], lightColor: '#2872e3',
  });
  await Notifications.requestPermissionsAsync();
}

export async function openOperationalSettings(): Promise<void> {
  if (browserNativeTest) { reportBrowserMock('Configuracoes nativas MOCK no navegador. Permissoes liberadas para teste.'); return; }
  if (Platform.OS === 'web') throw new Error('Abra as permissões de localização nas configurações do navegador.');
  await Linking.openSettings();
}
