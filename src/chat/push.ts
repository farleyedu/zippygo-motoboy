import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiClient } from '../../services/apiService';
import { unwrap } from '../../services/mobileApi';
import { getSecureItem } from '../../utils/secureStorage';
import { browserNativeTest, reportBrowserMock } from '../../services/browserNativeTest';
import { expoGo } from '../../services/expoGo';

type NotificationAccess = 'granted' | 'denied' | 'blocked' | 'unsupported';
let permissionFlight: Promise<NotificationAccess> | null = null;
let automaticPrompted = false;

async function configureChatChannels() {
  if (Platform.OS === 'android')
    for (const sound of [false, true]) for (const vibration of [false, true])
      await Notifications.setNotificationChannelAsync('delivery-offers-' + (sound ? 'sound' : 'silent') + '-' + (vibration ? 'vibrate' : 'quiet') + '-v1', {
        name: 'Novas ofertas de entrega', importance: Notifications.AndroidImportance.HIGH,
        sound: sound ? 'default' : null, enableVibrate: vibration,
        vibrationPattern: vibration ? [0, 120, 80, 120] : undefined, lightColor: '#2872e3', bypassDnd: false,
      });
  if (Platform.OS === 'android')
    for (const mentioned of [false, true])
      for (const sound of [false, true])
        for (const vibration of [false, true])
          await Notifications.setNotificationChannelAsync(
            `chat-${mentioned ? 'mentions' : 'messages'}-${sound ? 'sound' : 'silent'}-${vibration ? 'vibrate' : 'quiet'}-v2`,
            {
              name: mentioned ? 'Mencoes a voce' : 'Mensagens da equipe',
              importance: mentioned
                ? Notifications.AndroidImportance.HIGH
                : Notifications.AndroidImportance.DEFAULT,
              sound: sound
                ? mentioned
                  ? 'chat_mention.wav'
                  : 'chat_message.wav'
                : null,
              enableVibrate: vibration,
              vibrationPattern: vibration
                ? mentioned
                  ? [0, 130, 90, 130, 90, 220]
                  : [0, 80]
                : undefined,
              bypassDnd: false,
              lightColor: mentioned ? '#e5ab62' : '#2872e3',
            },
          );
}

export async function ensureChatNotificationPermission(
  explicit = false,
): Promise<NotificationAccess> {
  if (browserNativeTest) { if (explicit) reportBrowserMock('Notificacoes MOCK liberadas no navegador. Nenhuma permissao ou token de push real.'); return 'granted'; }
  if (Platform.OS === 'web') return 'unsupported';
  if (permissionFlight) return permissionFlight;
  permissionFlight = (async () => {
    // Android 13 precisa de um canal antes da solicitacao/token.
    await configureChatChannels();
    let permission = await Notifications.getPermissionsAsync();
    if (
      !permission.granted &&
      permission.canAskAgain &&
      (explicit || (permission.status === 'undetermined' && !automaticPrompted))
    ) {
      automaticPrompted = true;
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    return permission.granted
      ? 'granted'
      : permission.canAskAgain
        ? 'denied'
        : 'blocked';
  })();
  try {
    return await permissionFlight;
  } finally {
    permissionFlight = null;
  }
}

export async function registerChatPush(
  sessionId: string,
  settings: {
    sound: boolean;
    vibration: boolean;
    muted: boolean;
    mentionAlerts: boolean;
  },
) {
  // Expo Go nao registra push remoto; avisos locais continuam funcionando.
  if (Platform.OS === 'web' || expoGo) return;
  if ((await ensureChatNotificationPermission()) !== 'granted') return;
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'fcf691e3-47a6-446f-9e6a-5c2bcf7ee6c7',
  });
  const [raw, access] = await Promise.all([
    getSecureItem('operationalSession'),
    getSecureItem('operationalAccessToken'),
  ]);
  if (!raw || JSON.parse(raw).sessionId !== sessionId || !access) return;
  unwrap(
    await apiClient.put(
      '/v2/motoboys/me/session/chat/push',
      { token: token.data, ...settings },
      { headers: { Authorization: `Bearer ${access}` } },
    ),
  );
}
