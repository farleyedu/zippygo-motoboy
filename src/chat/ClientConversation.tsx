import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Package,
  Paperclip,
  Reply,
  Search,
  Send,
  Trash2,
  Heart,
  ThumbsUp,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import {
  ChatMessage,
  ChatTarget,
  ClientRichChat,
  listClientChat,
  LocalChatFile,
  reactClientChat,
} from '../../services/communicationApi';
import { createIdentifier } from '../../services/mobileApi';
import { useAuth } from '../contexts/AuthContext';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { AppNav } from '../ui/AccountKit';
import { ChatMessageActions } from './ChatMessageActions';
import { ChatForwardSheet } from './ChatForwardSheet';
import * as Haptics from 'expo-haptics';
import { Avatar } from '../ui/Kit';
import { useZippyTheme } from '../ui/theme';
import { AudioComposer, ChatMedia } from './ChatMedia';
import { retainChatFile } from './media';
import { useChatOutbox } from './useChatOutbox';
import { browserNativeTest } from '../../services/browserNativeTest';

const reasons: Record<string, string> = {
  ifood: 'Este cliente deve ser contatado pelo canal do iFood.',
  sem_conversa: 'O cliente ainda nao iniciou uma conversa com a loja.',
  nunca_escreveu: 'O cliente precisa iniciar a conversa no WhatsApp da loja.',
  janela_fechada: 'A janela do WhatsApp encerrou. Fale com a loja.',
};
export default function ClientConversation() {
  const params = useLocalSearchParams<{ pedidoId?: string }>(),
    pedidoId = Number(params.pedidoId),
    router = useRouter(),
    insets = useSafeAreaInsets(),
    { colors, dark } = useZippyTheme(),
    auth = useAuth(),
    turn = useOperationalSession();
  const tenant =
      auth.estabelecimentoAtual &&
      ('id' in auth.estabelecimentoAtual
        ? auth.estabelecimentoAtual.id
        : auth.estabelecimentoAtual.estabelecimentoId),
    owner = auth.user && tenant ? `${auth.user.id}:${tenant}` : null;
  const target = useMemo<ChatTarget>(
    () => ({ channel: 'client', pedidoId }),
    [pedidoId],
  );
  const [data, setData] = useState<ClientRichChat | null>(null),
    [messages, setMessages] = useState<ClientRichChat['messages']>([]),
    [draft, setDraft] = useState(''),
    [draftReady, setDraftReady] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(''),
    [searching, setSearching] = useState(false),
    [reply, setReply] = useState<ClientRichChat['messages'][number] | null>(
      null,
    ),
    [older, setOlder] = useState(false);
  const [selected, setSelected] = useState<
    ClientRichChat['messages'][number] | null
  >(null);
  const [reacting, setReacting] = useState(false);
  const [forwarding, setForwarding] = useState<ClientRichChat['messages'][number] | null>(null);
  const loadedQuery = useRef('');
  const scope = `${owner}:${turn.session?.sessionId}:${pedidoId}`,
    live = useRef(scope);
  live.current = scope;
  const scroll = useRef<ScrollView>(null),
    follow = useRef(true),
    sending = useRef(false);
  const draftKey = `zippygo.chat.draft.v2:${owner}:client:${pedidoId}`;
  const {
    outbox,
    entries,
    ready,
    error: queueError,
  } = useChatOutbox(owner, turn.session?.sessionId, () =>
    setRefresh((n) => n + 1),
  );
  useEffect(() => {
    let alive = true;
    setDraft('');
    setDraftReady(false);
    setReply(null);
    setMessages([]);
    setSelected(null); setForwarding(null);
    setData(null);
    setSearch('');
    setSearching(false);
    setLoading(true);
    loadedQuery.current = '';
    void AsyncStorage.getItem(draftKey).then(
      (raw) => {
        if (alive) {
          setDraft(raw || '');
          setDraftReady(true);
        }
      },
      () => {
        if (alive) setError('Nao foi possivel recuperar o rascunho.');
      },
    );
    return () => {
      alive = false;
    };
  }, [draftKey, scope]);
  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(draftKey, draft).catch(() =>
        setError('Nao foi possivel salvar o rascunho.'),
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, draftKey, draftReady]);
  useFocusEffect(
    useCallback(() => {
      let alive = true,
        inFlight = false;
      const abort = new AbortController();
      const load = async () => {
        if (inFlight) return;
        inFlight = true;
        try {
          if (!Number.isSafeInteger(pedidoId) || pedidoId <= 0)
            throw new Error('Selecione um pedido para conversar.');
          const result = await listClientChat(
            pedidoId,
            undefined,
            abort.signal,
            searching ? search : undefined,
          );
          if (!alive) return;
          const query = `${scope}:${searching ? search : ''}`;
          const replace = loadedQuery.current !== query;
          setData((previous) =>
            previous && !replace
              ? {
                  ...result,
                  hasMore: previous.hasMore,
                  cursor: previous.cursor,
                }
              : result,
          );
          setMessages((current) =>
            Array.from(
              new Map(
                [...(replace ? [] : current), ...result.messages].map((m) => [
                  m.id,
                  m,
                ]),
              ).values(),
            ).sort(
              (a, b) => Date.parse(a.createdAtUtc) - Date.parse(b.createdAtUtc),
            ),
          );
          loadedQuery.current = query;
          setError('');
        } catch (e) {
          if (alive && !abort.signal.aborted)
            setError(
              e instanceof Error ? e.message : 'Nao foi possivel carregar.',
            );
        } finally {
          inFlight = false;
          if (alive) setLoading(false);
        }
      };
      void load();
      const timer = setInterval(() => void load(), 8000);
      return () => {
        alive = false;
        abort.abort();
        clearInterval(timer);
      };
    }, [scope, refresh, pedidoId, search, searching]),
  );
  const send = async (body = draft, file?: LocalChatFile) => {
    if (sending.current || !ready || !data?.channel.podeReceber) return;
    sending.current = true;
    setBusy(true);
    const before = live.current;
    try {
      const saved = file ? await retainChatFile(file) : undefined;
      if (before !== live.current) return;
      await outbox.enqueue({
        target,
        request: {
          clientId: createIdentifier(),
          body: body.trim(),
          replyTo: reply?.id,
          mentions: [],
        },
        file: saved,
        createdAtUtc: new Date().toISOString(),
        state: 'queued',
      });
      if (before !== live.current) return;
      setDraft('');
      setReply(null);
      follow.current = true;
      void outbox.flush().catch((e) => setError(String(e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envio nao confirmado.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const attach = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        // iOS: desde o expo-image-picker 17 o padrao manteria HEIC; o chat envia JPG.
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic,
      });
      if (!picked.canceled)
        await send(draft, {
          uri: picked.assets[0].uri,
          name: picked.assets[0].fileName || 'foto.jpg',
          contentType: picked.assets[0].mimeType || 'image/jpeg',
        });
    } catch (e) {
      setError(String(e));
    }
  };
  const loadOlder = async () => {
    if (!data?.hasMore || !data.cursor || older) return;
    setOlder(true);
    follow.current = false;
    const before = live.current;
    try {
      const next = await listClientChat(
        pedidoId,
        data.cursor,
        undefined,
        searching ? search : undefined,
      );
      if (before !== live.current) return;
      setData(next);
      setMessages((current) =>
        Array.from(
          new Map(
            [...next.messages, ...current].map((m) => [m.id, m]),
          ).values(),
        ).sort(
          (a, b) => Date.parse(a.createdAtUtc) - Date.parse(b.createdAtUtc),
        ),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setOlder(false);
    }
  };
  const pending = entries.filter(
      (entry) =>
        entry.target.channel === 'client' && entry.target.pedidoId === pedidoId,
    ),
    name = data?.channel.clienteNome || `Cliente · #${pedidoId}`;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: dark ? '#111c30' : colors.paper }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 480,
          alignSelf: 'center',
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            backgroundColor: colors.card,
          }}
        >
          <Pressable
            accessibilityLabel="Voltar"
            onPress={() => router.back()}
            style={{ padding: 8 }}
          >
            <ArrowLeft size={18} color={colors.ink} />
          </Pressable>
          <Avatar name={name} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 12,
                fontWeight: '800',
                color: colors.ink,
              }}
            >
              {name}
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 9,
                color: colors.muted,
              }}
            >
              WhatsApp do estabelecimento
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Buscar mensagens"
            onPress={() => setSearching((v) => !v)}
            style={{ padding: 8 }}
          >
            <Search size={18} color={colors.ink} />
          </Pressable>
          <Pressable accessibilityLabel={'Detalhes do pedido ' + pedidoId} onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: String(pedidoId) } })} style={{ padding: 10, minHeight: 44 }}><Package size={19} color={colors.accent} /><Text style={{ color: colors.accent, fontSize: 9 }}>#{pedidoId}</Text></Pressable>
        </View>
        {searching && (
          <TextInput
            accessibilityLabel="Buscar mensagens do cliente"
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar mensagens…"
            placeholderTextColor={colors.muted}
            style={{ padding: 12, color: colors.ink }}
          />
        )}
        {!!(error || queueError) && (
          <Text
            accessibilityRole="alert"
            style={{ fontSize: 11, padding: 12, color: colors.danger }}
          >
            {error || queueError}
          </Text>
        )}
        {data && !data.channel.podeReceber && (
          <View style={{ padding: 16, backgroundColor: colors.warningSoft }}>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 15,
                fontWeight: '800',
                color: colors.ink,
              }}
            >
              Vamos pelo canal certo.
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 11,
                lineHeight: 18,
                color: colors.warning,
                marginTop: 8,
              }}
            >
              {reasons[data.channel.motivo || ''] ||
                'Este canal nao permite envio.'}
            </Text>
            <Pressable
              accessibilityLabel="Pedir ajuda a loja"
              onPress={() =>
                router.push({
                  pathname: '/conversas',
                  params: { channel: 'store', pedidoId: String(pedidoId) },
                })
              }
              style={{ marginTop: 12 }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: colors.accent,
                }}
              >
                Pedir ajuda à loja
              </Text>
            </Pressable>
          </View>
        )}
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
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
          {loading && <ActivityIndicator color={colors.accent} />}
          {data?.hasMore && (
            <Pressable
              accessibilityLabel="Carregar mensagens anteriores"
              onPress={() => void loadOlder()}
              style={{ padding: 12, alignSelf: 'center' }}
            >
              <Text style={{ fontSize: 10, color: colors.accent }}>
                {older ? 'Carregando…' : 'Mensagens anteriores'}
              </Text>
            </Pressable>
          )}
          {messages.map((message) => {
            const fg = message.mine && dark ? '#fff' : colors.ink;
            return (
              <Pressable
                key={message.id}
                delayLongPress={350}
                onLongPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setSelected(message); }}
                accessibilityLabel={`Mensagem do cliente: ${message.body || 'anexo'}`}
                style={{
                  maxWidth: '85%',
                  alignSelf: message.mine ? 'flex-end' : 'flex-start',
                  padding: 13,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: message.mine
                    ? dark
                      ? '#2872e3'
                      : '#c7d8ee'
                    : colors.card,
                }}
              >
                {message.replyTo && (
                  <Text
                    style={{
                      fontSize: 9,
                      color: fg,
                      borderLeftWidth: 2,
                      borderLeftColor: colors.accent,
                      paddingLeft: 7,
                      marginBottom: 8,
                    }}
                  >
                    Resposta a uma mensagem
                  </Text>
                )}
                {message.attachment && (
                  <ChatMedia attachment={message.attachment} foreground={fg} senderName={message.mine ? auth.user?.nome || 'Você' : name} />
                )}
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 11,
                    lineHeight: 18,
                    color: fg,
                  }}
                >
                  {message.body}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    gap: 4,
                    marginTop: 6,
                  }}
                >
                  <Text style={{ fontSize: 8, color: fg }}>
                    {new Date(message.createdAtUtc).toLocaleTimeString(
                      'pt-BR',
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </Text>
                  {message.mine &&
                    (['read', 'lida'].includes(message.status) ? (
                      <CheckCheck size={12} color={fg} />
                    ) : (
                      <Check size={12} color={fg} />
                    ))}
                </View>
                {!!message.reactions?.length && (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 6,
                    }}
                  >
                    {message.reactions.map((reaction) => {
                      const Icon =
                        reaction.reaction === 'like'
                          ? ThumbsUp
                          : reaction.reaction === 'heart'
                            ? Heart
                            : reaction.reaction === 'alert'
                              ? TriangleAlert
                              : Check;
                      return (
                        <View
                          key={reaction.reaction}
                          accessibilityLabel={`${reaction.reaction}: ${reaction.count}`}
                          style={{
                            flexDirection: 'row',
                            gap: 4,
                            alignItems: 'center',
                          }}
                        >
                          {['like', 'heart', 'check', 'alert'].includes(reaction.reaction) ? <Icon size={13} color={fg} /> : <Text style={{ fontSize: 16 }}>{reaction.reaction}</Text>}
                          <Text style={{ fontSize: 9, color: fg }}>
                            {reaction.count}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Pressable>
            );
          })}
          {pending.map((entry) => (
            <View
              key={entry.request.clientId}
              style={{
                alignSelf: 'flex-end',
                maxWidth: '85%',
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.accentSoft,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.ink }}>
                {entry.request.body || 'Anexo'}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color:
                    entry.state === 'failed' ? colors.danger : colors.muted,
                }}
              >
                {entry.state === 'sending'
                  ? 'Enviando…'
                  : entry.error || 'Aguardando envio'}
              </Text>
              {entry.state !== 'sending' && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <Pressable
                    accessibilityLabel="Conferir envio ao cliente"
                    onPress={() =>
                      void outbox
                        .retry(entry.request.clientId)
                        .catch((e) => setError(String(e)))
                    }
                  >
                    <Text style={{ fontSize: 10, color: colors.accent }}>
                      Conferir envio
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Remover mensagem pendente"
                    onPress={() =>
                      void outbox
                        .remove(entry.request.clientId)
                        .catch((e) => setError(String(e)))
                    }
                    style={{ padding: 10 }}
                  >
                    <Trash2 size={15} color={colors.muted} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
        {forwarding && <ChatForwardSheet message={{ ...forwarding, attachment: forwarding.attachment ? { ...forwarding.attachment, clientPedidoId: pedidoId } : undefined }} outbox={outbox} onDismiss={() => setForwarding(null)} />}
        {selected && <ChatMessageActions onForward={() => { setForwarding(selected); setSelected(null); }} message={selected} senderName={selected.mine ? auth.user?.nome || 'Você' : name} busy={reacting} onDismiss={() => setSelected(null)} onReply={() => { setReply(selected); setSelected(null); }}
          onReact={data?.channel.podeReceber ? emoji => { const before = live.current; setReacting(true); void reactClientChat(pedidoId, selected.id, emoji).then(() => { if (before === live.current) { setSelected(null); setRefresh(n => n + 1); } }).catch(e => { if (before === live.current) setError(String(e)); }).finally(() => { if (before === live.current) setReacting(false); }); } : undefined} />}
        {reply && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              backgroundColor: colors.soft,
            }}
          >
            <Reply size={15} color={colors.accent} />
            <Text
              style={{ flex: 1, fontSize: 10, color: colors.ink }}
              numberOfLines={2}
            >
              {reply.body}
            </Text>
            <Pressable
              accessibilityLabel="Cancelar resposta"
              onPress={() => setReply(null)}
              style={{ padding: 8 }}
            >
              <X size={16} color={colors.muted} />
            </Pressable>
          </View>
        )}
        {data?.channel.podeReceber && (
          <>
            <ScrollView
              horizontal
              style={{ flexGrow: 0, flexShrink: 0, height: 42 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                gap: 8,
                paddingBottom: 10,
                alignItems: 'flex-start',
              }}
            >
              {['Estou chegando', 'Cheguei!', 'Estou na portaria'].map(
                (text) => (
                  <Pressable
                    key={text}
                    disabled={!ready || busy}
                    onPress={() => setDraft(text)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.line,
                      borderRadius: 20,
                      padding: 9,
                    }}
                  >
                    <Text style={{ fontSize: 9, color: colors.accent }}>
                      {text}
                    </Text>
                  </Pressable>
                ),
              )}
            </ScrollView>
            <View
              style={{
                flexDirection: 'row',
                gap: 6,
                paddingHorizontal: 12,
                paddingBottom: 10,
                alignItems: 'flex-end',
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 19,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.card,
                }}
              >
                <Pressable
                  accessibilityLabel="Anexar foto"
                  disabled={!ready || busy}
                  onPress={() => void attach()}
                  style={{ padding: 10 }}
                >
                  <Paperclip size={18} color={colors.muted} />
                </Pressable>
                <TextInput
                  accessibilityLabel="Mensagem"
                  placeholder="Escreva uma mensagem…"
                  placeholderTextColor={colors.muted}
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={500}
                  editable={ready && !busy}
                  multiline
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 11,
                    lineHeight: 18,
                    flex: 1,
                    minHeight: 45,
                    maxHeight: 120,
                    color: colors.ink,
                    paddingVertical: 10,
                    paddingRight: 8,
                  }}
                />
              </View>
              {(Platform.OS !== 'web' || browserNativeTest) && (
                <AudioComposer
                  disabled={!ready || busy}
                  send={(file) => send('', file)}
                  onError={setError}
                />
              )}
              <Pressable
                accessibilityLabel="Enviar mensagem"
                disabled={!ready || busy || !draft.trim()}
                onPress={() => void send()}
                style={{
                  width: 42,
                  height: 45,
                  borderRadius: 16,
                  backgroundColor: '#2872e3',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !ready || busy || !draft.trim() ? 0.5 : 1,
                }}
              >
                <Send size={19} color="#fff" />
              </Pressable>
            </View>
          </>
        )}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 10) }}><AppNav active="chats" /></View>
      </View>
    </KeyboardAvoidingView>
  );
}
