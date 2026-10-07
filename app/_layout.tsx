import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/components/useColorScheme';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { ZippyThemeProvider } from '@/src/ui/theme';

import { testApiHealth } from '../services/apiService';
import '../components/locationTask';

// 🔍 DEBUG: Network debug removido - interceptação limpa ativada

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Manrope: require('../assets/fonts/Manrope-Variable.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      
      // 🏥 Testar conectividade da API após carregar o app
      setTimeout(() => {
        testApiHealth();
      }, 1000);
    }
  }, [loaded]);

  useEffect(() => {
    // 🔔 Configura handler para notificações recebidas
    if (Platform.OS === 'web') return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const configurarNotificacoes = async () => {
      // 1. Solicita permissão de notificação (obrigatório no Android 13+)
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[ZIPPY] Notificações não permitidas');
      }

      // 2. Cria canal com antecedência
      await Notifications.setNotificationChannelAsync('default', {
        name: 'ZippyGo Notificações',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2C79FF',
      });
    };

    configurarNotificacoes();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string;
      if (url) {
        Linking.openURL(url);
      }
    });
    return () => sub.remove();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ZippyThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
      </GestureHandlerRootView>
      </ZippyThemeProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="pedido/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="conversas" options={{ headerShown: false }} />
        {/* Telas de autenticação */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="selecionarRestaurante" options={{ headerShown: false }} />
        <Stack.Screen name="solicitarRestaurante" options={{ headerShown: false }} />
        <Stack.Screen name="solicitacoesVinculo" options={{ headerShown: false }} />
        <Stack.Screen name="convite/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        
        {/* ✅ Oculta o topo da tela confirmacaoEntrega */}
        <Stack.Screen name="confirmacaoEntrega" options={{ headerShown: false }} />
        
        {/* Tela de verificação de código */}
        <Stack.Screen name="VerificationScreen" options={{ headerShown: false }} />
        
        {/* Tela de divisão de pagamento */}
        <Stack.Screen name="dividirPagamento" options={{ headerShown: false }} />

        {/* Nova tela de exemplo da sacola (como modal transparente sobre o mapa) */}
        <Stack.Screen
          name="ExemploSacolaScreen"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
            statusBarTranslucent: true,
          }}
        />
        
        {/* Aqui você pode adicionar outras rotas normalmente */}
        {/* <Stack.Screen name="outraTela" options={{ headerShown: true }} /> */}
      </Stack>
    </ThemeProvider>
  );
}
