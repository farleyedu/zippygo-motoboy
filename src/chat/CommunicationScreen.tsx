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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
  Clock,
  Heart,
  MessageCircle,
  MessageSquarePlus,
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
import { AppNav } from '../ui/AccountKit';
import { ChatMessageActions } from './ChatMessageActions';
import { ChatForwardSheet } from './ChatForwardSheet';
import * as Haptics from 'expo-haptics';
import { useZippyTheme } from '../ui/theme';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { AudioComposer, ChatMedia } from './ChatMedia';
import { BubbleText, continuesMessage, MessageBubble, MessageMeta, ReplyQuote } from './MessageBubble';
import { retainChatFile } from './media';
import { useChatOutbox } from './useChatOutbox';
import { decodeChatDraft, encodeChatDraft, mentionedIds } from './draft';
import { SkeletonBubbles, SkeletonRows } from '../ui/Skeleton';
import { StatusBar } from 'expo-status-bar';
import { dayLabel, sameDay, senderTone, SwipeReply, useWa, WaAvatar, WaChip, WaComposer, WaFab, WaFilters, WaHeader, WaListRow, WaPage, WaReplyBar, WaScrollFab, WaSearch } from './WaKit';
import { describeMessage, getPreview, listTime, previewKey, rememberPreview } from './chatPreview';
import { usePagedContacts } from './usePagedContacts';
import { useIsFocused } from 'expo-router/react-navigation';
import { isAppForeground, useAppForeground } from '../hooks/useAppForeground';

// Última resposta vista de cada lista/conversa: a tela abre com isso na hora e confere a rede em seguida.
type ChatSnapshot = { messages: ChatMessage[]; more: boolean; cursor?: number };
const chatSnapshots = new Map<string, ChatSnapshot>();
const listSnapshots = new Map<string, { orders: RouteStop[]; notices: ChatMessage[] }>();
const remember = <V,>(map: Map<string, V>, key: string, value: V) => { if (map.size >= 40) map.delete(map.keys().next().value as string); map.delete(key); map.set(key, value); };

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
  const foreground = useAppForeground(), focused = useIsFocused(), active = foreground && focused;
  const keyboardVisible = useKeyboardVisible();
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
    { colors, dark } = theme,
    wa = useWa();
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
  const snapshot = chatSnapshots.get(identity), listed = listSnapshots.get(`${owner}:${turn.session?.sessionId}`);
  const [messages, setMessages] = useState<ChatMessage[]>(() => snapshot?.messages ?? []),
    [orders, setOrders] = useState<RouteStop[]>(() => listed?.orders ?? []),
    [notices, setNotices] = useState<ChatMessage[]>(() => listed?.notices ?? []);
  const [loading, setLoading] = useState(() => !(target ? snapshot : listed)),
    [error, setError] = useState(''),
    [draft, setDraft] = useState(''),
    [restoredDraftKey, setRestoredDraftKey] = useState<string | null>(null),
    [search, setSearch] = useState(''),
    [searching, setSearching] = useState(false),
    [filter, setFilter] = useState('Todas');
  const roster = usePagedContacts(owner && turn.session ? `${owner}:${turn.session.sessionId}` : null, target ? '' : search, active);
  const rosterRefresh = useRef(roster.refresh); rosterRefresh.current = roster.refresh;
  const messageSearch = target && searching ? search : '';
  const { contacts, ready: rosterReady } = roster;
  const loadContactsOnScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 160) void roster.loadMore();
  };
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null),
    [reply, setReply] = useState<ChatMessage | null>(null),
    [menu, setMenu] = useState(false),
    [mentions, setMentions] = useState<ChatContact[]>([]),
    [muted, setMuted] = useState(false),
    [mentionAlerts, setMentionAlerts] = useState(true);
  const [more, setMore] = useState(() => snapshot?.more ?? false),
    [cursor, setCursor] = useState<number | undefined>(() => snapshot?.cursor),
    [older, setOlder] = useState(false),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null),
    follow = useRef(true),
    generation = useRef(0),
    enqueueing = useRef(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true), [away, setAway] = useState(0), lastCount = useRef(0);
  useEffect(() => {
    const added = messages.length - lastCount.current; lastCount.current = messages.length;
    if (added > 0 && !follow.current) setAway((count) => count + added);
  }, [messages.length]);
  useEffect(() => {
    if (!channel || !messages.length) return;
    rememberPreview(previewKey(owner, channel, channel === 'private' ? target?.target : undefined), messages.at(-1), channel === 'group');
  }, [messages, channel, owner, target?.target]);
  const loadedQuery = useRef('');
  const paginationQuery = useRef('');
  const draftKey = `zippygo.chat.draft.v2:${identity.replace(`:${turn.session?.sessionId}:`, ':')}`;
  const restored = !!owner && restoredDraftKey === draftKey;
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
    setRestoredDraftKey(null);
    setDraft('');
    setReply(null);
    setMentions([]);
    void AsyncStorage.getItem(draftKey).then(
      (raw) => {
        if (alive) {
          const saved = decodeChatDraft(raw);
          setDraft(saved.body);
          setMentions(saved.mentions);
          setRestoredDraftKey(draftKey);
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
    follow.current = true;
    const saved = chatSnapshots.get(identity), listing = listSnapshots.get(`${owner}:${turn.session?.sessionId}`);
    setMessages(saved?.messages ?? []);
    setOrders(listing?.orders ?? []); setNotices(listing?.notices ?? []);
    setLoading(!(target ? saved : listing));
    setSelected(null); setForwarding(null);
    setSearch('');
    setSearching(false);
    setMore(saved?.more ?? false);
    setCursor(saved?.cursor);
    setHighlighted(null);
    loadedQuery.current = saved ? `${identity}:` : '';
    paginationQuery.current = saved ? `${identity}:` : '';
  }, [identity]);
  useEffect(() => { if (target && messages.length && loadedQuery.current === `${identity}:`) remember(chatSnapshots, identity, { messages, more, cursor }); }, [messages, more, cursor, identity, target]);
  useEffect(() => {
    if (!keyboardVisible) return;
    follow.current = true;
    const frame = requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
    const timer = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 180);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [keyboardVisible]);
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
    () => {
      if (!active) return;
      return subscribeChatEvents((event) => {
        if (event.estabelecimentoId === tenant) setRefresh((n) => n + 1);
      });
    },
    [tenant, active],
  );
  useFocusEffect(
    useCallback(() => {
      if (!foreground) return;
      const version = ++generation.current,
        abort = new AbortController();
      let inFlight = false;
      const load = async () => {
        if (inFlight || abort.signal.aborted || !isAppForeground()) return;
        inFlight = true;
        try {
          if (!turn.session)
            throw new Error(
              'Inicie seu turno para abrir as conversas da loja.',
            );
          const rosterApplied = rosterRefresh.current();
          const mainTask = (async () => {
            if (target) {
              const query = `${identity}:${messageSearch}`;
              const data = await listChat(target, {
                signal: abort.signal,
                search: messageSearch || undefined,
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
                turn.store.getSnapshot().queue ?? getOperationalQueue(),
                listChatNotifications(),
              ]);
              if (version !== generation.current) return;
              const active = [queue.current, ...queue.next].filter(
                (stop): stop is RouteStop => !!stop,
              );
              remember(listSnapshots, `${owner}:${turn.session?.sessionId}`, { orders: active, notices: notifications });
              setOrders(active);
              setNotices(notifications);
            }
            if (version === generation.current) setLoading(false);
          })();
          await Promise.all([mainTask, rosterApplied]);
          if (version !== generation.current) return;
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
      setLoading(!(target ? chatSnapshots.get(identity) : listSnapshots.get(`${owner}:${turn.session?.sessionId}`)));
      void load();
      const timer = setInterval(() => void load(), 60000);
      return () => {
        generation.current++;
        abort.abort();
        clearInterval(timer);
      };
    }, [identity, target, messageSearch, searching, refresh, turn.session?.sessionId, foreground]),
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
    if (!target || !ready || enqueueing.current) {
      if (file) throw new Error('Aguarde a conversa ficar disponível para enviar o anexo.');
      return;
    }
    enqueueing.current = true;
    setBusy(true);
    const scope = live.current;
    try {
      const savedFile = file ? await retainChatFile(file) : undefined;
      if (scope !== live.current) throw new Error('A conversa mudou. Retome o envio do anexo.');
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
      if (file) throw e;
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
        // iOS: desde o expo-image-picker 17 o padrao manteria HEIC; o chat envia JPG.
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic,
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
  const info = (kind: string, id: number | undefined, fallback: string) => {
    const saved = getPreview(previewKey(owner, kind, id));
    const list = notices.filter((m) => kind === 'private' ? m.channel === kind && (m.motoboyId === id || m.recipientId === id) : m.channel === kind);
    const last = list.reduce<ChatMessage | undefined>((a, m) => !a || Date.parse(m.createdAtUtc) > Date.parse(a.createdAtUtc) ? m : a, undefined);
    const fromNotice = last ? describeMessage(last, kind === 'group') : undefined;
    const best = fromNotice && (!saved || fromNotice.at >= saved.at) ? fromNotice : saved;
    return { text: best?.text || fallback, at: best?.at || 0, unread: list.length };
  };
  const contactCount = roster.totalContacts ?? contacts.length;
  const onlineCount = roster.onlineContacts ?? contacts.filter((c) => c.online).length;
  const contactRow = (contact: ChatContact) => {
    const data = info('private', contact.motoboyId, contact.online ? 'Online' : 'Offline');
    return <WaListRow key={contact.motoboyId} name={contact.nome} title={contact.nome} preview={data.text} time={listTime(data.at)} unread={data.unread} online={contact.online}
      onPress={() => open({ channel: 'private', target: contact.motoboyId }, contact.nome)} />;
  };
  const pageFooter = <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: wa.header, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: wa.divider }}><View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}><AppNav active="chats" /></View></View>;
  if (params.view === 'group' || params.view === 'contacts')
    return (
      <WaPage header={<WaHeader title={params.view === 'group' ? 'Dados da equipe' : 'Nova conversa'} subtitle={store} onBack={back} />} footer={pageFooter}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 24 }} onScroll={loadContactsOnScroll} scrollEventThrottle={200}>
          {params.view === 'group' && (
            <>
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
                <WaAvatar name={`Equipe · ${store}`} size={96} />
                <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 22, letterSpacing: -.5, color: wa.ink, marginTop: 8 }}>Equipe · {store}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: wa.meta }}>Grupo · {contactCount} participantes · {onlineCount} online</Text>
              </View>
              <View style={{ height: 8, backgroundColor: wa.wallpaper }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, minHeight: 60 }}>
                <Bell size={21} color={wa.meta} />
                <Text style={{ flex: 1, fontFamily: 'Manrope', fontWeight: '700', fontSize: 15.5, color: wa.ink }}>Silenciar avisos do grupo</Text>
                <Switch accessibilityLabel="Silenciar avisos do grupo" value={muted} onValueChange={(v) => void setting('muted', v)} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, minHeight: 60 }}>
                <AtSign size={21} color={wa.meta} />
                <Text style={{ flex: 1, fontFamily: 'Manrope', fontWeight: '700', fontSize: 15.5, color: wa.ink }}>Avisar quando me mencionarem</Text>
                <Switch accessibilityLabel="Avisar quando me mencionarem" value={mentionAlerts} onValueChange={(v) => void setting('mentionAlerts', v)} />
              </View>
              <View style={{ height: 8, backgroundColor: wa.wallpaper }} />
              <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 13.5, color: wa.meta, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 }}>{contactCount} participantes</Text>
            </>
          )}
          {params.view !== 'group' && <View style={{ paddingTop: 10 }}><WaSearch label="Buscar contato" value={search} onChange={setSearch} placeholder="Buscar nome…" /></View>}
          {params.view !== 'group' && matches(store) && <WaListRow name={store} title={store} preview="Atendimento da loja" onPress={() => open({ channel: 'store' })} />}
          {colleagues.filter((c) => matches(c.nome)).map(contactRow)}
          {!rosterReady && !error && <View style={{ padding: 16 }}><SkeletonRows rows={4} /></View>}
          {roster.loadingMore && <ActivityIndicator color={wa.meta} style={{ padding: 16 }} accessibilityLabel="Carregando contatos" />}
          {!!roster.error && <Pressable onPress={() => void roster.refresh()}><Text style={{ color: colors.danger, padding: 16 }}>{roster.error}</Text></Pressable>}
          {!!error && <Text style={{ color: colors.danger, padding: 16 }}>{error}</Text>}
        </ScrollView>
      </WaPage>
    );
  if (params.view === 'notifications')
    return (
      <WaPage header={<WaHeader title="Notificações" subtitle="Sua equipe. Seus avisos." onBack={back} />} footer={pageFooter}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {loading && !notices.length && <View style={{ padding: 16 }}><SkeletonRows rows={4} /></View>}
          {!!error && <Text style={{ color: colors.danger, padding: 16 }}>{error}</Text>}
          {notices.map((notice) => (
            <View key={notice.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: notice.mentioned ? colors.warningSoft : 'transparent', paddingRight: 6 }}>
              <Pressable
                style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, paddingVertical: 12, opacity: pressed ? .7 : 1 })}
                onPress={() => {
                  void dismissChatNotification(notice.id).catch(() => undefined);
                  open({ channel: notice.channel, target: notice.channel === 'private' ? (notice.motoboyId === turn.queue?.motoboyId ? notice.recipientId : notice.motoboyId) : undefined }, notice.senderName);
                }}
              >
                <WaAvatar name={notice.senderName} size={48} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  {notice.mentioned && <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.warning }}>@ Mencionou voce</Text>}
                  <Text numberOfLines={1} style={{ fontFamily: 'ManropeExtraBold', fontSize: 16, color: wa.ink }}>{notice.senderName}</Text>
                  <Text numberOfLines={2} style={{ fontFamily: 'Manrope', fontSize: 14.5, color: wa.meta }}>{notice.body || 'Anexo recebido'}</Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Marcar aviso como lido" onPress={() => void dismissChatNotification(notice.id).then(() => setRefresh((n) => n + 1)).catch((e) => setError(String(e)))} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Check size={22} color={wa.send} /></Pressable>
            </View>
          ))}
          {!loading && !notices.length && <Text style={{ fontFamily: 'Manrope', fontSize: 14.5, color: wa.meta, textAlign: 'center', padding: 36 }}>Nenhum aviso pendente.</Text>}
        </ScrollView>
      </WaPage>
    );
  if (!target) {
    type ChatRow = { key: string; kind: string; name: string; title: string; text: string; at: number; unread: number; online?: boolean; onPress: () => void };
    const rows: ChatRow[] = [
      { key: 'group', kind: 'group', name: `Equipe · ${store}`, title: `Equipe · ${store}`, ...info('group', undefined, `${contactCount} pessoas · ${onlineCount} online`), onPress: () => open({ channel: 'group' }) },
      { key: 'store', kind: 'store', name: store, title: store, ...info('store', undefined, 'Atendimento da loja'), onPress: () => open({ channel: 'store' }) },
      ...orders.map((stop): ChatRow => ({ key: `client-${stop.pedidoId}`, kind: 'client', name: stop.pedido?.nomeCliente || 'Cliente', title: `${stop.pedido?.nomeCliente || 'Cliente'} · #${stop.pedidoId}`, ...info('client', stop.pedidoId, 'Pedido em andamento'),
        onPress: () => router.push({ pathname: '/conversas', params: { channel: 'client', pedidoId: String(stop.pedidoId) } }) })),
      ...colleagues.map((c): ChatRow => ({ key: `private-${c.motoboyId}`, kind: 'private', name: c.nome, title: c.nome, ...info('private', c.motoboyId, c.online ? 'Online' : 'Offline'), online: c.online, onPress: () => open({ channel: 'private', target: c.motoboyId }, c.nome) })),
    ];
    const visible = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => matches(`${row.title} ${row.name}`) && (filter === 'Todas' || (filter === 'Não lidas' ? row.unread > 0 : filter === 'Equipe' ? row.kind === 'group' || row.kind === 'store' : filter === 'Clientes' ? row.kind === 'client' : row.kind === 'private')))
      .sort((a, b) => b.row.at - a.row.at || a.index - b.index)
      .map(({ row }) => row);
    return (
      <WaPage
        header={<View style={{ paddingTop: insets.top, backgroundColor: wa.header }}><View style={{ height: 60, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6 }}>
          <Text accessibilityRole="header" style={{ flex: 1, fontFamily: 'ManropeExtraBold', fontSize: 27, letterSpacing: -.9, color: wa.ink }}>Conversas</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Notificacoes" onPress={() => router.push({ pathname: '/conversas', params: { view: 'notifications' } })} style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={23} color={wa.ink} />{notices.length > 0 && <View style={{ position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, backgroundColor: wa.send, borderWidth: 2, borderColor: wa.header }} />}
          </Pressable>
        </View></View>}
        footer={pageFooter}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 96 }} stickyHeaderIndices={[0]} onScroll={loadContactsOnScroll} scrollEventThrottle={200}>
          <View style={{ backgroundColor: wa.header, paddingTop: 2 }}>
            <WaSearch label="Buscar conversas" value={search} onChange={setSearch} placeholder="Pesquisar conversas" />
            <WaFilters options={['Todas', 'Não lidas', 'Equipe', 'Clientes', 'Colegas']} value={filter} onChange={setFilter} />
          </View>
          {visible.map((row) => <WaListRow key={row.key} name={row.name} title={row.title} preview={row.text} time={listTime(row.at)} unread={row.unread} online={row.online} onPress={row.onPress} />)}
          {!visible.length && !loading && rosterReady && <Text style={{ fontFamily: 'Manrope', fontSize: 14.5, color: wa.meta, textAlign: 'center', padding: 36 }}>{filter === 'Não lidas' ? 'Nenhuma conversa com mensagens não lidas.' : 'Nenhuma conversa encontrada.'}</Text>}
          {(loading || !rosterReady) && !error && !colleagues.length && !orders.length && <View style={{ padding: 16 }}><SkeletonRows rows={5} /></View>}
          {roster.loadingMore && <ActivityIndicator color={wa.meta} style={{ padding: 16 }} accessibilityLabel="Carregando contatos" />}
          {!!roster.error && <Pressable onPress={() => void roster.refresh()}><Text style={{ color: colors.danger, padding: 16 }}>{roster.error}</Text></Pressable>}
          {!!error && <Pressable onPress={() => setRefresh((n) => n + 1)}><Text style={{ color: colors.danger, padding: 16 }}>{error}</Text></Pressable>}
        </ScrollView>
        <WaFab icon={MessageSquarePlus} label="Nova conversa" bottom={20} onPress={() => router.push({ pathname: '/conversas', params: { view: 'contacts' } })} />
      </WaPage>
    );
  }
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
  const headerSubtitle = channel === 'group'
    ? `${contactCount} participantes · ${onlineCount} online`
    : channel === 'private'
      ? contacts.find((c) => c.motoboyId === target.target)?.online ? 'online' : 'offline'
      : 'Atendimento da loja';
  const atEnd = () => { follow.current = true; setAtBottom(true); setAway(0); scroll.current?.scrollToEnd({ animated: !theme.reducedMotion }); };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      style={{ flex: 1, minHeight: 0, backgroundColor: wa.wallpaper }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={{ width: '100%', maxWidth: 480, flex: 1, minHeight: 0, alignSelf: 'center' }}>
        {searching ? (
          <View style={{ paddingTop: insets.top, backgroundColor: wa.header, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: wa.divider }}>
            <View style={{ height: 58, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar busca" onPress={() => { setSearching(false); setSearch(''); }} style={{ width: 46, height: 48, alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={23} color={wa.ink} /></Pressable>
              <TextInput accessibilityLabel="Buscar mensagens" autoFocus placeholder="Pesquisar…" placeholderTextColor={wa.meta} value={search} onChangeText={setSearch} selectionColor={wa.send}
                style={{ flex: 1, minWidth: 0, fontFamily: 'Manrope', fontSize: 17, color: wa.ink, paddingVertical: 10, outlineStyle: 'none' } as never} />
              {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setSearch('')} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}><X size={20} color={wa.meta} /></Pressable>}
            </View>
          </View>
        ) : (
          <WaHeader
            title={name}
            subtitle={headerSubtitle}
            avatar={name}
            onBack={back}
            onTitle={channel === 'group' ? () => router.push({ pathname: '/conversas', params: { view: 'group' } }) : undefined}
            actions={[
              { icon: Search, label: 'Buscar mensagens', onPress: () => setSearching(true) },
              { icon: MoreVertical, label: 'Menu da conversa', onPress: () => setMenu((v) => !v) },
            ]}
          />
        )}
        {menu && (
          <>
            <Pressable accessibilityLabel="Fechar menu" onPress={() => setMenu(false)} style={[StyleSheet.absoluteFill, { zIndex: 8 }]} />
            <View style={{ position: 'absolute', zIndex: 9, top: insets.top + 50, right: 8, minWidth: 210, paddingVertical: 6, borderRadius: 12, backgroundColor: wa.header, boxShadow: '0 4px 18px #00000040' }}>
              {[
                { label: channel === 'group' ? 'Dados da equipe' : 'Contatos', run: () => router.push({ pathname: '/conversas', params: { view: channel === 'group' ? 'group' : 'contacts' } }) },
                { label: 'Buscar', run: () => setSearching(true) },
              ].map((item) => (
                <Pressable key={item.label} accessibilityRole="button" onPress={() => { setMenu(false); item.run(); }} style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, backgroundColor: pressed ? wa.divider : 'transparent' })}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 16, color: wa.ink }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {!!(error || queueError) && (
          <Pressable accessibilityRole="alert" onPress={() => setRefresh((n) => n + 1)} style={{ backgroundColor: colors.warningSoft, paddingVertical: 10, paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13.5, color: colors.warning }}>{error || queueError} · toque para tentar de novo</Text>
          </Pressable>
        )}
        <View style={{ flex: 1, minHeight: 0 }}>
          <ScrollView
            ref={scroll}
            style={{ flex: 1, minHeight: 0 }}
            keyboardShouldPersistTaps="handled"
            onLayout={() => { if (follow.current) scroll.current?.scrollToEnd({ animated: false }); }}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 10, flexGrow: 1 }}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              const near = contentSize.height - contentOffset.y - layoutMeasurement.height < 60;
              follow.current = near;
              setAtBottom((previous) => (previous === near ? previous : near));
              if (near) setAway((count) => (count ? 0 : count));
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => { if (follow.current) scroll.current?.scrollToEnd({ animated: false }); }}
          >
            {more && (
              <Pressable accessibilityLabel="Carregar mensagens anteriores" onPress={() => void loadOlder()} style={{ alignSelf: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: wa.chip }}>
                {older ? <ActivityIndicator color={wa.send} /> : <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 13, color: wa.send }}>Mensagens anteriores</Text>}
              </Pressable>
            )}
            {loading && !messages.length && <View style={{ paddingHorizontal: 12 }}><SkeletonBubbles /></View>}
            {!loading && !messages.length && !pending.length && (
              <View style={{ alignSelf: 'center', marginTop: 40, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: wa.chip }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13.5, color: wa.meta }}>Nenhuma mensagem nesta conversa.</Text>
              </View>
            )}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay = !previous || !sameDay(previous.createdAtUtc, message.createdAtUtc);
              const foreground = wa.ink;
              const continuation = continuesMessage(previous, message);
              const audioOnly = !!message.attachment?.contentType.startsWith('audio/') && !message.body;
              const metadata = <MessageMeta createdAtUtc={message.createdAtUtc} mine={message.mine} read={message.readCount > 0} />;
              const content = (
                <>
                  {!message.mine && !continuation && channel !== 'private' && <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 13.5, lineHeight: 19, color: senderTone(message.senderName, dark), marginBottom: 1 }}>{message.senderName}</Text>}
                  {message.replyTo && <ReplyQuote mine={message.mine} sender={message.replySender || 'Mensagem'} body={message.replyBody || 'Anexo'} onPress={() => { if (message.replyTo) void locate(message.replyTo); }} />}
                  {message.forwarded && <Text style={{ fontFamily: 'Manrope', fontStyle: 'italic', fontSize: 12.5, color: wa.meta, marginBottom: 3 }}>↪ Encaminhada</Text>}
                  {message.attachment && (
                    <ChatMedia
                      attachment={message.attachment}
                      foreground={foreground}
                      metadata={audioOnly ? metadata : undefined}
                      senderName={message.senderName}
                      avatarUri={contacts.find((c) => c.motoboyId === message.motoboyId)?.avatar}
                    />
                  )}
                  {!!message.body && <BubbleText body={message.body} foreground={foreground} metadata={metadata} />}
                  {!message.body && !audioOnly && <View style={{ marginTop: 2, alignSelf: 'flex-end' }}>{metadata}</View>}
                  {message.reactions.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                      {message.reactions.map((r) => {
                        const Icon = reactionIcons[r.reaction as keyof typeof reactionIcons] || ThumbsUp;
                        return (
                          <Pressable
                            key={r.reaction}
                            accessibilityLabel={`${r.reaction}: ${r.count}`}
                            onLongPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setSelected(message); }}
                            delayLongPress={350}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12, backgroundColor: wa.dark ? '#ffffff14' : '#0000000d' }}
                          >
                            {reactionIcons[r.reaction as keyof typeof reactionIcons] ? <Icon size={12} color={wa.send} /> : <Text style={{ fontSize: 15 }}>{r.reaction}</Text>}
                            <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 12, color: wa.ink }}>{r.count}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              );
              return (
                <React.Fragment key={message.id}>
                  {newDay && <WaChip>{dayLabel(message.createdAtUtc)}</WaChip>}
                  <SwipeReply onReply={() => setReply(message)}>
                    <MessageBubble
                      testID={`chat-bubble-${message.id}`}
                      mine={message.mine}
                      continuation={continuation}
                      highlightColor={message.mentioned || highlighted === message.id ? colors.warning : undefined}
                      onLayout={(event) => {
                        if (highlighted === message.id)
                          scroll.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 32), animated: !theme.reducedMotion });
                      }}
                      accessibilityLabel={`Mensagem de ${message.senderName}${message.mentioned ? ', mencionou voce' : ''}: ${message.body || 'anexo'}`}
                      onLongPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setSelected(message); }}
                    >
                      {message.mentioned ? <MentionMark>{content}</MentionMark> : content}
                    </MessageBubble>
                  </SwipeReply>
                </React.Fragment>
              );
            })}
            {pending.map((entry) => (
              <View key={entry.request.clientId} style={{ alignSelf: 'flex-end', marginTop: 8, marginHorizontal: 8, maxWidth: '84%', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, borderTopRightRadius: 0, backgroundColor: wa.outgoing, borderWidth: entry.state === 'failed' ? 1.5 : 0, borderColor: colors.danger, boxShadow: '0 1px 0.5px #0000002b' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 16, lineHeight: 22, color: wa.ink }}>
                  {entry.request.body || (entry.file?.contentType.startsWith('audio/') ? '🎤 Mensagem de voz' : '📷 Foto')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <Clock size={12} color={entry.state === 'failed' ? colors.danger : wa.meta} />
                  <Text style={{ fontFamily: 'Manrope', fontSize: 11.5, color: entry.state === 'failed' ? colors.danger : wa.meta }}>
                    {entry.state === 'sending' ? 'Enviando…' : entry.state === 'queued' ? 'Aguardando envio' : entry.error || 'Envio nao confirmado'}
                  </Text>
                </View>
                {entry.state !== 'sending' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <Pressable accessibilityLabel="Reenviar mensagem" onPress={() => void outbox.retry(entry.request.clientId).catch((e) => setError(String(e)))} style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' }}>
                      <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 13, color: wa.send }}>Reenviar</Text>
                    </Pressable>
                    <Pressable accessibilityLabel="Remover mensagem pendente" onPress={() => void outbox.remove(entry.request.clientId).catch((e) => setError(String(e)))} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={17} color={wa.meta} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          <WaScrollFab visible={!atBottom} count={away} bottom={12} onPress={atEnd} />
        </View>
        {forwarding && <ChatForwardSheet message={forwarding} outbox={outbox} onDismiss={() => setForwarding(null)} />}
        {selected && <ChatMessageActions onForward={() => { setForwarding(selected); setSelected(null); }} message={selected} senderName={selected.senderName} onDismiss={() => setSelected(null)} onReply={() => { setReply(selected); setSelected(null); }} onReact={emoji => void react(emoji)}
          onMention={channel === 'group' && selected.motoboyId && contacts.some(c => c.motoboyId === selected.motoboyId) ? () => { const person = contacts.find(c => c.motoboyId === selected.motoboyId)!; setDraft(text => text + '@' + person.nome + ' '); setMentions(current => [...current.filter(c => c.motoboyId !== person.motoboyId), person]); setSelected(null); } : undefined} />}
        <WaComposer
          value={draft}
          onChange={setDraft}
          onSend={() => void send()}
          onAttach={() => void attach()}
          onFocus={() => { follow.current = true; scroll.current?.scrollToEnd({ animated: false }); }}
          disabled={!ready || busy}
          busy={busy}
          editable={ready && restored && !busy}
          placeholder="Mensagem"
          keyboardVisible={keyboardVisible}
          audio={<AudioComposer disabled={!ready || busy} send={(file) => send('', file)} onError={setError} />}
          top={<>
            {reply && <WaReplyBar sender={reply.senderName} body={reply.body || 'Anexo'} onCancel={() => setReply(null)} />}
            {!!candidates.length && (
              <ScrollView horizontal contentContainerStyle={{ padding: 10, gap: 8 }} keyboardShouldPersistTaps="handled">
                {candidates.map((contact) => (
                  <Pressable
                    accessibilityLabel={`Mencionar ${contact.nome}`}
                    key={contact.motoboyId}
                    onPress={() => {
                      setDraft((current) => current.replace(/@([^@\n]*)$/, `@${contact.nome} `));
                      setMentions((current) => [...current.filter((c) => c.motoboyId !== contact.motoboyId), contact]);
                    }}
                    style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: wa.header, borderWidth: 1, borderColor: colors.warning }}
                  >
                    <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 13.5, color: colors.warning }}>@{contact.nome}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>}
          accessory={!draft ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 6, gap: 7, alignItems: 'center' }}>
              {(channel === 'store' ? ['Estou saindo', 'Cheguei à loja', 'Preciso de ajuda'] : channel === 'group' ? ['Boa noite, equipe!', 'Atenção no caminho'] : ['Como está o caminho?', 'Valeu!', 'Estou na loja']).map((text) => (
                <Pressable key={text} disabled={!ready || busy} onPress={() => setDraft(text)} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 16, backgroundColor: wa.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: wa.divider }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 13, color: wa.send }}>{text}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : undefined}
        />
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
    fontSize: Platform.OS === 'web' ? 16 : 11,
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
