import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCheck, ChevronRight, MessageCircle, Moon, Package, RefreshCw, Search, Send, Store, Sun, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClientChat, getClientMessages, getGroupMessages, getOperationalQueue, getStoreMessages, markStoreMessagesRead, RouteStop, sendClientMessage, sendGroupMessage, sendStoreMessage } from '../services/mobileApi';
import { useAuth } from '../src/contexts/AuthContext';
import { Avatar, Button, Header, IconButton, Pill, Screen, SectionTitle, Surface, type } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

type Channel = 'store' | 'client' | 'group';
type Message = { id: string; body: string; mine: boolean; sender?: string | null; createdAtUtc: string; read?: boolean };
const channelReasons: Record<string, string> = { ifood: 'Este cliente deve ser contatado pelo canal do iFood.', sem_conversa: 'Este cliente ainda não possui uma conversa com a loja.', nunca_escreveu: 'O cliente precisa iniciar a conversa no WhatsApp da loja.', janela_fechada: 'A janela de atendimento do WhatsApp encerrou. Fale com a loja para continuar.' };

export default function Conversations() {
  const params = useLocalSearchParams<{ channel?: string; pedidoId?: string }>();
  const channel = (['store', 'client', 'group'].includes(params.channel ?? '') ? params.channel : null) as Channel | null;
  const pedidoId = Number(params.pedidoId); const router = useRouter(); const insets = useSafeAreaInsets();
  const { colors, dark, setPreference } = useZippyTheme(); const { estabelecimentoAtual } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [draft, setDraft] = useState(''); const [sending, setSending] = useState(false);
  const [client, setClient] = useState<ClientChat | null>(null); const [orders, setOrders] = useState<RouteStop[]>([]);
  const [search, setSearch] = useState(''); const [searching, setSearching] = useState(false); const [refresh, setRefresh] = useState(0);
  const scroll = useRef<ScrollView>(null); const autoFollow = useRef(true); const generation = useRef(0);
  const tenant = estabelecimentoAtual && ('id' in estabelecimentoAtual ? estabelecimentoAtual.id : estabelecimentoAtual.estabelecimentoId);
  const storageKey = `zippygo.chat.draft.v1:${tenant || 'none'}:${channel || 'list'}:${pedidoId || 'none'}`;
  useEffect(() => { let alive = true; setDraft(''); AsyncStorage.getItem(storageKey).then(value => { if (alive) setDraft(value || ''); }); return () => { alive = false; }; }, [storageKey]);
  useEffect(() => { if (!channel) return; const timeout = setTimeout(() => { void AsyncStorage.setItem(storageKey, draft); }, 350); return () => clearTimeout(timeout); }, [draft, storageKey, channel]);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController(); const currentGeneration = ++generation.current; let inFlight = false;
    const load = async (initial = false) => {
      if (inFlight) return; inFlight = true;
      try {
        let next: Message[] = [];
        if (!channel) { const queue = await getOperationalQueue(); if (currentGeneration === generation.current) setOrders([queue.current, ...queue.next].filter((stop): stop is RouteStop => !!stop)); }
        else if (channel === 'store') { const data = await getStoreMessages(controller.signal); next = data.map(m => ({ id: String(m.id), body: m.body, mine: m.direction === 'motoboy', createdAtUtc: m.createdAtUtc, read: !!m.readAtUtc })); }
        else if (channel === 'group') { const [data, queue] = await Promise.all([getGroupMessages(controller.signal), getOperationalQueue()]); next = data.map(m => ({ id: String(m.id), body: m.body, mine: m.senderType === 'motoboy' && m.motoboyId === queue.motoboyId, sender: m.motoboyNome || 'Loja', createdAtUtc: m.createdAtUtc })); }
        else { if (!Number.isSafeInteger(pedidoId) || pedidoId <= 0) throw new Error('Selecione um pedido para conversar com o cliente.'); const data = await getClientMessages(pedidoId, controller.signal); if (currentGeneration === generation.current) setClient(data); next = data.messages.map(m => ({ id: m.id, body: m.type === 'texto' || m.type === 'text' ? m.body : `Anexo recebido · ${m.type}`, mine: m.mine, createdAtUtc: m.createdAtUtc, read: m.status === 'read' || m.status === 'lida' })); }
        if (currentGeneration !== generation.current) return;
        next.sort((a, b) => new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime());
        setMessages(next); setError('');
        if (channel === 'store') void markStoreMessagesRead().catch(() => undefined);
        if (initial) autoFollow.current = true;
      } catch (caught) { if (currentGeneration === generation.current && !controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar a conversa.'); }
      finally { inFlight = false; if (currentGeneration === generation.current) setLoading(false); }
    };
    setLoading(true); setMessages([]); setClient(null); setError(''); void load(true);
    const timer = setInterval(() => void load(), 7000);
    return () => { generation.current++; controller.abort(); clearInterval(timer); };
  }, [channel, pedidoId, refresh]));
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  const store = estabelecimentoAtual?.nome || 'Estabelecimento'; const name = channel === 'client' ? client?.channel.clienteNome || `Cliente · #${pedidoId}` : channel === 'group' ? `Equipe · ${store}` : store;
  const canSend = channel !== 'client' || client?.channel.podeReceber === true;
  const reason = client?.channel.motivo ? channelReasons[client.channel.motivo] || 'Este canal está indisponível. Fale com a loja.' : '';
  const send = async (preset?: string) => {
    const text = (preset ?? draft).trim(); if (!text || sending || !channel || !canSend) return;
    const sendGeneration = generation.current; setSending(true); setError('');
    try {
      if (channel === 'store') await sendStoreMessage(text, Number.isSafeInteger(pedidoId) && pedidoId > 0 ? pedidoId : undefined);
      else if (channel === 'group') await sendGroupMessage(text); else await sendClientMessage(pedidoId, text);
      if (sendGeneration !== generation.current) return;
      if (!preset) { setDraft(''); await AsyncStorage.removeItem(storageKey); }
      autoFollow.current = true; setRefresh(value => value + 1);
    } catch (caught) { if (sendGeneration === generation.current) setError(caught instanceof Error ? caught.message : 'O envio não foi confirmado. Sua mensagem permanece no campo.'); }
    finally { setSending(false); }
  };
  if (!channel) return <Screen><Stack.Screen options={{ headerShown: false }} /><Header title="Conversas" subtitle="Sua equipe. Seu caminho." onBack={back} right={<IconButton icon={dark ? Sun : Moon} label="Alternar tema" onPress={() => void setPreference('dark', !dark)} />} />
    <Pressable onPress={() => router.push({ pathname: '/conversas', params: { channel: 'group' } })}><Surface hero style={{ padding: 18, borderRadius: 20 }}><View style={styles.row}><Users size={28} color="#c6e0ff" /><View style={{ flex: 1 }}><Text style={[type.title, { color: '#f3f7ff', fontSize: 15 }]}>Equipe · {store}</Text><Text style={[type.small, { color: '#c3d4ed', marginTop: 5 }]}>Grupo dos motoboys da loja</Text></View><ChevronRight size={18} color="#c6e0ff" /></View></Surface></Pressable>
    <SectionTitle>Atendimento</SectionTitle><Pressable onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store' } })}><Surface><View style={styles.row}><Avatar name={store} /><View style={{ flex: 1 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>{store}</Text><Text style={[type.small, { color: colors.muted }]}>Converse com a equipe do estabelecimento.</Text></View><MessageCircle size={18} color={colors.accent} /></View></Surface></Pressable>
    <SectionTitle>Clientes na sua rota</SectionTitle>{loading && <ActivityIndicator color={colors.accent} />}{error && <Surface><Text style={[type.body, { color: colors.danger }]}>{error}</Text><Button secondary onPress={() => setRefresh(value => value + 1)}>Atualizar</Button></Surface>}
    {!loading && !error && !orders.length && <Surface><Text style={[type.body, { color: colors.muted }]}>Os clientes aparecem aqui quando você tiver pedidos na rota.</Text></Surface>}
    {orders.map(stop => <Pressable key={stop.pedidoId} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'client', pedidoId: String(stop.pedidoId) } })} style={{ marginBottom: 9 }}><Surface><View style={styles.row}><Avatar name={stop.pedido?.nomeCliente || 'Cliente'} /><View style={{ flex: 1 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>{stop.pedido?.nomeCliente || 'Cliente'} · #{stop.pedidoId}</Text><Pill icon={Package}>Pedido em andamento</Pill></View><ChevronRight size={18} color={colors.muted} /></View></Surface></Pressable>)}
  </Screen>;
  const visible = search.trim() ? messages.filter(message => message.body.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))) : messages;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.paper }}><Stack.Screen options={{ headerShown: false }} />
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.line }}><Header title={name} subtitle={channel === 'client' ? 'WhatsApp do estabelecimento' : channel === 'group' ? 'Equipe do estabelecimento' : 'Atendimento da loja'} onBack={back} right={<IconButton icon={Search} label="Buscar nesta conversa" onPress={() => setSearching(value => !value)} />} />
      {searching && <TextInput accessibilityLabel="Buscar mensagens" placeholder="Buscar nesta conversa…" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={[type.body, { color: colors.ink, padding: 12, marginBottom: 12, backgroundColor: colors.soft, borderRadius: 12 }]} />}
    </View>
    {Number.isSafeInteger(pedidoId) && pedidoId > 0 && <Pressable onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: String(pedidoId) } })} style={[styles.row, { padding: 14, backgroundColor: colors.soft, borderBottomWidth: 1, borderColor: colors.line }]}><Package color={colors.accent} size={20} /><View style={{ flex: 1 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>Pedido #{pedidoId}</Text><Text style={[type.small, { color: colors.muted }]}>Ver destino e detalhes da entrega</Text></View><ChevronRight size={16} color={colors.accent} /></Pressable>}
    {error && <Pressable onPress={() => setRefresh(value => value + 1)} style={[styles.row, { backgroundColor: colors.warningSoft, padding: 12 }]}><RefreshCw size={15} color={colors.warning} /><Text style={[type.small, { color: colors.warning, flex: 1 }]}>{error} · Toque para atualizar</Text></Pressable>}
    {reason && <View style={{ padding: 13, backgroundColor: colors.warningSoft }}><Text style={[type.small, { color: colors.warning }]}>{reason}</Text></View>}
    <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }} keyboardShouldPersistTaps="handled" onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; autoFollow.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 60; }} scrollEventThrottle={100} onContentSizeChange={() => { if (autoFollow.current) scroll.current?.scrollToEnd({ animated: false }); }}>
      {loading && <ActivityIndicator color={colors.accent} />}{!loading && !messages.length && <View style={{ alignItems: 'center', paddingTop: 55 }}><View style={{ width: 65, height: 65, borderRadius: 22, backgroundColor: colors.soft, justifyContent: 'center', alignItems: 'center' }}><MessageCircle size={31} color={colors.accent} /></View><Text style={[type.title, { color: colors.ink, fontSize: 17, marginTop: 15 }]}>A conversa começa aqui.</Text><Text style={[type.small, { color: colors.muted, textAlign: 'center', marginTop: 7 }]}>{canSend ? 'Envie uma mensagem para combinar o próximo passo.' : 'Confira o canal disponível com a loja.'}</Text></View>}
      {visible.map(message => <View key={message.id} style={{ alignSelf: message.mine ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: message.mine ? dark ? '#276ce0' : '#dfeaff' : colors.card, borderWidth: 1, borderColor: message.mine ? dark ? '#65a1ff' : '#c4d9fa' : colors.line, padding: 13, borderRadius: 18, borderBottomRightRadius: message.mine ? 5 : 18, borderBottomLeftRadius: message.mine ? 18 : 5 }}>{message.sender && <Text style={[type.small, { color: message.mine && dark ? '#dbeaff' : colors.accent, fontWeight: '800', marginBottom: 5 }]}>{message.sender}</Text>}<Text style={[type.body, { color: message.mine && dark ? '#ffffff' : colors.ink }]}>{message.body}</Text><View style={[styles.row, { justifyContent: 'flex-end', marginTop: 7, gap: 5 }]}><Text style={{ fontFamily: 'Manrope', fontSize: 8, color: message.mine && dark ? '#e4eeff' : colors.muted }}>{new Date(message.createdAtUtc).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>{message.mine && <CheckCheck size={12} color={message.read ? message.mine && dark ? '#f2f8ff' : colors.accent : message.mine && dark ? '#bbd3fa' : colors.muted} />}</View></View>)}
    </ScrollView>
    {canSend && <><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 7, paddingBottom: 10 }}>{(channel === 'client' ? ['Estou chegando', 'Cheguei!', 'Estou na portaria'] : channel === 'store' ? ['Estou saindo', 'Cheguei à loja', 'Preciso de ajuda'] : ['Boa noite, equipe!', 'Cheguei à loja']).map(text => <Pressable key={text} disabled={sending} onPress={() => void send(text)} style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.soft, borderRadius: 20, padding: 10 }}><Text style={[type.small, { color: colors.accent }]}>{text}</Text></Pressable>)}</ScrollView>
      <View style={[styles.row, { paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 14), alignItems: 'flex-end' }]}><TextInput accessibilityLabel="Mensagem" placeholder="Escreva uma mensagem…" placeholderTextColor={colors.muted} value={draft} onChangeText={setDraft} editable={!sending} multiline maxLength={1000} style={[type.body, { flex: 1, maxHeight: 130, minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, color: colors.ink, padding: 13 }]} /><Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" disabled={sending || !draft.trim()} onPress={() => void send()} style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: '#276ce0', justifyContent: 'center', alignItems: 'center', opacity: sending || !draft.trim() ? .5 : 1 }}>{sending ? <ActivityIndicator color="#fff" /> : <Send size={21} color="#fff" />}</Pressable></View>
    </>}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10 } });
