import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Platform,
  Pressable,
  Text,
  Vibration,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import { AtSign, MessageCircle, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChatMessage,
  listChatNotifications,
} from '../../services/communicationApi';
import { subscribeChatEvents } from '../../services/chatEvents';
import { useAuth } from '../contexts/AuthContext';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useZippyTheme } from '../ui/theme';
import { priorityNotice } from './noticeRules';
import { registerChatPush } from './push';
import * as Notifications from 'expo-notifications';

export function ChatNotices() {
  const [ready, setReady] = useState(Platform.OS !== 'web');
  useEffect(() => setReady(true), []);
  return ready ? <MountedChatNotices /> : null;
}

function MountedChatNotices() {
  const auth = useAuth(),
    turn = useOperationalSession(),
    theme = useZippyTheme(),
    router = useRouter(),
    insets = useSafeAreaInsets();
  const tenant =
      auth.estabelecimentoAtual &&
      ('id' in auth.estabelecimentoAtual
        ? auth.estabelecimentoAtual.id
        : auth.estabelecimentoAtual.estabelecimentoId),
    owner = auth.user && tenant ? `${auth.user.id}:${tenant}` : null;
  const [notice, setNotice] = useState<ChatMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const regular = useAudioPlayer(
      require('../../assets/sounds/chat_message.wav'),
    ),
    mention = useAudioPlayer(require('../../assets/sounds/chat_mention.wav'));
  const latest = useRef({ theme });
  latest.current = { theme };
  useEffect(() => {
    if (!owner || !turn.session) return;
    let alive = true;
    const register = async () => {
      const raw = await AsyncStorage.getItem(`zippygo.chat.settings:${owner}`);
      const settings = raw
        ? (JSON.parse(raw) as { muted: boolean; mentionAlerts: boolean })
        : { muted: false, mentionAlerts: true };
      if (alive)
        await registerChatPush(turn.session!.sessionId, {
          sound: theme.sound,
          vibration: theme.vibration,
          ...settings,
        });
    };
    void register().catch(() => undefined);
    const timer = setInterval(
      () => void register().catch(() => undefined),
      15000,
    );
    const response =
      Platform.OS === 'web'
        ? null
        : Notifications.addNotificationResponseReceivedListener((event) => {
            const data = event.notification.request.content.data;
            if (
              !alive ||
              typeof data.chatMessageId !== 'string' ||
              typeof data.threadKey !== 'string' ||
              data.recipientSessionId !== turn.session?.sessionId
            )
              return;
            const parts = data.threadKey.split(':'),
              id =
                parts[1] === String(turn.queue?.motoboyId)
                  ? parts[2]
                  : parts[1];
            router.push({
              pathname: '/conversas',
              params: {
                channel: String(data.channel),
                messageId: data.chatMessageId,
                ...(data.channel === 'private' ? { target: id } : {}),
              },
            });
          });
    return () => {
      alive = false;
      clearInterval(timer);
      response?.remove();
    };
  }, [
    owner,
    turn.session?.sessionId,
    theme.sound,
    theme.vibration,
    turn.queue?.motoboyId,
    router,
  ]);
  useEffect(() => {
    if (!owner || !turn.session) return;
    let alive = true,
      inFlight = false,
      watermark: number | undefined;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const key = `zippygo.chat.notice.watermark:${owner}`;
    const load = async () => {
      if (!alive || inFlight || AppState.currentState !== 'active') return;
      inFlight = true;
      try {
        const [messages, rawSettings] = await Promise.all([
          listChatNotifications(),
          AsyncStorage.getItem(`zippygo.chat.settings:${owner}`),
        ]);
        if (!alive) return;
        if (watermark === undefined) {
          const stored = await AsyncStorage.getItem(key);
          if (!alive) return;
          watermark =
            stored && Number.isFinite(Number(stored))
              ? Number(stored)
              : Math.max(0, ...messages.map((m) => m.sequence));
        }
        const settings = rawSettings
          ? (JSON.parse(rawSettings) as {
              muted: boolean;
              mentionAlerts: boolean;
            })
          : { muted: false, mentionAlerts: true };
        const next = priorityNotice(messages, watermark, settings);
        watermark = next.watermark;
        await AsyncStorage.setItem(key, String(watermark));
        if (!alive || !next.notice) return;
        const prefs = latest.current.theme,
          message = next.notice;
        setNotice(message);
        AccessibilityInfo.announceForAccessibility(
          `${message.senderName}${message.mentioned ? ' mencionou voce' : ''}: ${message.body || 'anexo'}`,
        );
        if (next.audible) {
          if (prefs.vibration && Platform.OS !== 'web')
            Vibration.vibrate(
              message.mentioned ? [0, 130, 90, 130, 90, 220] : 80,
            );
          if (prefs.sound) {
            const player = message.mentioned ? mention : regular;
            try {
              await player.seekTo(0);
              player.play();
            } catch {
              /* O aviso visual nao depende do audio. */
            }
          }
        }
        if (hide) clearTimeout(hide);
        hide = setTimeout(
          () => {
            if (alive) setNotice(null);
          },
          message.mentioned ? 10000 : 4500,
        );
      } catch {
        /* Historico e realce permanecem acessiveis quando o aviso sonoro nao esta disponivel. */
      } finally {
        inFlight = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 8000),
      unsubscribe = subscribeChatEvents((event) => {
        if (event.estabelecimentoId === tenant) void load();
      });
    const state = AppState.addEventListener('change', (value) => {
      if (value === 'active') void load();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      if (hide) clearTimeout(hide);
      unsubscribe();
      state.remove();
      setNotice(null);
      regular.pause();
      mention.pause();
    };
  }, [owner, turn.session?.sessionId, tenant, regular, mention]);
  useEffect(() => {
    if (!notice) return;
    opacity.setValue(theme.reducedMotion ? 1 : 0);
    if (!theme.reducedMotion)
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
  }, [notice, theme.reducedMotion, opacity]);
  if (!notice) return null;
  const Icon = notice.mentioned ? AtSign : MessageCircle;
  return (
    <Animated.View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        right: 12,
        maxWidth: 456,
        alignSelf: 'center',
        zIndex: 100,
        elevation: 10,
        opacity,
        borderRadius: 12,
        borderWidth: notice.mentioned ? 2 : 1,
        borderColor: notice.mentioned
          ? theme.colors.warning
          : theme.colors.line,
        backgroundColor: notice.mentioned
          ? theme.colors.warningSoft
          : theme.colors.card,
        shadowColor: '#101820',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          gap: 10,
        }}
      >
        <Icon
          size={22}
          color={notice.mentioned ? theme.colors.warning : theme.colors.accent}
        />
        <Pressable
          accessibilityLabel="Abrir mensagem recebida"
          style={{ flex: 1 }}
          onPress={() => {
            router.push({
              pathname: '/conversas',
              params: {
                channel: notice.channel,
                ...(notice.channel === 'private'
                  ? {
                      target: String(
                        notice.motoboyId === turn.queue?.motoboyId
                          ? notice.recipientId
                          : notice.motoboyId,
                      ),
                      name: notice.senderName,
                    }
                  : {}),
                messageId: notice.id,
              },
            });
            setNotice(null);
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: 11,
              fontWeight: '800',
              color: notice.mentioned ? theme.colors.warning : theme.colors.ink,
            }}
          >
            {notice.mentioned
              ? `${notice.senderName} mencionou voce`
              : notice.senderName}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: 'Manrope',
              fontSize: 10,
              lineHeight: 16,
              color: theme.colors.ink,
            }}
          >
            {notice.body || 'Anexo recebido'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Dispensar aviso"
          onPress={() => setNotice(null)}
          style={{ padding: 8 }}
        >
          <X color={theme.colors.muted} size={18} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
