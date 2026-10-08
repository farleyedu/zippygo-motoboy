import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect,useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/components/useColorScheme';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { ZippyThemeProvider, useZippyTheme } from '@/src/ui/theme';
import { OperationalSessionProvider, useOperationalSession } from '@/src/contexts/OperationalSessionContext';
import { DeliveryCompletionProvider } from '@/src/contexts/DeliveryCompletionContext';
import { useDeliveryCompletion } from '@/src/contexts/DeliveryCompletionContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { getSecureItem,setSecureItem } from '@/utils/secureStorage';
import { ChatNotices } from '@/src/chat/ChatNotices';

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
    ManropeExtraBold: require('../assets/fonts/Manrope-ExtraBold.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
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
      <OperationalSessionProvider>
      <DeliveryCompletionProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
        <ChatNotices />
      </GestureHandlerRootView>
      </DeliveryCompletionProvider>
      </OperationalSessionProvider>
      </ZippyThemeProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const turn = useOperationalSession(), auth = useAuth(), router = useRouter(), segments = useSegments();
  const preferences = useZippyTheme();
  const current = String(segments[0] || 'index');
  const completion = useDeliveryCompletion();
  const notified=useRef(new Set<string>());
  useEffect(()=>{
    const offer=turn.queue?.offer,owner=String(auth.user?.id||'');
    if(Platform.OS==='web' || !offer?.offerId || !owner || turn.queue?.paused || (offer.expiresAtUtc && Date.parse(offer.expiresAtUtc)<=Date.now())) return;
    const offerId=offer.offerId;
    const key=`zippygo.offer-notice.${owner}`,identity=`${turn.session?.sessionId}:${offerId}`;
    if(notified.current.has(identity))return;
    notified.current.add(identity);let alive=true;
    (async()=>{
      if(await getSecureItem(key)===offerId || !alive)return;
      const permission=await Notifications.getPermissionsAsync();if(!alive||!permission.granted)return;
      if(preferences.vibration)Vibration.vibrate([0,120,80,120]);
      await Notifications.scheduleNotificationAsync({identifier:offerId,content:{title:'Uma nova rota pra você',body:`${offer.stops.length} pedidos · confira a oferta.`,sound:preferences.sound?'default':undefined,data:{url:Linking.createURL('/oferta',{scheme:'zippygomotoboy'})}},trigger:null});
      if(alive)await setSecureItem(key,offerId);
    })().catch(()=>{/* A oferta continua disponível no radar mesmo sem notificação local. */});
    return()=>{alive=false;};
  },[turn.queue?.offer?.offerId,turn.queue?.paused,turn.session?.sessionId,auth.user?.id,preferences.sound,preferences.vibration]);
  useEffect(() => {
    const pending = ['sending','pending'].includes(completion.draft?.phase || '');
    const execution = ['confirmacaoEntrega','VerificationScreen','cobrarEntrega','dividirPagamento','comprovanteEntrega','chegadaEntrega','pedido','oferta','rota','retirada','transferencia','recusarPedido','retornoLoja','turno'];
    if (pending && execution.includes(current)) router.replace('/entregaPendente');
  }, [current,completion.draft?.phase,router]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.setNotificationHandler({ handleNotification: async notification => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldSetBadge: false, shouldPlaySound: !notification.request.content.data?.chatMessageId && preferences.sound }) });
  }, [preferences.sound]);
  useEffect(() => {
    if (!auth.isLoading && !auth.user && !auth.restoreError && current !== '(auth)' && current !== 'index') router.replace('/(auth)/login');
  }, [auth.isLoading, auth.user, auth.restoreError, current, router]);
  useEffect(() => {
    if (auth.isLoading || !auth.user || !auth.estabelecimentoAtual) return;
    if (turn.phase === 'expired' && !['(auth)', 'sessaoEncerrada', 'permissoes', 'permissaoNegada', 'entregaPendente', 'entregaConcluida'].includes(current)) router.replace('/sessaoEncerrada');
    else if (turn.session && turn.phase === 'permission-required' && current === 'index') router.replace('/permissoes');
  }, [turn.phase, turn.session?.sessionId, auth.isLoading, auth.user?.id, auth.estabelecimentoAtual, current, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="permissoes" options={{ headerShown: false }} />
        <Stack.Screen name="permissaoNegada" options={{ headerShown: false }} />
        <Stack.Screen name="sessaoEncerrada" options={{ headerShown: false }} />
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
