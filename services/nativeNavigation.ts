import { Platform, TurboModuleRegistry } from 'react-native';
import { expoGo } from './expoGo';

export const nativeNavigationAvailable = Platform.OS !== 'web' && !expoGo && !!TurboModuleRegistry.get('NavModule');
