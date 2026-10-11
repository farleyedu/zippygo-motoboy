import { confirmOfferNotice, offerNoticeShown, releaseOfferNotice, reserveOfferNotice } from '../src/delivery/offerNotices';
import { isCurrentOfferNotice, offerNoticeBehavior, revealOfferNotice } from '../src/delivery/offerAttention';
import { useOfferNoticeCleanup } from '../src/delivery/useOfferNoticeCleanup';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, useRootNavigationState, useGlobalSearchParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect,useRef } from 'react';
import { AppState, Platform, Vibration, View } from 'react-native';
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
import { ChatNotices } from '@/src/chat/ChatNotices';
import { BrowserTestBanner } from '@/src/ui/BrowserTestBanner';
import { WebViewport } from '@/src/ui/WebViewport';
import { NativeNavigationProvider } from '@/src/delivery/NativeNavigationProvider';
import { OfferPrompt } from '@/src/ui/OfferPrompt';
import { configureChatChannels } from '@/src/chat/push';
import { operationalDestination } from '@/src/delivery/operationalDestination';

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


  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ZippyThemeProvider>
      <OperationalSessionProvider>
      <DeliveryCompletionProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BrowserTestBanner />
        <WebViewport />
        <NativeNavigationProvider><View style={{ flex: 1 }}><RootLayoutNav /><ChatNotices /><OfferPrompt /></View></NativeNavigationProvider>
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
  const navigation = useRootNavigationState();
  const consumedResponse = useRef('');
  const notificationClaims = useRef(new Map<string, { sessionId: string; offerId: string }>());
  const hiddenOffer = useRef(turn.deferredOfferId); hiddenOffer.current = turn.deferredOfferId;
  const resumeHandled = useRef('');
  const routeParams = useGlobalSearchParams<{ intent?: string }>();
  const owner = `${auth.user?.id}:${auth.estabelecimentoAtual && ('id' in auth.estabelecimentoAtual ? auth.estabelecimentoAtual.id : auth.estabelecimentoAtual.estabelecimentoId)}`;
  useOfferNoticeCleanup();
  useEffect(() => {
    if (!navigation?.key || auth.isLoading || completion.loading || !auth.user || !auth.estabelecimentoAtual || turn.busy || !turn.permissions) return;
    const gateway = ['index', 'permissoes', 'sessaoEncerrada'].includes(current);
    if (current === 'permissoes' && routeParams.intent !== 'start' && routeParams.intent !== 'resume') return;
    const initial = resumeHandled.current !== owner;
    if (turn.phase === 'offline') { resumeHandled.current = owner; return; }
    if (!turn.online || !turn.queue) return;
    resumeHandled.current = owner;
    if (!gateway || (!initial && current === 'index') || ['pending', 'sending'].includes(completion.draft?.phase || '')) return;
    if (turn.phase === 'permission-required' || Platform.OS !== 'web' && !turn.permissions.ready) return;
    const q = turn.queue;
    if (q.current || q.next.length || q.routeState === 'returning' || current !== 'index') router.replace(operationalDestination(q, Platform.OS));
  }, [navigation?.key, owner, auth.isLoading, completion.loading, turn.busy, turn.phase, turn.online, turn.queue, turn.permissions, current, completion.draft?.phase, routeParams.intent]);
  useEffect(() => {
    if (Platform.OS === 'web' || !navigation?.key || auth.isLoading || !turn.session) return;
    let alive = true; const sessionId = turn.session.sessionId;
    const open = async (response: Notifications.NotificationResponse | null) => {
      if (!response || !alive) return;
      const request = response.notification.request, data = request.content.data;
      if (!data) return;
      if (consumedResponse.current === request.identifier || data.recipientSessionId !== sessionId) return;
      if (typeof data.offerId === 'string') {
        const result = await revealOfferNotice(data, turn.store.getSnapshot, turn.store.refreshQueue, () => { if (alive) turn.showOffer(); });
        if (!alive || result === 'retry') return;
      } else if (typeof data.chatMessageId === 'string' && ['group','store','private'].includes(String(data.channel))) {
        if (!turn.store.getSnapshot().queue) await turn.store.refreshQueue();
        if (!alive || turn.store.getSnapshot().session?.sessionId !== sessionId) return;
        const parts = String(data.threadKey || '').split(':'), own = turn.store.getSnapshot().queue?.motoboyId;
        const participants = parts.slice(1).map(Number);
        if (data.channel === 'private' && (!own || parts[0] !== 'private' || participants.length !== 2 || !participants.includes(own) || participants.some(id => !Number.isSafeInteger(id) || id <= 0))) return;
        const target = data.channel === 'private' ? participants.find(id => id !== own) : undefined;
        if (data.channel === 'private' && !target) return;
        router.navigate({ pathname: '/conversas', params: { channel: String(data.channel), message: data.chatMessageId, ...(target ? { target: String(target) } : {}) } });
      }
      consumedResponse.current = request.identifier;
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last?.notification.request.identifier === request.identifier) await Notifications.clearLastNotificationResponseAsync();
    };
    const sub = Notifications.addNotificationResponseReceivedListener(response => { void open(response).catch(() => {}); });
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void turn.store.whenIdle().then(() => Notifications.getLastNotificationResponseAsync()).then(open).catch(() => {}); });
    return () => { alive = false; sub.remove(); foreground.remove(); };
  }, [navigation?.key, auth.isLoading, turn.session?.sessionId, router]);

  useEffect(() => {
    const offer = turn.queue?.offer, sessionId = turn.session?.sessionId;
    if (Platform.OS === 'web' || !sessionId || !offer?.offerId || Date.parse(offer.expiresAtUtc) <= Date.now()) return;
    const offerId = offer.offerId; let alive = true;
    const timer = setTimeout(() => { void (async () => {
      if (!alive || await offerNoticeShown(sessionId, offerId)) return;
      await configureChatChannels();
      const permission = await Notifications.getPermissionsAsync(); if (!alive || !permission.granted) return;
      const presented = await Notifications.getPresentedNotificationsAsync();
      if (presented.some(n => n.request.content.data?.offerId === offerId && n.request.content.data?.recipientSessionId === sessionId)) { confirmOfferNotice(sessionId, offerId); return; }
      if (!alive) return;
      const snapshot = turn.store.getSnapshot();
      if (snapshot.session?.sessionId !== sessionId || snapshot.queue?.offer?.offerId !== offerId || !isCurrentOfferNotice({ offerId, recipientSessionId: sessionId, expiresAtUtc: snapshot.queue.offer.expiresAtUtc }, sessionId)) return;
      await Notifications.scheduleNotificationAsync({ identifier: offerId, content: {
        title: 'Tem pedido novo pra você', body: offer.stops.length + ' pedidos · confira a oferta.', sound: preferences.sound ? 'default' : undefined,
        data: { offerId, recipientSessionId: sessionId, expiresAtUtc: snapshot.queue.offer.expiresAtUtc, url: Linking.createURL('/oferta', { scheme: 'zippygomotoboy' }) },
      }, trigger: Platform.OS === 'android' ? { channelId: 'delivery-offers-' + (preferences.sound ? 'sound' : 'silent') + '-' + (preferences.vibration ? 'vibrate' : 'quiet') + '-v1' } : null });
    })().catch(() => {}); }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [turn.queue?.offer?.offerId, turn.session?.sessionId, preferences.sound, preferences.vibration]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.setNotificationHandler({ handleNotification: async notification => {
      const data = notification.request.content.data;
      let allowed = !(data?.chatMessageId || data?.offerId) || data.recipientSessionId === turn.session?.sessionId;
      if (typeof data?.offerId === 'string') {
        const sessionId = turn.store.getSnapshot().session?.sessionId;
        allowed = isCurrentOfferNotice(data, sessionId) && reserveOfferNotice(sessionId!, data.offerId);
        if (allowed) notificationClaims.current.set(notification.request.identifier, { sessionId: sessionId!, offerId: data.offerId });
        const hidden = AppState.currentState === 'active' && hiddenOffer.current === data.offerId;
        const behavior = offerNoticeBehavior(allowed, hidden, preferences.sound);
        if (Platform.OS === 'ios' && behavior.shouldShowBanner && preferences.vibration) Vibration.vibrate([0,120,80,120]);
        return behavior;
      }
      return { shouldShowAlert: allowed, shouldShowBanner: allowed, shouldShowList: allowed, shouldSetBadge: false, shouldPlaySound: allowed && !data?.chatMessageId && preferences.sound };
    }, handleSuccess: id => {
      const claim = notificationClaims.current.get(id);
      if (claim) { notificationClaims.current.delete(id); confirmOfferNotice(claim.sessionId, claim.offerId); }
    }, handleError: id => {
      const claim = notificationClaims.current.get(id);
      if (claim) { notificationClaims.current.delete(id); releaseOfferNotice(claim.sessionId, claim.offerId); }
    } });
  }, [preferences.sound, preferences.vibration, turn.session?.sessionId, turn.store]);
  useEffect(() => {
    if (navigation?.key && !auth.isLoading && !auth.user && !auth.restoreError && current !== '(auth)' && current !== 'index') router.replace('/(auth)/login');
  }, [navigation?.key,auth.isLoading, auth.user, auth.restoreError, current, router]);
  useEffect(() => {
    if (!navigation?.key || auth.isLoading || !auth.user || !auth.estabelecimentoAtual) return;
    if (turn.phase === 'expired' && !['(auth)', 'sessaoEncerrada', 'permissoes', 'permissaoNegada', 'entregaPendente', 'entregaConcluida', 'ganhos', 'historico', 'historicoRotas', 'rotaHistorico', 'reciboHistorico', 'acerto', 'resumoTurno', 'suporte', 'seguranca', 'ajudaOperacional'].includes(current)) router.replace('/sessaoEncerrada');
    else if (turn.session && turn.phase === 'permission-required' && !turn.busy && turn.permissions && !turn.permissions.ready && current === 'index') router.replace({ pathname: '/permissoes', params: { intent: 'resume' } });
  }, [navigation?.key,turn.phase, turn.session?.sessionId, auth.isLoading, auth.user?.id, auth.estabelecimentoAtual, current, router]);

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
