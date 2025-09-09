import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // Detectar ambiente baseado na variável EXPO_PUBLIC_APP_ENV
  const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
  const isDev = APP_ENV === 'dev' || APP_ENV === 'development';
  const isProd = APP_ENV === 'prod' || APP_ENV === 'production';
  
  console.log('🔧 APP_ENV:', APP_ENV);
  console.log('🔧 isDev:', isDev);
  console.log('🔧 usesCleartextTraffic:', !isProd);

  return {
    ...config,
    name: 'zippygo-motoboy',
    slug: 'zippygo-motoboy',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'zippygomotoboy',
    userInterfaceStyle: 'automatic',
    jsEngine: 'hermes',
    newArchEnabled: true,
    
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    
    ios: {
      supportsTablet: true,
      jsEngine: 'hermes'
    },
    
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      edgeToEdgeEnabled: true,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE'
      ],
      package: 'com.farleyedu.zippygomotoboy',
      jsEngine: 'hermes',
      // @ts-ignore - usesCleartextTraffic is a valid Android config option but not typed in Expo config
      usesCleartextTraffic: !isProd,
      
      config: {
        googleMaps: {
          apiKey: 'AIzaSyBGZgGgmNMq6Vew5M6NMS_6DRt5QiGc30U'
        }
      }
    },
    
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png'
    },
    
    plugins: [
      'expo-router',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Permitir que o app use sua localização para rastrear entregas.',
          locationWhenInUsePermission: 'Permitir que o app use sua localização enquanto estiver em uso.'
        }
      ],
      'expo-secure-store'
    ],
    
    experiments: {
      typedRoutes: true
    },
    
    extra: {
      router: {},
      eas: {
        projectId: 'fcf691e3-47a6-446f-9e6a-5c2bcf7ee6c7'
      },
      // Expor variáveis de ambiente para o app
      APP_ENV,
      API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://zippy-api.onrender.com'
    }
  };
};