import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Bell, Check, Clock, HelpCircle, Lock, Map, MapPin, MessageCircle, Moon, Navigation, Package, Phone, Route, ShieldCheck, Store, Sun } from 'lucide-react-native';
import { arriveCurrent, getOperationalOrder, OperationalOrderDetail, OrderItemDetail } from '../../services/mobileApi';
import { useAuth } from '../../src/contexts/AuthContext';
import { useOperationalSession } from '../../src/contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../../src/contexts/DeliveryCompletionContext';
import { Avatar, Button, Entrance, Feedback, Header, IconButton, money, Pill, Screen, SectionTitle, Surface, type } from '../../src/ui/Kit';
import { useZippyTheme } from '../../src/ui/theme';
import { openPreferredNavigation } from '../../services/navigation';

function ProductCard({ item }: { item: OrderItemDetail }) {
  const { colors } = useZippyTheme(); const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.imagemUrl]);
  return <Surface style={{ padding: 0, marginBottom: 10 }}>
    <View style={{ height: 174, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}>
      {item.imagemUrl && !failed ? <Image source={{ uri: item.imagemUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityLabel={item.nome} /> : <Package size={52} color={colors.accent} strokeWidth={1.2} />}
      <View style={{ position: 'absolute', top: 12, left: 13, backgroundColor: '#f9f6efe8', padding: 7, borderRadius: 8 }}><Text style={{ fontFamily: 'Manrope', fontSize: 10, fontWeight: '800', color: '#344567' }}>{item.quantidade} {item.quantidade === 1 ? 'UNIDADE' : 'UNIDADES'}</Text></View>
    </View>
    <View style={{ padding: 15 }}><View style={styles.row}><Text style={[styles.productName, { color: colors.ink, flex: 1 }]}>{item.nome}</Text><View style={{ padding: 7, borderRadius: 8, backgroundColor: colors.soft }}><Text style={[type.small, { color: colors.ink }]}>{item.quantidade}×</Text></View></View>
      {!!item.observacao && <Text style={[type.small, { color: colors.warning, marginTop: 7 }]}>{item.observacao}</Text>}
      {!!item.adicionais?.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>{item.adicionais.map((extra, i) => <View key={extra.id ?? `${extra.nome}-${i}`} style={{ backgroundColor: colors.soft, padding: 6, borderRadius: 6 }}><Text style={{ fontFamily: 'Manrope', fontSize: 11, color: colors.muted }}>{extra.nome}{extra.preco > 0 ? ` · ${money(extra.preco)}` : ''}</Text></View>)}</View>}
      <View style={[styles.row, { justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, marginTop: 12 }]}><Text style={[type.small, { color: colors.muted }]}>{item.precoUnitario == null ? 'Item do pedido' : `${money(item.precoUnitario)} por unidade`}</Text><Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '800', color: colors.ink }}>{money(item.total)}</Text></View>
    </View>
  </Surface>;
}

function Parcel() {
  const { reducedMotion } = useZippyTheme(); const focused = useIsFocused(); const offset = useRef(new Animated.Value(0)).current;
  const compact = useWindowDimensions().width < 360;
  useEffect(() => {
    if (reducedMotion || !focused) { offset.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([Animated.timing(offset, { toValue: -5, duration: 2400, useNativeDriver: true }), Animated.timing(offset, { toValue: 0, duration: 2400, useNativeDriver: true })]));
    animation.start(); return () => animation.stop();
  }, [focused, reducedMotion, offset]);
  return <View style={{ width: compact ? 84 : 104, height: 96, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: compact ? 78 : 93, height: 65, borderRadius: 50, borderWidth: 1, borderColor: '#88baff55', position: 'absolute', transform: [{ rotate: '-12deg' }] }} />
    <Animated.View style={{ width: 65, height: 65, borderRadius: 17, backgroundColor: '#aacaff', borderBottomWidth: 6, borderBottomColor: '#4d7fbc', alignItems: 'center', justifyContent: 'center', transform: [{ perspective: 550 }, { translateY: offset }, { rotateY: '-16deg' }, { rotateX: '11deg' }, { rotateZ: '-8deg' }] }}><Package size={39} color="#285895" strokeWidth={1.3} /></Animated.View>
  </View>;
}

export default function OrderDetails() {
  const params = useLocalSearchParams<{ id: string }>(); const id = Number(params.id);
  const router = useRouter(); const { estabelecimentoAtual } = useAuth(); const { colors, dark, setPreference } = useZippyTheme();
  const turn = useOperationalSession(), completion = useDeliveryCompletion();
  const compact = useWindowDimensions().width < 360;
  const [order, setOrder] = useState<OperationalOrderDetail | null>(null); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const tenant = estabelecimentoAtual && ('id' in estabelecimentoAtual ? estabelecimentoAtual.id : estabelecimentoAtual.estabelecimentoId);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController(); let alive = true; ++generation.current;
    setError(''); setOrder(null);
    if (!Number.isSafeInteger(id) || id <= 0) { setError('Pedido inválido. Volte ao mapa e selecione uma entrega.'); return; }
    getOperationalOrder(id, controller.signal).then(data => { if (alive) setOrder(data); }).catch(caught => { if (alive) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o pedido.'); });
    return () => { alive = false; ++generation.current; controller.abort(); };
  }, [id, refresh, tenant]));
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  const contact = (kind: 'client' | 'store') => router.push({ pathname: '/conversas', params: { channel: kind, pedidoId: String(id) } });
  const openMap = async () => {
    if (!order) return;
    const destination = order.latitude != null && order.longitude != null ? `${order.latitude},${order.longitude}` : [order.enderecoEntrega, order.cidade, order.estado].filter(Boolean).join(', ');
    if (!destination) { Alert.alert('Endereço indisponível', 'Fale com a loja para conferir o destino.'); return; }
    try { await openPreferredNavigation({latitude:order.latitude,longitude:order.longitude,address:destination}); } catch { Alert.alert('Não foi possível abrir a navegação', 'Tente novamente ou confira seu aplicativo de mapas.'); }
  };
  const arrive = async () => {
    if (!order || busy) return;
    try { completion.assertRouteMutationAllowed(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Confira a conclusão salva antes de registrar a chegada.'); return; }
    if (!order.isCurrent || order.isOffer) { router.push('/rota'); return; }
    if (!order.pickedUpAtUtc) { router.push('/retirada'); return; }
    if (order.arrivedAtUtc) { router.push('/chegadaEntrega'); return; }
    const session = turn.store.getSnapshot().session;
    if (!session) { setError('Recupere seu turno antes de registrar a chegada.'); return; }
    const sameSession = () => {
      const active = turn.store.getSnapshot().session;
      return active?.sessionId === session.sessionId && active.epoch === session.epoch;
    };
    const currentGeneration = generation.current;
    setBusy(true);
    try {
      const queue = await arriveCurrent(id);
      if (!sameSession()) return;
      turn.store.updateQueue(queue, session.sessionId);
      if (generation.current !== currentGeneration) return;
      const updated = await getOperationalOrder(id);
      if (generation.current !== currentGeneration || !sameSession()) return;
      setOrder(updated);
      if (!updated.isCurrent || !updated.arrivedAtUtc || turn.store.getSnapshot().queue?.current?.pedidoId !== id) { setError('A rota mudou. Confira o pedido atual antes de finalizar.'); return; }
      router.push('/chegadaEntrega');
    }
    catch (caught) { if (generation.current === currentGeneration) setError(caught instanceof Error ? caught.message : 'Não foi possível registrar a chegada.'); }
    finally { setBusy(false); }
  };
  const footerLabel = !order?.isCurrent || order?.isOffer ? 'Voltar à rota' : !order.pickedUpAtUtc ? 'Voltar à coleta' : order.arrivedAtUtc ? 'Conferir e finalizar' : 'Cheguei ao destino';
  const name = order?.nomeCliente || 'Cliente'; const step = order?.arrivedAtUtc ? 3 : order?.pickedUpAtUtc ? 2 : 0;
  const items = order?.itens ?? []; const quantity = items.reduce((sum, item) => sum + item.quantidade, 0);
  const paid = /^(pago|paid|aprovado|pago_online|settled)$/i.test(order?.statusPagamento?.trim() ?? '');
  const prediction = order?.previsaoEntrega ? new Date(order.previsaoEntrega) : null;
  const predictionLabel = prediction && Number.isFinite(prediction.getTime()) ? `Previsão · ${prediction.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Previsão não informada';
  return <Screen footer={order ? <Button onPress={() => void arrive()} icon={MapPin} loading={busy}>{footerLabel}</Button> : undefined}>
    <Stack.Screen options={{ headerShown: false }} />
    <Header title="Detalhes do pedido" subtitle={estabelecimentoAtual?.nome || 'Sua entrega'} onBack={back} right={<IconButton icon={dark ? Sun : Moon} label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onPress={() => { void setPreference('dark', !dark).catch(() => Alert.alert('Preferência não salva', 'Não foi possível salvar o tema. Tente novamente.')); }} />} />
    {!!error && <Feedback title="Não foi possível concluir" message={error} onRetry={() => setRefresh(value => value + 1)} />}
    {!order && !error && <Feedback title="Conferindo seu pedido…" message="Buscando os dados da sua entrega." loading />}
    {order && <>
      <Entrance><Surface hero style={{ borderRadius: 23, padding: 19 }}><View style={[styles.row, { justifyContent: 'space-between' }]}><Pill icon={Route} inverse>{`${order.position}ª parada${order.isOffer ? ' · Oferta' : ''}`}</Pill><Text style={{ fontFamily: 'Manrope', fontSize: 8, letterSpacing: 1.5, color: '#b8d1f3' }}>ZIPPY / DELIVERY</Text></View>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', marginVertical: 17 }]}><View style={{ flex: 1, minWidth: 100 }}><Text style={[type.eyebrow, { color: '#bfd0eb', fontSize: 10 }]}>PEDIDO</Text><Text style={{ fontFamily: 'Manrope', fontSize: compact ? 32 : 40, fontWeight: '800', letterSpacing: -2, color: '#f4f8ff', marginBottom: 8 }}>#{order.id}</Text><Text style={[type.small, { color: '#c9e1ff' }]}>● {order.isOffer ? 'Aguardando seu aceite' : order.arrivedAtUtc ? 'Você chegou ao destino' : order.pickedUpAtUtc ? 'A caminho' : 'Aguardando coleta'}</Text></View><View><Parcel /><View style={{ position: 'absolute', bottom: 4, right: 0, backgroundColor: '#e8f0ff', borderRadius: 12, padding: 9, transform: [{ rotate: '5deg' }] }}><Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '800', color: '#264a7f' }}>{items.length ? String(quantity).padStart(2, '0') : '?'}</Text><Text style={{ fontFamily: 'Manrope', fontSize: 8, letterSpacing: 1, color: '#264a7f' }}>ITENS</Text></View></View></View>
        <View style={[styles.row, { flexWrap: 'wrap', paddingTop: 12, borderTopWidth: 1, borderColor: '#bfd0eb35', justifyContent: 'space-between' }]}><View style={[styles.row, { flexShrink: 1 }]}><Clock size={13} color={colors.heroMuted} /><Text style={[type.small, { color: colors.heroMuted, flexShrink: 1 }]}>{predictionLabel}</Text></View><Pressable onPress={() => void openMap()} accessibilityRole="button" accessibilityLabel="Navegar até o cliente" style={[styles.row, { minHeight: 44 }]}><Navigation size={15} color={colors.heroInk} /><Text style={[type.small, { color: colors.heroInk, fontWeight: '800' }]}>Navegar</Text></Pressable></View>
      </Surface></Entrance>
      <View style={{ flexDirection: 'row', paddingVertical: 20 }}>{['Recebido', 'Na bag', 'A caminho', 'No destino'].map((label, i) => <View key={label} style={{ flex: 1, alignItems: 'center', gap: 7 }}>{i > 0 && <View style={{ position: 'absolute', height: 2, top: 13, left: '-50%', width: '100%', backgroundColor: i <= step ? colors.accent : colors.line }} />}<View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: i <= step ? colors.accent : colors.line, backgroundColor: i === step ? '#276be7' : i < step ? colors.accentSoft : colors.paper, alignItems: 'center', justifyContent: 'center' }}>{i < step ? <Check size={13} color={colors.accent} /> : <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: i === step ? '#ffffff' : colors.muted }}>{i + 1}</Text>}</View><Text style={{ fontFamily: 'Manrope', fontSize: 10, lineHeight: 16, maxWidth: '85%', textAlign: 'center', color: i === step ? colors.ink : colors.muted, fontWeight: i === step ? '800' : '400' }}>{label}</Text></View>)}</View>
      <Entrance delay={60}><Surface style={{ padding: 0, borderRadius: 20 }}><View style={[styles.row, { padding: 16 }]}><Avatar name={name} /><View style={{ flex: 1 }}><Text style={[type.eyebrow, { color: colors.muted, fontSize: 9 }]}>QUEM VAI RECEBER</Text><Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 4 }}>{name}</Text></View><IconButton icon={MessageCircle} label="Conversar com o cliente" onPress={() => contact('client')} /></View>
        <View style={[styles.row, { paddingHorizontal: 16, paddingBottom: 14, alignItems: 'flex-start' }]}><MapPin size={21} color={colors.accent} style={{ marginRight: 8 }} /><View style={{ flex: 1 }}><Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', color: colors.ink }}>{order.enderecoEntrega || [order.rua, order.numero].filter(Boolean).join(', ') || 'Endereço não informado'}</Text><Text style={[type.small, { color: colors.muted, marginTop: 4 }]}>{[order.bairro, order.cidade, order.estado].filter(Boolean).join(' · ')}</Text></View></View>
        {!!order.observacoes && <View style={[styles.row, { marginHorizontal: 13, marginBottom: 13, padding: 11, borderRadius: 12, backgroundColor: colors.warningSoft, alignItems: 'flex-start' }]}><Bell size={16} color={colors.warning} /><View style={{ flex: 1 }}><Text style={[type.small, { color: colors.warning, fontWeight: '800' }]}>Na hora de entregar</Text><Text style={[type.small, { color: colors.warning, marginTop: 3 }]}>{order.observacoes}</Text></View></View>}
        <Pressable onPress={() => void openMap()} accessibilityRole="button" style={[styles.row, { backgroundColor: colors.soft, minHeight: 44, padding: 13, borderTopWidth: 1, borderColor: colors.line }]}><Map size={15} color={colors.accent} /><Text style={[type.small, { fontWeight: '800', color: colors.accent }]}>Ver este destino no mapa</Text></Pressable>
      </Surface></Entrance>
      <SectionTitle right={items.length ? <Pill icon={Package}>{`${quantity} ${quantity === 1 ? 'item' : 'itens'}`}</Pill> : undefined}>O que vai na bag</SectionTitle>
      {items.length ? items.map((item, i) => <Entrance key={item.produtoId ?? `${item.nome}-${i}`} delay={i * 35}><ProductCard item={item} /></Entrance>) : <Surface><Text style={[type.body, { color: colors.muted }]}>Os itens não foram informados neste pedido. Confira os volumes com a loja.</Text></Surface>}
      <SectionTitle>Na conferência da entrega</SectionTitle><Surface><View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}><View style={{ flex: 1, minWidth: 110 }}><Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '800', color: colors.ink }}>{paid ? 'Pago pelo cliente' : 'Valor do pedido'}</Text><Text style={{ fontFamily: 'Manrope', fontSize: 10, color: colors.muted, marginTop: 5 }}>{paid ? 'Pagamento confirmado no pedido' : 'Conferir o recebimento na finalização'}</Text></View><Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -1 }}>{money(order.total)}</Text></View>
        <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 17 }} /><View style={[styles.row, { justifyContent: 'space-between' }]}><Text style={[type.small, { color: colors.ink, flex: 1 }]}>{order.formaPagamento || 'Forma não informada'}</Text><Pill tone={paid ? 'accent' : 'warning'} icon={paid ? Check : Clock}>{paid ? 'Recebido' : 'A conferir'}</Pill></View>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 13 }]}><View style={styles.row}><ShieldCheck size={16} color={colors.accent} /><Text style={[type.small, { color: colors.ink }]}>Código de entrega</Text></View><Pill tone={order.requerCodigoEntrega ? 'warning' : 'accent'} icon={order.requerCodigoEntrega ? Lock : Check}>{order.requerCodigoEntrega ? 'Obrigatório' : 'Dispensado'}</Pill></View>
        {order.troco != null && order.troco > 0 && <Text style={[type.small, { marginTop: 12, color: colors.warning }]}>Cliente pediu troco para {money(order.troco)}.</Text>}
        {order.taxaEntrega != null && <View style={[styles.row, { backgroundColor: colors.soft, borderRadius: 10, padding: 11, marginTop: 16, justifyContent: 'space-between' }]}><Text style={[type.small, { color: colors.accent }]}>Taxa de entrega do pedido</Text><Text style={[type.small, { color: colors.accent, fontWeight: '800' }]}>{money(order.taxaEntrega)}</Text></View>}
      </Surface>
      <SectionTitle>Fale com quem resolve</SectionTitle><View style={{ gap: 8 }}>{[['client', name, 'Cliente deste pedido'], ['store', estabelecimentoAtual?.nome || 'Estabelecimento', 'Atendimento da loja']].map(([kind, title, subtitle]) => <Pressable key={kind} onPress={() => contact(kind as 'client' | 'store')} accessibilityRole="button"><Surface style={{ padding: 11 }}><View style={styles.row}>{kind === 'client' ? <Avatar name={name} /> : <View style={{ width: 43, height: 43, borderRadius: 15, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }}><Store size={21} color={colors.warning} /></View>}<View style={{ flex: 1 }}><Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '800', color: colors.ink }}>{title}</Text><Text style={[type.small, { color: colors.muted, marginTop: 3 }]}>{subtitle}</Text></View><MessageCircle size={17} color={colors.accent} /></View></Surface></Pressable>)}</View>
      {order.telefoneCliente && <View style={{ marginTop: 12 }}><Button secondary icon={Phone} onPress={() => { const digits = order.telefoneCliente?.replace(/\D/g, ''); if (digits) void Linking.openURL(`tel:${digits}`).catch(() => Alert.alert('Não foi possível abrir o discador')); }}>Ligar para o cliente</Button></View>}
      <Pressable onPress={() => contact('store')} accessibilityRole="button" style={[styles.row, { minHeight: 44, paddingVertical: 18, justifyContent: 'center' }]}><HelpCircle size={16} color={colors.muted} /><Text style={[type.small, { color: colors.muted, flexShrink: 1 }]}>Preciso de ajuda com esta entrega</Text></Pressable>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 9 }, productName: { fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', letterSpacing: -.4 } });
