import { useColorScheme as useNativeColorScheme } from 'react-native';

// O React Native 0.86 tambem devolve 'unspecified'; o app so trata claro e escuro.
export function useColorScheme(): 'light' | 'dark' {
  return useNativeColorScheme() === 'dark' ? 'dark' : 'light';
}
