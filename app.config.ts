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

    ios: {
      supportsTablet: true,
      infoPlist: {
        UIBackgroundModes: ['location']
      }
    },
    
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#1854cd'
      },
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'RECORD_AUDIO'
      ],
      package: 'com.farleyedu.zippygomotoboy',

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
      './plugins/withNativeNavigation',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Permitir que o app use sua localização para rastrear entregas.',
          locationWhenInUsePermission: 'Permitir que o app use sua localização enquanto estiver em uso.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true
        }
      ],
      'expo-secure-store',
      'expo-asset',
      ['expo-splash-screen', { image: './assets/images/splash-icon.png', imageWidth: 168, resizeMode: 'contain', backgroundColor: '#10192b' }],
      // HTTP sem TLS so fora de producao (Metro e API local).
      ['expo-build-properties', { android: { usesCleartextTraffic: !isProd }, ios: { deploymentTarget: '16.4' } }],
      ['expo-image-picker', { photosPermission: 'Permitir selecionar fotos para comprovantes e mensagens.', cameraPermission: 'Permitir fotografar o comprovante e a entrega.' }],
      ['expo-audio', { microphonePermission: 'Permitir gravar mensagens de audio para sua equipe e clientes.' }],
      ['expo-notifications', { sounds: ['./assets/sounds/chat_message.wav', './assets/sounds/chat_mention.wav'] }]
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
