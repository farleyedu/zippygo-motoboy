import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiClient } from '../../services/apiService';
import { unwrap } from '../../services/mobileApi';
import { getSecureItem } from '../../utils/secureStorage';

export async function registerChatPush(
  sessionId: string,
  settings: {
    sound: boolean;
    vibration: boolean;
    muted: boolean;
    mentionAlerts: boolean;
  },
) {
  if (
    Platform.OS === 'web' ||
    !(await Notifications.getPermissionsAsync()).granted
  )
    return;
  if (Platform.OS === 'android')
    for (const mentioned of [false, true])
      for (const sound of [false, true])
        for (const vibration of [false, true])
          await Notifications.setNotificationChannelAsync(
            `chat-${mentioned ? 'mentions' : 'messages'}-${sound ? 'sound' : 'silent'}-${vibration ? 'vibrate' : 'quiet'}-v1`,
            {
              name: mentioned ? 'Mencoes a voce' : 'Mensagens da equipe',
              importance: mentioned
                ? Notifications.AndroidImportance.HIGH
                : Notifications.AndroidImportance.DEFAULT,
              sound: sound
                ? mentioned
                  ? 'chat-mention.wav'
                  : 'chat-message.wav'
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
