import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  AtSign,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Reply,
  Search,
  Send,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import {
  ChatContact,
  ChatMessage,
  ChatTarget,
  dismissChatNotification,
  listChat,
  chatMessageContext,
  listChatContacts,
  listChatNotifications,
  LocalChatFile,
  reactChat,
  readChat,
} from '../../services/communicationApi';
import {
  createIdentifier,
  getOperationalQueue,
  RouteStop,
} from '../../services/mobileApi';
import { subscribeChatEvents } from '../../services/chatEvents';
import { useAuth } from '../contexts/AuthContext';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import {
  Avatar,
  Gradient,
  Header,
  IconButton,
  Screen,
  SectionTitle,
  type,
} from '../ui/Kit';
import { useZippyTheme } from '../ui/theme';
import { AudioComposer, ChatMedia } from './ChatMedia';
import { retainChatFile } from './media';
import { useChatOutbox } from './useChatOutbox';
import { decodeChatDraft, encodeChatDraft, mentionedIds } from './draft';

const reactionIcons = {
  like: ThumbsUp,
  heart: Heart,
  thanks: Check,
  alert: TriangleAlert,
};
const reactionLabels = {
  like: 'Curtir',
  heart: 'Gostei',
  thanks: 'Obrigado',
  alert: 'Atencao',
};
const merge = (previous: ChatMessage[], next: ChatMessage[]) =>
  Array.from(
    new Map([...previous, ...next].map((m) => [m.id, m])).values(),
  ).sort((a, b) => a.sequence - b.sequence);

function MentionMark({ children }: { children: React.ReactNode }) {
  const { colors, reducedMotion } = useZippyTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
        paddingLeft: 8,
      }}
    >
      <Animated.View
        style={{
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.85, 1],
          }),
        }}
      >
        <View style={styles.row}>
          <AtSign size={12} color={colors.warning} />
          <Text
            style={[styles.small, { color: colors.warning, fontWeight: '800' }]}
          >
            Mencionou voce
          </Text>
        </View>
      </Animated.View>
      {children}
    </View>
  );
}

export default function CommunicationScreen() {
  const params = useLocalSearchParams<{
    channel?: string;
    target?: string;
    name?: string;
    pedidoId?: string;
    view?: string;
    messageId?: string;
  }>();
  const router = useRouter(),
    insets = useSafeAreaInsets(),
    theme = useZippyTheme(),
    { colors, dark } = theme;
  const auth = useAuth(),
    turn = useOperationalSession();
  const tenant =
    auth.estabelecimentoAtual &&
    ('id' in auth.estabelecimentoAtual
      ? auth.estabelecimentoAtual.id
      : auth.estabelecimentoAtual.estabelecimentoId);
  const owner = auth.user && tenant ? `${auth.user.id}:${tenant}` : null;
  const channel =
    params.channel === 'store' ||
    params.channel === 'group' ||
    params.channel === 'private'
      ? params.channel
      : null;
  const target = useMemo<ChatTarget | null>(
    () =>
      channel
        ? {
            channel,
            target: channel === 'private' ? Number(params.target) : undefined,
            pedidoId: params.pedidoId ? Number(params.pedidoId) : undefined,
          }
        : null,
    [channel, params.target, params.pedidoId],
  );
  const identity = `${owner}:${turn.session?.sessionId}:${channel}:${params.target}:${params.pedidoId}`;
  const live = useRef(identity);
  live.current = identity;
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [contacts, setContacts] = useState<ChatContact[]>([]),
    [orders, setOrders] = useState<RouteStop[]>([]),
    [notices, setNotices] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [draft, setDraft] = useState(''),
    [restored, setRestored] = useState(false),
    [search, setSearch] = useState(''),
    [searching, setSearching] = useState(false),
    [filter, setFilter] = useState('Todas');
  const [selected, setSelected] = useState<ChatMessage | null>(null),
    [reply, setReply] = useState<ChatMessage | null>(null),
    [menu, setMenu] = useState(false),
    [mentions, setMentions] = useState<ChatContact[]>([]),
    [muted, setMuted] = useState(false),
    [mentionAlerts, setMentionAlerts] = useState(true);
  const [more, setMore] = useState(false),
    [cursor, setCursor] = useState<number | undefined>(),
    [older, setOlder] = useState(false),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null),
    follow = useRef(true),
    generation = useRef(0),
    enqueueing = useRef(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const loadedQuery = useRef('');
  const paginationQuery = useRef('');
  const draftKey = `zippygo.chat.draft.v2:${identity.replace(`:${turn.session?.sessionId}:`, ':')}`;
  const {
    outbox,
    entries,
    ready,
    error: queueError,
  } = useChatOutbox(owner, turn.session?.sessionId, (message, sentTarget) => {
    if (
      sentTarget.channel === target?.channel &&
      sentTarget.target === target?.target &&
      sentTarget.pedidoId === target?.pedidoId
    )
      setMessages((current) => merge(current, [message]));
    setRefresh((n) => n + 1);
  });
  useEffect(() => {
    let alive = true;
    setRestored(false);
    setDraft('');
    setReply(null);
    setMentions([]);
    void AsyncStorage.getItem(draftKey).then(
      (raw) => {
        if (alive) {
          const saved = decodeChatDraft(raw);
          setDraft(saved.body);
          setMentions(saved.mentions);
          setRestored(true);
        }
      },
      () => {
        if (alive) setError('Nao foi possivel recuperar o rascunho.');
      },
    );
    return () => {
      alive = false;
    };
  }, [draftKey]);
  useEffect(() => {
    if (!restored || !target) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(
        draftKey,
        encodeChatDraft(draft, mentions),
      ).catch(() => setError('Nao foi possivel salvar o rascunho.'));
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, mentions, restored, draftKey, target]);
  useEffect(() => {
    setMessages([]);
    setContacts([]);
    setSelected(null);
    setSearch('');
    setSearching(false);
    setMore(false);
    setCursor(undefined);
    setHighlighted(null);
    loadedQuery.current = '';
    paginationQuery.current = '';
  }, [identity]);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(`zippygo.chat.settings:${owner}`)
      .then((raw) => {
        if (alive) {
          const data = (
            raw ? JSON.parse(raw) : { muted: false, mentionAlerts: true }
          ) as {
            muted: boolean;
            mentionAlerts: boolean;
          };
          setMuted(!!data.muted);
          setMentionAlerts(data.mentionAlerts !== false);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [owner]);
  const setting = async (name: 'muted' | 'mentionAlerts', value: boolean) => {
    try {
      await AsyncStorage.setItem(
        `zippygo.chat.settings:${owner}`,
        JSON.stringify({ muted, mentionAlerts, [name]: value }),
      );
      if (name === 'muted') setMuted(value);
      else setMentionAlerts(value);
    } catch {
      setError('Nao foi possivel salvar os avisos.');
    }
  };
  useEffect(
    () =>
      subscribeChatEvents((event) => {
        if (event.estabelecimentoId === tenant) setRefresh((n) => n + 1);
      }),
    [tenant],
  );
  useFocusEffect(
    useCallback(() => {
      const version = ++generation.current,
        abort = new AbortController();
      let inFlight = false;
      const load = async () => {
        if (inFlight) return;
        inFlight = true;
        try {
          if (!turn.session)
            throw new Error(
              'Inicie seu turno para abrir as conversas da loja.',
            );
          if (target) {
            const query = `${identity}:${searching ? search : ''}`;
            const data = await listChat(target, {
              signal: abort.signal,
              search: searching ? search : undefined,
            });
            if (version !== generation.current) return;
            const replace = loadedQuery.current !== query;
            setMessages((current) =>
              replace ? data.messages : merge(current, data.messages),
            );
            if (paginationQuery.current !== query) {
              setMore(data.hasMore);
              setCursor(data.cursor);
              paginationQuery.current = query;
            }
            loadedQuery.current = query;
            const through = data.messages.at(-1)?.sequence;
            if (through && !searching)
              void readChat(target, through).catch(() => undefined);
          } else {
            const [queue, notifications] = await Promise.all([
              getOperationalQueue(),
              listChatNotifications(),
            ]);
            if (version !== generation.current) return;
            setOrders(
              [queue.current, ...queue.next].filter(
                (stop): stop is RouteStop => !!stop,
              ),
            );
            setNotices(notifications);
          }
          const roster = await listChatContacts();
          if (version !== generation.current) return;
          setContacts(roster);
          setError('');
        } catch (caught) {
          if (version === generation.current && !abort.signal.aborted)
            setError(
              caught instanceof Error
                ? caught.message
                : 'Nao foi possivel carregar.',
            );
        } finally {
          inFlight = false;
          if (version === generation.current) setLoading(false);
        }
      };
      setLoading(true);
      void load();
      const timer = setInterval(() => void load(), 8000);
      return () => {
        generation.current++;
        abort.abort();
        clearInterval(timer);
      };
    }, [identity, target, search, searching, refresh, turn.session?.sessionId]),
  );
  const locate = useCallback(
    async (id: string) => {
      if (!target) return;
      const scope = live.current;
      try {
        const page = await chatMessageContext(target, id);
        if (scope !== live.current) return;
        loadedQuery.current = `${scope}:`;
        setSearching(false);
        setSearch('');
        follow.current = false;
        setMessages((current) => merge(current, page.messages));
        setHighlighted(id);
      } catch (e) {
        if (scope === live.current)
          setError(e instanceof Error ? e.message : 'Mensagem indisponivel.');
      }
    },
    [target],
  );
  useEffect(() => {
    if (params.messageId && target) void locate(params.messageId);
  }, [params.messageId, identity, locate]);
  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(null), 10000);
    return () => clearTimeout(timer);
  }, [highlighted]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const store = auth.estabelecimentoAtual?.nome || 'Estabelecimento';
  const colleagues = contacts.filter(
    (c) => c.motoboyId !== turn.queue?.motoboyId,
  );
  const open = (chat: ChatTarget, name?: string) =>
    router.push({
      pathname: '/conversas',
      params: {
        channel: chat.channel,
        ...(chat.target ? { target: String(chat.target) } : {}),
        ...(name ? { name } : {}),
        ...(chat.pedidoId ? { pedidoId: String(chat.pedidoId) } : {}),
      },
    });
  const pending = entries.filter(
    (entry) =>
      entry.target.channel === target?.channel &&
      entry.target.target === target?.target && entry.target.pedidoId === target?.pedidoId,
  );
  const send = async (body = draft, file?: LocalChatFile) => {
    if (!target || !ready || enqueueing.current) return;
    enqueueing.current = true;
    setBusy(true);
    const scope = live.current;
    try {
      const savedFile = file ? await retainChatFile(file) : undefined;
      if (scope !== live.current) return;
      await outbox.enqueue({
        target,
        request: {
          clientId: createIdentifier(),
          body: body.trim(),
          replyTo: reply?.id,
          mentions: mentionedIds(body, mentions),
          pedidoId: target.pedidoId,
        },
        file: savedFile,
        state: 'queued',
        createdAtUtc: new Date().toISOString(),
      });
      if (scope !== live.current) return;
      setDraft('');
      setReply(null);
      setMentions([]);
      setError('');
      follow.current = true;
      void outbox.flush().catch((e) => setError(String(e)));
    } catch (e) {
      if (scope === live.current)
        setError(
          e instanceof Error ? e.message : 'Nao foi possivel colocar na fila.',
        );
    } finally {
      enqueueing.current = false;
      setBusy(false);
    }
  };
  const attach = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        await send(draft, {
          uri: asset.uri,
          name: asset.fileName || 'foto.jpg',
          contentType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nao foi possivel anexar.');
    }
  };
  const loadOlder = async () => {
    if (!target || !cursor || older) return;
    setOlder(true);
    follow.current = false;
    const scope = live.current;
    try {
      const page = await listChat(target, {
        before: cursor,
        search: searching ? search : undefined,
      });
      if (scope === live.current) {
        setMessages((current) => merge(page.messages, current));
        setMore(page.hasMore);
        setCursor(page.cursor);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setOlder(false);
    }
  };
  const react = async (value: string | null) => {
    if (!target || !selected) return;
    try {
      await reactChat(target, selected.id, value);
      setSelected(null);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(String(e));
    }
  };
  const matches = (name: string) =>
    name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
  const unread = (kind: string, id?: number) =>
    notices.filter((m) =>
      kind === 'private'
        ? m.channel === kind && (m.motoboyId === id || m.recipientId === id)
        : m.channel === kind,
    ).length;
  const contactRow = (contact: ChatContact) => (
    <Pressable
      key={contact.motoboyId}
      onPress={() =>
        open({ channel: 'private', target: contact.motoboyId }, contact.nome)
      }
      style={[styles.listRow, { borderBottomColor: colors.line }]}
    >
      <Avatar name={contact.nome} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.ink }]}>{contact.nome}</Text>
        <Text style={[styles.small, { color: colors.muted }]}>
          {contact.online ? 'Online' : 'Offline'}
        </Text>
      </View>
      {!!unread('private', contact.motoboyId) && (
        <Text
          style={[
            styles.badge,
            {
              backgroundColor: colors.accent,
              color: dark ? '#13233e' : '#fff',
            },
          ]}
        >
          {unread('private', contact.motoboyId)}
        </Text>
      )}
      <ChevronRight color={colors.muted} size={16} />
    </Pressable>
  );
  if (params.view === 'group' || params.view === 'contacts')
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          title={params.view === 'group' ? 'Sua equipe.' : 'Nova conversa'}
          subtitle={store}
          onBack={back}
        />
        {params.view === 'group' && (
          <>
            <View style={{ alignItems: 'center', padding: 18 }}>
              <Users color={colors.accent} size={34} />
              <Text
                style={[
                  styles.name,
                  { fontSize: 18, color: colors.ink, marginTop: 12 },
                ]}
              >
                Equipe · {store}
              </Text>
              <Text style={[styles.small, { color: colors.muted }]}>
                {contacts.length} participantes ·{' '}
                {contacts.filter((c) => c.online).length} online
              </Text>
            </View>
            <View style={styles.listRow}>
              <Bell size={20} color={colors.accent} />
              <Text style={[styles.name, { color: colors.ink, flex: 1 }]}>
                Silenciar avisos do grupo
              </Text>
              <Switch
                accessibilityLabel="Silenciar avisos do grupo"
                value={muted}
                onValueChange={(v) => void setting('muted', v)}
              />
            </View>
            <View style={styles.listRow}>
              <AtSign size={20} color={colors.warning} />
              <Text style={[styles.name, { color: colors.ink, flex: 1 }]}>
                Avisar quando me mencionarem
              </Text>
              <Switch
                accessibilityLabel="Avisar quando me mencionarem"
                value={mentionAlerts}
                onValueChange={(v) => void setting('mentionAlerts', v)}
              />
            </View>
          </>
        )}
        <TextInput
          accessibilityLabel="Buscar contato"
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar nome…"
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            {
              color: colors.ink,
              borderColor: colors.line,
              backgroundColor: colors.card,
            },
          ]}
        />
        <SectionTitle>Estabelecimento</SectionTitle>
        <Pressable
          style={styles.listRow}
          onPress={() => open({ channel: 'store' })}
        >
          <Avatar name={store} />
          <Text style={[styles.name, { color: colors.ink, flex: 1 }]}>
            {store}
          </Text>
          <ChevronRight size={16} color={colors.muted} />
        </Pressable>
        <SectionTitle>Motoboys</SectionTitle>
        {colleagues.filter((c) => matches(c.nome)).map(contactRow)}
        {loading && <ActivityIndicator color={colors.accent} />}
        {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
      </Screen>
    );
  if (params.view === 'notifications')
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          title="Notificações"
          subtitle="Sua equipe. Seus avisos."
          onBack={back}
        />
        {loading && <ActivityIndicator color={colors.accent} />}
        {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
        {notices.map((notice) => (
          <View
            key={notice.id}
            style={[
              styles.listRow,
              {
                borderBottomColor: colors.line,
                backgroundColor: notice.mentioned
                  ? colors.warningSoft
                  : undefined,
              },
            ]}
          >
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                void dismissChatNotification(notice.id).catch(() => undefined);
                open(
                  {
                    channel: notice.channel,
                    target:
                      notice.channel === 'private'
                        ? notice.motoboyId === turn.queue?.motoboyId
                          ? notice.recipientId
                          : notice.motoboyId
                        : undefined,
                  },
                  notice.senderName,
                );
              }}
            >
              {notice.mentioned && (
                <Text
                  style={[
                    styles.small,
                    { color: colors.warning, fontWeight: '800' },
                  ]}
                >
                  @ Mencionou voce
                </Text>
              )}
              <Text style={[styles.name, { color: colors.ink }]}>
                {notice.senderName}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.small, { color: colors.muted }]}
              >
                {notice.body || 'Anexo recebido'}
              </Text>
            </Pressable>
            <IconButton
              icon={Check}
              label="Marcar aviso como lido"
              onPress={() =>
                void dismissChatNotification(notice.id)
                  .then(() => setRefresh((n) => n + 1))
                  .catch((e) => setError(String(e)))
              }
            />
          </View>
        ))}
        {!loading && !notices.length && (
          <Text style={[type.small, { color: colors.muted }]}>
            Nenhum aviso pendente.
          </Text>
        )}
      </Screen>
    );
  if (!target)
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          title="Conversas"
          subtitle="Sua equipe. Seu caminho."
          onBack={back}
          right={
            <View style={styles.row}>
              <IconButton
                icon={Bell}
                label="Notificacoes"
                onPress={() =>
                  router.push({
                    pathname: '/conversas',
                    params: { view: 'notifications' },
                  })
                }
              />
              <IconButton
                icon={UserPlus}
                label="Nova conversa"
                onPress={() =>
                  router.push({
                    pathname: '/conversas',
                    params: { view: 'contacts' },
                  })
                }
              />
            </View>
          }
        />
        <TextInput
          accessibilityLabel="Buscar conversas"
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar nome ou pedido…"
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            {
              color: colors.ink,
              borderColor: colors.line,
              backgroundColor: colors.card,
            },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginVertical: 14 }}
        >
          {['Todas', 'Loja', 'Clientes', 'Colegas'].map((label) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === label }}
              key={label}
              onPress={() => setFilter(label)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    filter === label ? colors.accentSoft : colors.card,
                  borderColor: colors.line,
                },
              ]}
            >
              <Text
                style={[
                  styles.small,
                  { color: filter === label ? colors.accent : colors.muted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={() => open({ channel: 'group' })}
          style={[styles.group, { borderColor: colors.line }]}
        >
          <Gradient colors={[colors.heroEnd, colors.hero]} glow />
          <Users color="#c6e0ff" size={27} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: '#fff' }]}>
              Equipe · {store}
            </Text>
            <Text style={[styles.small, { color: '#c3d4ed' }]}>
              {contacts.length} pessoas ·{' '}
              {contacts.filter((c) => c.online).length} online
            </Text>
          </View>
          {!!unread('group') && (
            <Text
              style={[
                styles.badge,
                { backgroundColor: '#edf4ff', color: '#285ac7' },
              ]}
            >
              {unread('group')}
            </Text>
          )}
        </Pressable>
        {(filter === 'Todas' || filter === 'Loja') && matches(store) && (
          <Pressable
            onPress={() => open({ channel: 'store' })}
            style={[styles.listRow, { borderBottomColor: colors.line }]}
          >
            <Avatar name={store} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.ink }]}>{store}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>
                Atendimento da loja
              </Text>
            </View>
            {!!unread('store') && (
              <Text
                style={[
                  styles.badge,
                  { backgroundColor: colors.accent, color: '#fff' },
                ]}
              >
                {unread('store')}
              </Text>
            )}
            <ChevronRight color={colors.muted} size={16} />
          </Pressable>
        )}
        {(filter === 'Todas' || filter === 'Clientes') &&
          orders
            .filter((stop) =>
              matches(`${stop.pedido?.nomeCliente} ${stop.pedidoId}`),
            )
            .map((stop) => (
              <Pressable
                key={stop.pedidoId}
                onPress={() =>
                  router.push({
                    pathname: '/conversas',
                    params: {
                      channel: 'client',
                      pedidoId: String(stop.pedidoId),
                    },
                  })
                }
                style={[styles.listRow, { borderBottomColor: colors.line }]}
              >
                <Avatar name={stop.pedido?.nomeCliente || 'Cliente'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.ink }]}>
                    {stop.pedido?.nomeCliente || 'Cliente'} · #{stop.pedidoId}
                  </Text>
                  <Text style={[styles.small, { color: colors.muted }]}>
                    Pedido em andamento
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.muted} />
              </Pressable>
            ))}
        {(filter === 'Todas' || filter === 'Colegas') &&
          colleagues.filter((c) => matches(c.nome)).map(contactRow)}
        {loading && <ActivityIndicator color={colors.accent} />}
        {!!error && (
          <Pressable onPress={() => setRefresh((n) => n + 1)}>
            <Text style={{ color: colors.danger }}>{error}</Text>
          </Pressable>
        )}
      </Screen>
    );
  const name =
    channel === 'group'
      ? `Equipe · ${store}`
      : channel === 'private'
        ? contacts.find((c) => c.motoboyId === target.target)?.nome ||
          params.name ||
          'Colega'
        : store;
  const mentionQuery =
    channel === 'group' ? draft.match(/@([^@\n]*)$/)?.[1] : undefined;
  const candidates =
    mentionQuery !== undefined
      ? colleagues
          .filter((c) =>
            c.nome
              .toLocaleLowerCase('pt-BR')
              .includes(mentionQuery.toLocaleLowerCase('pt-BR')),
          )
          .slice(0, 6)
      : [];
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: dark ? '#111c30' : colors.paper }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          width: '100%',
          maxWidth: 480,
          flex: 1,
          alignSelf: 'center',
          paddingTop: insets.top,
        }}
      >
        <View
          style={[
            styles.chatHeader,
            {
              backgroundColor: dark ? '#243952' : colors.card,
              borderBottomColor: colors.line,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Voltar"
            onPress={back}
            style={styles.tool}
          >
            <ArrowLeft size={18} color={colors.ink} />
          </Pressable>
          <Avatar name={name} />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.name, { color: colors.ink }]}
              numberOfLines={2}
            >
              {name}
            </Text>
            <Text style={[styles.small, { fontSize: 9, color: colors.muted }]}>
              {channel === 'group'
                ? `${contacts.length} participantes · ${contacts.filter((c) => c.online).length} online`
                : channel === 'private'
                  ? 'Colega da sua equipe'
                  : 'Atendimento da loja'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Buscar mensagens"
            onPress={() => setSearching((v) => !v)}
            style={styles.tool}
          >
            <Search color={colors.ink} size={18} />
          </Pressable>
          <Pressable
            accessibilityLabel="Menu da conversa"
            onPress={() => setMenu((v) => !v)}
            style={styles.tool}
          >
            <MoreVertical size={18} color={colors.ink} />
          </Pressable>
        </View>
        {menu && (
          <View
            style={[styles.row, { padding: 12, backgroundColor: colors.card }]}
          >
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/conversas',
                  params: { view: channel === 'group' ? 'group' : 'contacts' },
                })
              }
            >
              <Text style={[styles.small, { color: colors.accent }]}>
                {channel === 'group' ? 'Participantes e avisos' : 'Contatos'}
              </Text>
            </Pressable>
          </View>
        )}
        <Pressable
          onPress={() =>
            channel === 'group'
              ? router.push({
                  pathname: '/conversas',
                  params: { view: 'group' },
                })
              : target.pedidoId
                ? router.push({
                    pathname: '/pedido/[id]',
                    params: { id: String(target.pedidoId) },
                  })
                : router.push({
                    pathname: '/conversas',
                    params: { view: 'contacts' },
                  })
          }
          style={[
            styles.context,
            { backgroundColor: dark ? '#253b58' : '#dee6f0' },
          ]}
        >
          <Users color={colors.accent} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.ink, fontSize: 11 }]}>
              {target.pedidoId
                ? `Pedido #${target.pedidoId}`
                : channel === 'group'
                  ? 'Avisos da equipe'
                  : `Equipe · ${store}`}
            </Text>
            <Text style={[styles.small, { color: colors.muted, fontSize: 9 }]}>
              {channel === 'group'
                ? 'Conversa do estabelecimento'
                : 'Combine o proximo passo'}
            </Text>
          </View>
          <ChevronRight size={15} color={colors.muted} />
        </Pressable>
        {searching && (
          <TextInput
            accessibilityLabel="Buscar mensagens"
            placeholder="Buscar nesta conversa…"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={[
              styles.input,
              {
                color: colors.ink,
                backgroundColor: colors.card,
                borderColor: colors.line,
                margin: 12,
              },
            ]}
          />
        )}
        {!!(error || queueError) && (
          <Pressable
            accessibilityRole="alert"
            onPress={() => setRefresh((n) => n + 1)}
            style={{ backgroundColor: colors.warningSoft, padding: 12 }}
          >
            <Text style={[styles.small, { color: colors.warning }]}>
              {error || queueError}
            </Text>
          </Pressable>
        )}
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            follow.current =
              contentSize.height - contentOffset.y - layoutMeasurement.height <
              60;
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (follow.current)
              scroll.current?.scrollToEnd({ animated: false });
          }}
        >
          {more && (
            <Pressable
              accessibilityLabel="Carregar mensagens anteriores"
              onPress={() => void loadOlder()}
              style={{ alignSelf: 'center', padding: 12 }}
            >
              {older ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={[styles.small, { color: colors.accent }]}>
                  Mensagens anteriores
                </Text>
              )}
            </Pressable>
          )}
          {loading && <ActivityIndicator color={colors.accent} />}
          {!loading && !messages.length && !pending.length && (
            <Text
              style={[
                styles.small,
                { color: colors.muted, alignSelf: 'center', marginTop: 35 },
              ]}
            >
              Nenhuma mensagem nesta conversa.
            </Text>
          )}
          {messages.map((message) => {
            const foreground = message.mine && dark ? '#fff' : colors.ink;
            const content = (
              <>
                <Text
                  style={[
                    styles.small,
                    {
                      fontWeight: '800',
                      color: message.mine && dark ? '#d6e8ff' : colors.accent,
                      marginBottom: 4,
                    },
                  ]}
                >
                  {message.senderName}
                </Text>
                {message.replyTo && (
                  <Pressable
                    accessibilityLabel="Ver mensagem citada"
                    onPress={() => {
                      if (message.replyTo) void locate(message.replyTo);
                    }}
                    style={{
                      borderLeftWidth: 2,
                      borderLeftColor: colors.accent,
                      padding: 7,
                      backgroundColor: message.mine ? '#ffffff14' : colors.soft,
                      marginBottom: 6,
                    }}
                  >
                    <Text
                      style={[
                        styles.small,
                        { color: foreground, fontWeight: '700' },
                      ]}
                    >
                      {message.replySender}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[styles.small, { color: foreground }]}
                    >
                      {message.replyBody || 'Anexo'}
                    </Text>
                  </Pressable>
                )}
                {message.attachment && (
                  <ChatMedia
                    attachment={message.attachment}
                    foreground={foreground}
                  />
                )}
                {!!message.body && (
                  <Text style={[styles.body, { color: foreground }]}>
                    {message.body}
                  </Text>
                )}
                <View
                  style={[
                    styles.row,
                    { justifyContent: 'flex-end', gap: 4, marginTop: 7 },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope',
                      fontSize: 8,
                      color: message.mine && dark ? '#d6e8ff' : colors.muted,
                    }}
                  >
                    {new Date(message.createdAtUtc).toLocaleTimeString(
                      'pt-BR',
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </Text>
                  {message.mine &&
                    (message.readCount > 0 ? (
                      <CheckCheck
                        color={message.mine && dark ? '#d6e8ff' : colors.accent}
                        size={12}
                      />
                    ) : (
                      <Check
                        color={message.mine && dark ? '#d6e8ff' : colors.muted}
                        size={12}
                      />
                    ))}
                </View>
                {message.reactions.length > 0 && (
                  <View
                    style={[styles.row, { marginTop: 8, flexWrap: 'wrap' }]}
                  >
                    {message.reactions.map((r) => {
                      const Icon =
                        reactionIcons[
                          r.reaction as keyof typeof reactionIcons
                        ] || ThumbsUp;
                      return (
                        <Pressable
                          key={r.reaction}
                          accessibilityLabel={`${r.reaction}: ${r.count}`}
                          onPress={() => {
                            setSelected(message);
                          }}
                          style={[
                            styles.row,
                            {
                              gap: 4,
                              padding: 5,
                              borderRadius: 8,
                              backgroundColor: colors.soft,
                            },
                          ]}
                        >
                          <Icon size={12} color={colors.accent} />
                          <Text style={[styles.small, { color: colors.ink }]}>
                            {r.count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            );
            return (
              <Pressable
                key={message.id}
                onLayout={(event) => {
                  if (highlighted === message.id)
                    scroll.current?.scrollTo({
                      y: Math.max(0, event.nativeEvent.layout.y - 32),
                      animated: !theme.reducedMotion,
                    });
                }}
                accessibilityLabel={`Mensagem de ${message.senderName}${message.mentioned ? ', mencionou voce' : ''}: ${message.body || 'anexo'}`}
                onLongPress={() => setSelected(message)}
                onPress={() => setSelected(message)}
                style={[
                  styles.bubble,
                  {
                    alignSelf: message.mine ? 'flex-end' : 'flex-start',
                    backgroundColor: message.mine
                      ? dark
                        ? '#2872e3'
                        : '#c7d8ee'
                      : dark
                        ? '#22334c'
                        : '#fff',
                    borderWidth: highlighted === message.id ? 3 : 1,
                    borderColor:
                      message.mentioned || highlighted === message.id
                        ? colors.warning
                        : message.mine
                          ? dark
                            ? '#65a1ff'
                            : '#b9cde7'
                          : colors.line,
                  },
                ]}
              >
                {message.mentioned ? (
                  <MentionMark>{content}</MentionMark>
                ) : (
                  content
                )}
              </Pressable>
            );
          })}
          {pending.map((entry) => (
            <View
              key={entry.request.clientId}
              style={[
                styles.bubble,
                {
                  alignSelf: 'flex-end',
                  backgroundColor: colors.accentSoft,
                  borderColor:
                    entry.state === 'failed' ? colors.danger : colors.line,
                },
              ]}
            >
              <Text style={[styles.body, { color: colors.ink }]}>
                {entry.request.body ||
                  (entry.file?.contentType.startsWith('audio/')
                    ? 'Audio'
                    : 'Foto')}
              </Text>
              <Text
                style={[
                  styles.small,
                  {
                    color:
                      entry.state === 'failed' ? colors.danger : colors.muted,
                  },
                ]}
              >
                {entry.state === 'sending'
                  ? 'Enviando…'
                  : entry.state === 'queued'
                    ? 'Aguardando envio'
                    : entry.error || 'Envio nao confirmado'}
              </Text>
              {entry.state !== 'sending' && (
                <View style={styles.row}>
                  <Pressable
                    accessibilityLabel="Reenviar mensagem"
                    onPress={() =>
                      void outbox
                        .retry(entry.request.clientId)
                        .catch((e) => setError(String(e)))
                    }
                    style={{ padding: 8 }}
                  >
                    <Text style={[styles.small, { color: colors.accent }]}>
                      Reenviar
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Remover mensagem pendente"
                    onPress={() =>
                      void outbox
                        .remove(entry.request.clientId)
                        .catch((e) => setError(String(e)))
                    }
                    style={styles.tool}
                  >
                    <Trash2 size={16} color={colors.muted} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
        {selected && (
          <View
            style={[
              styles.row,
              {
                backgroundColor: colors.card,
                borderTopWidth: 1,
                borderColor: colors.line,
                padding: 9,
                flexWrap: 'wrap',
              },
            ]}
          >
            <Pressable
              accessibilityLabel="Responder citando mensagem"
              onPress={() => {
                setReply(selected);
                setSelected(null);
              }}
              style={styles.tool}
            >
              <Reply size={20} color={colors.accent} />
            </Pressable>
            {Object.entries(reactionIcons).map(([key, Icon]) => (
              <Pressable
                accessibilityLabel={
                  reactionLabels[key as keyof typeof reactionLabels]
                }
                key={key}
                onPress={() =>
                  void react(
                    selected.reactions.some((r) => r.reaction === key && r.mine)
                      ? null
                      : key,
                  )
                }
                style={styles.tool}
              >
                <Icon
                  color={
                    selected.reactions.some((r) => r.reaction === key && r.mine)
                      ? colors.accent
                      : colors.muted
                  }
                  size={18}
                />
              </Pressable>
            ))}
            <Pressable
              accessibilityLabel="Fechar acoes da mensagem"
              onPress={() => setSelected(null)}
              style={styles.tool}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
        )}
        {reply && (
          <View
            style={[styles.row, { padding: 10, backgroundColor: colors.soft }]}
          >
            <Reply size={16} color={colors.accent} />
            <Text
              numberOfLines={2}
              style={[styles.small, { color: colors.ink, flex: 1 }]}
            >
              Respondendo a {reply.senderName}: {reply.body || 'Anexo'}
            </Text>
            <Pressable
              accessibilityLabel="Cancelar resposta"
              onPress={() => setReply(null)}
              style={styles.tool}
            >
              <X size={16} color={colors.muted} />
            </Pressable>
          </View>
        )}
        {!!candidates.length && (
          <ScrollView
            horizontal
            contentContainerStyle={{ padding: 10, gap: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {candidates.map((contact) => (
              <Pressable
                accessibilityLabel={`Mencionar ${contact.nome}`}
                key={contact.motoboyId}
                onPress={() => {
                  setDraft((current) =>
                    current.replace(/@([^@\n]*)$/, `@${contact.nome} `),
                  );
                  setMentions((current) => [
                    ...current.filter((c) => c.motoboyId !== contact.motoboyId),
                    contact,
                  ]);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.warningSoft,
                    borderColor: colors.warning,
                  },
                ]}
              >
                <Text style={[styles.small, { color: colors.warning }]}>
                  @{contact.nome}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 7,
            paddingBottom: 10,
            alignItems: 'center',
          }}
        >
          {(channel === 'store'
            ? ['Estou saindo', 'Cheguei à loja', 'Preciso de ajuda']
            : channel === 'group'
              ? ['Boa noite, equipe!', 'Atenção no caminho']
              : ['Como está o caminho?', 'Valeu!', 'Estou na loja']
          ).map((text) => (
            <Pressable
              key={text}
              disabled={!ready || busy}
              onPress={() => void send(text)}
              style={[
                styles.chip,
                { backgroundColor: colors.soft, borderColor: colors.line },
              ]}
            >
              <Text
                style={[styles.small, { fontSize: 9, color: colors.accent }]}
              >
                {text}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View
          style={[
            styles.row,
            {
              paddingHorizontal: 12,
              paddingBottom: Math.max(insets.bottom, 14),
              alignItems: 'flex-end',
              gap: 6,
            },
          ]}
        >
          <View
            style={[
              styles.row,
              {
                flex: 1,
                minHeight: 45,
                maxHeight: 130,
                paddingHorizontal: 4,
                borderRadius: 19,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
                gap: 0,
              },
            ]}
          >
            <Pressable
              accessibilityLabel="Anexar foto"
              disabled={!ready || busy}
              onPress={() => void attach()}
              style={styles.tool}
            >
              <Paperclip color={colors.muted} size={19} />
            </Pressable>
            <TextInput
              accessibilityLabel="Mensagem"
              multiline
              placeholder="Escreva uma mensagem…"
              placeholderTextColor={colors.muted}
              value={draft}
              onChangeText={setDraft}
              maxLength={500}
              editable={ready && !busy}
              style={[
                styles.body,
                {
                  flex: 1,
                  color: colors.ink,
                  maxHeight: 120,
                  paddingVertical: 10,
                  paddingRight: 6,
                },
              ]}
            />
          </View>
          <AudioComposer
            disabled={!ready || busy}
            send={(file) => send('', file)}
            onError={setError}
          />
          <Pressable
            accessibilityLabel="Enviar mensagem"
            disabled={!ready || busy || !draft.trim()}
            onPress={() => void send()}
            style={[
              styles.tool,
              {
                borderRadius: 16,
                backgroundColor: '#2872e3',
                opacity: !ready || busy || !draft.trim() ? 0.5 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Send color="#fff" size={19} />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: {
    fontFamily: 'Manrope',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  small: {
    fontFamily: 'Manrope',
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0,
  },
  body: {
    fontFamily: 'Manrope',
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  input: {
    fontFamily: 'Manrope',
    fontSize: 11,
    minHeight: 45,
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
  },
  chip: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
  },
  badge: {
    fontFamily: 'Manrope',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tool: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 57,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  bubble: {
    maxWidth: '85%',
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
});
