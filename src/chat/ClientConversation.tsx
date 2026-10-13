import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
  Clock,
  Package,
  Search,
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
import { StatusBar } from 'expo-status-bar';
import { dayLabel, sameDay, SwipeReply, useWa, WaChip, WaComposer, WaHeader, WaReplyBar, WaScrollFab } from './WaKit';
import { previewKey, rememberPreview } from './chatPreview';
import { ChatMessageActions } from './ChatMessageActions';
import { ChatForwardSheet } from './ChatForwardSheet';
import * as Haptics from 'expo-haptics';
import { SkeletonBubbles } from '../ui/Skeleton';

// Última conversa vista por pedido: abre instantânea e confere a rede em seguida.
const clientSnapshots = new Map<string, { data: ClientRichChat; messages: ClientRichChat['messages'] }>();
import { useZippyTheme } from '../ui/theme';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { AudioComposer, ChatMedia } from './ChatMedia';
import { BubbleText, continuesMessage, MessageBubble, MessageMeta, ReplyQuote } from './MessageBubble';
import { retainChatFile } from './media';
import { useChatOutbox } from './useChatOutbox';
import { browserNativeTest } from '../../services/browserNativeTest';
import { subscribeChatEvents } from '../../services/chatEvents';
import { isAppForeground, useAppForeground } from '../hooks/useAppForeground';

// O aviso em tempo real (SignalR) traz a mensagem nova na hora; a busca periodica e so reserva
// para quando a conexao em tempo real cai.
const FALLBACK_POLL_MS = 30000;
const sameMessages = (a: ClientRichChat['messages'], b: ClientRichChat['messages']) =>
  a.length === b.length &&
  a.every((m, i) => m.id === b[i].id && m.status === b[i].status && m.body === b[i].body && (m.reactions?.length ?? 0) === (b[i].reactions?.length ?? 0));

const reasons: Record<string, string> = {
  ifood: 'Este cliente deve ser contatado pelo canal do iFood.',
  sem_conversa: 'O cliente ainda nao iniciou uma conversa com a loja.',
  nunca_escreveu: 'O cliente precisa iniciar a conversa no WhatsApp da loja.',
  janela_fechada: 'A janela do WhatsApp encerrou. Fale com a loja.',
};
export default function ClientConversation() {
  const foreground = useAppForeground();
  const keyboardVisible = useKeyboardVisible();
  const params = useLocalSearchParams<{ pedidoId?: string }>(),
    pedidoId = Number(params.pedidoId),
    router = useRouter(),
    insets = useSafeAreaInsets(),
    theme = useZippyTheme(),
    { colors, dark } = theme,
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
  const scope = `${owner}:${turn.session?.sessionId}:${pedidoId}`, saved = clientSnapshots.get(scope);
  const [data, setData] = useState<ClientRichChat | null>(() => saved?.data ?? null),
    [messages, setMessages] = useState<ClientRichChat['messages']>(() => saved?.messages ?? []),
    [draft, setDraft] = useState(''),
    [restoredDraftKey, setRestoredDraftKey] = useState<string | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!saved),
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
  const live = useRef(scope);
  live.current = scope;
  const scroll = useRef<ScrollView>(null),
    follow = useRef(true),
    sending = useRef(false);
  const draftKey = `zippygo.chat.draft.v2:${owner}:client:${pedidoId}`;
  const draftReady = !!owner && restoredDraftKey === draftKey;
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
    setRestoredDraftKey(null);
    setReply(null);
    void AsyncStorage.getItem(draftKey).then(
      (raw) => {
        if (alive) {
          setDraft(raw || '');
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
    follow.current = true;
    const hit = clientSnapshots.get(scope);
    setMessages(hit?.messages ?? []); setSelected(null); setForwarding(null); setReply(null);
    setData(hit?.data ?? null); setSearch(''); setSearching(false); setLoading(!hit);
    loadedQuery.current = hit ? `${scope}:` : '';
  }, [scope]);
  useEffect(() => {
    if (data && messages.length && loadedQuery.current === `${scope}:`) {
      if (clientSnapshots.size >= 30) clientSnapshots.delete(clientSnapshots.keys().next().value as string);
      clientSnapshots.delete(scope); clientSnapshots.set(scope, { data, messages });
    }
  }, [data, messages, scope]);
  useEffect(() => {
    if (!keyboardVisible) return;
    follow.current = true;
    const frame = requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
    const timer = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 180);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [keyboardVisible]);
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
      if (!foreground) return;
      let alive = true,
        inFlight = false;
      const abort = new AbortController();
      const load = async () => {
        if (inFlight || !alive || !isAppForeground()) return;
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
          setMessages((current) => {
            const merged = Array.from(
              new Map(
                [...(replace ? [] : current), ...result.messages].map((m) => [
                  m.id,
                  m,
                ]),
              ).values(),
            ).sort(
              (a, b) => Date.parse(a.createdAtUtc) - Date.parse(b.createdAtUtc),
            );
            // Resposta igual a que ja esta na tela: mantem a mesma lista e evita redesenhar todas as bolhas.
            return sameMessages(current, merged) ? current : merged;
          });
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
      const timer = setInterval(() => void load(), FALLBACK_POLL_MS);
      const unsubscribe = subscribeChatEvents((event) => {
        if (event.channel === 'client' && event.threadKey === `client:${pedidoId}`) void load();
      });
      return () => {
        alive = false;
        abort.abort();
        clearInterval(timer);
        unsubscribe();
      };
    }, [scope, refresh, pedidoId, search, searching, foreground]),
  );
  const send = async (body = draft, file?: LocalChatFile) => {
    if (sending.current || !ready || !data?.channel.podeReceber) {
      if (file) throw new Error('Aguarde a conversa ficar disponível para enviar o anexo.');
      return;
    }
    sending.current = true;
    setBusy(true);
    const before = live.current;
    try {
      const saved = file ? await retainChatFile(file) : undefined;
      if (before !== live.current) throw new Error('A conversa mudou. Retome o envio do anexo.');
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
      if (file) throw e;
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
  const wa = useWa();
  const [atBottom, setAtBottom] = useState(true), [away, setAway] = useState(0), lastCount = useRef(0);
  useEffect(() => {
    const added = messages.length - lastCount.current; lastCount.current = messages.length;
    if (added > 0 && !follow.current) setAway((count) => count + added);
  }, [messages.length]);
  useEffect(() => { rememberPreview(previewKey(owner, 'client', pedidoId), messages.at(-1), false); }, [messages, owner, pedidoId]);
  const atEnd = () => { follow.current = true; setAtBottom(true); setAway(0); scroll.current?.scrollToEnd({ animated: !theme.reducedMotion }); };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      style={{ flex: 1, minHeight: 0, backgroundColor: wa.wallpaper }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        {searching ? (
          <View style={{ paddingTop: insets.top, backgroundColor: wa.header, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: wa.divider }}>
            <View style={{ height: 58, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar busca" onPress={() => { setSearching(false); setSearch(''); }} style={{ width: 46, height: 48, alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={23} color={wa.ink} /></Pressable>
              <TextInput accessibilityLabel="Buscar mensagens do cliente" autoFocus value={search} onChangeText={setSearch} placeholder="Pesquisar…" placeholderTextColor={wa.meta} selectionColor={wa.send}
                style={{ flex: 1, minWidth: 0, fontFamily: 'Manrope', fontSize: 17, color: wa.ink, paddingVertical: 10, outlineStyle: 'none' } as never} />
              {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setSearch('')} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}><X size={20} color={wa.meta} /></Pressable>}
            </View>
          </View>
        ) : (
          <WaHeader
            title={name}
            subtitle={`Cliente · pedido #${pedidoId}`}
            avatar={name}
            onBack={() => router.back()}
            onTitle={() => router.push({ pathname: '/pedido/[id]', params: { id: String(pedidoId) } })}
            actions={[
              { icon: Search, label: 'Buscar mensagens', onPress: () => setSearching(true) },
              { icon: Package, label: 'Detalhes do pedido ' + pedidoId, onPress: () => router.push({ pathname: '/pedido/[id]', params: { id: String(pedidoId) } }) },
            ]}
          />
        )}
        {!!(error || queueError) && (
          <Text accessibilityRole="alert" style={{ fontFamily: 'Manrope', fontSize: 13.5, paddingVertical: 10, paddingHorizontal: 16, color: colors.danger, backgroundColor: colors.dangerSoft }}>{error || queueError}</Text>
        )}
        {data && !data.channel.podeReceber && (
          <View style={{ padding: 16, backgroundColor: colors.warningSoft }}>
            <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 15, color: colors.ink }}>Vamos pelo canal certo.</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13.5, lineHeight: 20, color: colors.warning, marginTop: 6 }}>{reasons[data.channel.motivo || ''] || 'Este canal nao permite envio.'}</Text>
            <Pressable accessibilityLabel="Pedir ajuda a loja" onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store', pedidoId: String(pedidoId) } })} style={{ marginTop: 10, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 14, color: colors.accent }}>Pedir ajuda à loja</Text>
            </Pressable>
          </View>
        )}
        <View style={{ flex: 1, minHeight: 0 }}>
          <ScrollView
            ref={scroll}
            style={{ flex: 1, minHeight: 0 }}
            onLayout={() => { if (follow.current) scroll.current?.scrollToEnd({ animated: false }); }}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 10, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
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
            {loading && !messages.length && <View style={{ paddingHorizontal: 12 }}><SkeletonBubbles /></View>}
            {data?.hasMore && (
              <Pressable accessibilityLabel="Carregar mensagens anteriores" onPress={() => void loadOlder()} style={{ alignSelf: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: wa.chip }}>
                <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 13, color: wa.send }}>{older ? 'Carregando…' : 'Mensagens anteriores'}</Text>
              </Pressable>
            )}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay = !previous || !sameDay(previous.createdAtUtc, message.createdAtUtc);
              const fg = wa.ink;
              const continuation = continuesMessage(previous, message);
              const quoted = messages.find(original => original.id === message.replyTo);
              const audioOnly = !!message.attachment?.contentType.startsWith('audio/') && !message.body;
              const metadata = <MessageMeta createdAtUtc={message.createdAtUtc} mine={message.mine} read={['read', 'lida'].includes(message.status)} delivered={['delivered', 'entregue'].includes(message.status)} />;
              return (
                <React.Fragment key={message.id}>
                  {newDay && <WaChip>{dayLabel(message.createdAtUtc)}</WaChip>}
                  <SwipeReply enabled={!!data?.channel.podeReceber} onReply={() => setReply(message)}>
                    <MessageBubble
                      testID={`chat-bubble-${message.id}`}
                      mine={message.mine}
                      continuation={continuation}
                      onLongPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setSelected(message); }}
                      accessibilityLabel={`Mensagem de ${message.mine ? 'você' : name}: ${message.body || 'anexo'}`}
                    >
                      {message.replyTo && <ReplyQuote mine={message.mine} sender={quoted ? quoted.mine ? 'Você' : name : 'Mensagem anterior'} body={quoted?.body || (quoted?.attachment ? 'Anexo' : 'Mensagem fora deste histórico')} />}
                      {message.attachment && <ChatMedia attachment={message.attachment} foreground={fg} senderName={message.mine ? auth.user?.nome || 'Você' : name} metadata={audioOnly ? metadata : undefined} />}
                      {!!message.body && <BubbleText body={message.body} foreground={fg} metadata={metadata} />}
                      {!message.body && !audioOnly && <View style={{ marginTop: 2, alignSelf: 'flex-end' }}>{metadata}</View>}
                      {!!message.reactions?.length && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                          {message.reactions.map((reaction) => {
                            const Icon = reaction.reaction === 'like' ? ThumbsUp : reaction.reaction === 'heart' ? Heart : reaction.reaction === 'alert' ? TriangleAlert : Check;
                            return (
                              <View key={reaction.reaction} accessibilityLabel={`${reaction.reaction}: ${reaction.count}`} style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12, backgroundColor: wa.dark ? '#ffffff14' : '#0000000d' }}>
                                {['like', 'heart', 'check', 'alert'].includes(reaction.reaction) ? <Icon size={12} color={wa.send} /> : <Text style={{ fontSize: 15 }}>{reaction.reaction}</Text>}
                                <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 12, color: fg }}>{reaction.count}</Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </MessageBubble>
                  </SwipeReply>
                </React.Fragment>
              );
            })}
            {pending.map((entry) => (
              <View key={entry.request.clientId} style={{ alignSelf: 'flex-end', marginTop: 8, marginHorizontal: 8, maxWidth: '84%', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, borderTopRightRadius: 0, backgroundColor: wa.outgoing, boxShadow: '0 1px 0.5px #0000002b' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 16, lineHeight: 22, color: wa.ink }}>{entry.request.body || '📷 Anexo'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <Clock size={12} color={entry.state === 'failed' ? colors.danger : wa.meta} />
                  <Text style={{ fontFamily: 'Manrope', fontSize: 11.5, color: entry.state === 'failed' ? colors.danger : wa.meta }}>{entry.state === 'sending' ? 'Enviando…' : entry.error || 'Aguardando envio'}</Text>
                </View>
                {entry.state !== 'sending' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <Pressable accessibilityLabel="Conferir envio ao cliente" onPress={() => void outbox.retry(entry.request.clientId).catch((e) => setError(String(e)))} style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' }}>
                      <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 13, color: wa.send }}>Conferir envio</Text>
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
        {forwarding && <ChatForwardSheet message={{ ...forwarding, attachment: forwarding.attachment ? { ...forwarding.attachment, clientPedidoId: pedidoId } : undefined }} outbox={outbox} onDismiss={() => setForwarding(null)} />}
        {selected && <ChatMessageActions onForward={() => { setForwarding(selected); setSelected(null); }} message={selected} senderName={selected.mine ? auth.user?.nome || 'Você' : name} busy={reacting} onDismiss={() => setSelected(null)} onReply={() => { setReply(selected); setSelected(null); }}
          onReact={data?.channel.podeReceber ? emoji => { const before = live.current; setReacting(true); void reactClientChat(pedidoId, selected.id, emoji).then(() => { if (before === live.current) { setSelected(null); setRefresh(n => n + 1); } }).catch(e => { if (before === live.current) setError(String(e)); }).finally(() => { if (before === live.current) setReacting(false); }); } : undefined} />}
        {data?.channel.podeReceber && (
          <WaComposer
            value={draft}
            onChange={setDraft}
            onSend={() => void send()}
            onAttach={() => void attach()}
            onFocus={() => { follow.current = true; scroll.current?.scrollToEnd({ animated: false }); }}
            disabled={!ready || busy}
            busy={busy}
            editable={ready && draftReady && !busy}
            placeholder="Mensagem"
            keyboardVisible={keyboardVisible}
            audio={(Platform.OS !== 'web' || browserNativeTest) ? <AudioComposer disabled={!ready || busy} send={(file) => send('', file)} onError={setError} /> : <View style={{ width: 48, height: 48 }} />}
            top={reply ? <WaReplyBar sender={reply.mine ? 'Você' : name} body={reply.body || 'Anexo'} onCancel={() => setReply(null)} /> : undefined}
            accessory={!draft ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 6, gap: 7, alignItems: 'center' }}>
                {['Estou chegando', 'Cheguei!', 'Estou na portaria'].map((text) => (
                  <Pressable key={text} disabled={!ready || busy} onPress={() => setDraft(text)} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 16, backgroundColor: wa.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: wa.divider }}>
                    <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 13, color: wa.send }}>{text}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : undefined}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
