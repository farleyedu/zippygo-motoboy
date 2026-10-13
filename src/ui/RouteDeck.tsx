import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Banknote, Bell, ChevronDown, ChevronRight, CircleCheck, KeyRound, MapPin, MessageCircle, Package, Route, ShieldCheck, Wallet } from 'lucide-react-native';
import { getOperationalOrder, type OperationalOrderDetail, type RouteStop } from '../../services/mobileApi';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { checklistItems } from '../delivery/checklistRules';
import { offerTotal, stopAddress } from '../delivery/offerDetails';
import { Button, Entrance, money, Pill, Surface, type } from './Kit';
import { useZippyTheme } from './theme';
import { OperationalNotice } from './OperationalNotice';

type Props = { open: boolean; height: number; bottom: number; stops: RouteStop[]; selectedId: number; busy: boolean; actionError: string; onSelect(id: number): void; onClose(): void; onOverview(): void; onOrder(id: number): void };
type Cached = { version: number; detail: OperationalOrderDetail };

const stageLabel = (stop: RouteStop, index: number) => index === 0 ? stop.pickedUpAtUtc ? 'Próxima entrega' : 'Conferir retirada' : 'Na sequência';
const paidOnline = (status?: string | null) => status === 'pago';

export function RouteDeck(props: Props) {
  const { colors, dark, reducedMotion } = useZippyTheme(), turn = useOperationalSession(), router = useRouter();
  const progress = useRef(new Animated.Value(0)).current, cache = useRef(new Map<number, Cached>()).current;
  const [detail, setDetail] = useState<OperationalOrderDetail | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const selected = props.stops.find(s => s.pedidoId === props.selectedId), selectedIndex = selected ? props.stops.indexOf(selected) : -1;
  const version = turn.queue?.version ?? 0, sessionId = turn.session?.sessionId;
  const close = useRef(props.onClose); close.current = props.onClose;

  // Somente translação e opacidade: ficam no thread nativo e não recalculam o layout do mapa por trás.
  useEffect(() => {
    if (reducedMotion) { progress.setValue(props.open ? 1 : 0); return; }
    const animation = Animated.spring(progress, { toValue: props.open ? 1 : 0, damping: 26, stiffness: 240, mass: .8, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [props.open, progress, reducedMotion]);

  // Pedido já visto abre na hora (cache); a atualização acontece em segundo plano, sem piscar.
  const load = useCallback((id: number, signal: AbortSignal, silent: boolean) => getOperationalOrder(id, signal).then(value => {
    cache.set(id, { version, detail: value }); return value;
  }).catch(failure => { if (!silent && !signal.aborted) throw failure; return null; }), [cache, version]);
  useEffect(() => {
    setError('');
    if (!props.open || !sessionId) { setDetail(null); return; }
    const id = selected?.pedidoId ?? props.stops[0]?.pedidoId;
    if (!id) { setDetail(null); return; }
    const hit = cache.get(id);
    if (selected) setDetail(hit?.detail ?? null);
    if (hit && hit.version === version && selected) return;
    const abort = new AbortController(); let alive = true;
    void load(id, abort.signal, !selected).then(value => { if (alive && selected && value) setDetail(value); })
      .catch(e => { if (alive && !abort.signal.aborted && !hit) setError(e instanceof Error ? e.message : 'Não foi possível carregar os itens.'); });
    return () => { alive = false; abort.abort(); };
  }, [props.open, selected?.pedidoId, props.stops[0]?.pedidoId, sessionId, version, retry, load, cache]);
  useEffect(() => { if (!sessionId) cache.clear(); }, [sessionId, cache]);

  const pan = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx), onPanResponderRelease: (_, g) => { if (g.dy > 35) close.current(); } }), []);
  const earnings = useMemo(() => offerTotal(props.stops), [props.stops]);
  const current = detail && selected && detail.id === selected.pedidoId ? detail : null;
  const subtitle = selected ? selected.pedido?.nomeCliente || 'Detalhes da entrega' : `${props.stops.length} ${props.stops.length === 1 ? 'parada' : 'paradas'}${earnings != null ? ` · ${money(earnings)} previstos` : ' · toque em um pedido'}`;
  const talk = useCallback((id: number) => router.push({ pathname: '/conversas', params: { channel: 'client', pedidoId: String(id) } }), [router]);

  return <Animated.View pointerEvents={props.open ? 'auto' : 'none'} accessibilityElementsHidden={!props.open} importantForAccessibility={props.open ? 'yes' : 'no-hide-descendants'}
    style={{ position: 'absolute', zIndex: 30, left: 10, right: 10, bottom: props.bottom, height: props.height, borderRadius: 28, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', boxShadow: dark ? '0 14px 36px #040a1688' : '0 14px 36px #14243e33', opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [props.height + props.bottom + 30, 0] }) }] }}>
    <View {...pan.panHandlers} style={{ flexShrink: 0, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.line }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Recolher rota completa" onPress={props.onClose} style={{ height: 24, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: colors.line }} /></Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 10 }}>
        {selected
          ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar à sequência da rota" onPress={props.onOverview} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft, opacity: pressed ? .7 : 1 })}><ArrowLeft size={20} color={colors.accent} /></Pressable>
          : <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Route size={22} color="#fff" /></View>}
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" numberOfLines={1} style={[type.title, { color: colors.ink, fontSize: 19 }]}>{selected ? `Pedido #${selected.pedidoId}` : 'Sua rota, de perto'}</Text>
          <Text numberOfLines={1} style={[type.small, { color: colors.muted, marginTop: 2 }]}>{subtitle}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhes da rota" onPress={props.onClose} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .6 : 1 })}><ChevronDown color={colors.muted} size={22} /></Pressable>
      </View>
    </View>
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {props.open && <OperationalNotice onInspectRoute={props.onOverview} />}
      {!selected ? <>
        {Platform.OS === 'web' && <Text style={[type.small, { color: colors.muted }]}>O mapa mostra a sequência. O percurso pelas ruas abre no Google Maps.</Text>}
        {props.stops.map((stop, index) => <StopCard key={stop.pedidoId} stop={stop} index={index} onPress={props.onSelect} />)}
        {!props.stops.length && <Text style={[type.body, { color: colors.muted }]}>Sua rota está livre. A próxima oferta aparecerá aqui no app.</Text>}
      </> : <Entrance key={selected.pedidoId}><View style={{ gap: 12 }}>
        <OrderHero stop={selected} index={selectedIndex} detail={current} total={props.stops.length} />
        <Destination stop={selected} detail={current} onTalk={() => talk(selected.pedidoId)} />
        {!current && !error && <Skeleton />}
        {!!error && <Surface><Text accessibilityRole="alert" style={[type.small, { color: colors.danger, marginBottom: 10 }]}>{error}</Text><Button secondary onPress={() => setRetry(n => n + 1)}>Carregar itens novamente</Button></Surface>}
        {current && <Bag detail={current} />}
        {current && <Checkout detail={current} stop={selected} />}
        {current && !current.isCurrent && <Text style={[type.small, { color: colors.muted, textAlign: 'center' }]}>A conferência abre quando este for o pedido atual da rota.</Text>}
      </View></Entrance>}
    </ScrollView>
    {selected && current?.isCurrent && <View style={{ padding: 14, paddingTop: 12, gap: 8, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.line }}>
      {!!props.actionError && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{props.actionError}</Text>}
      <Button icon={Package} loading={props.busy} onPress={() => props.onOrder(selected.pedidoId)}>{selected.pickedUpAtUtc ? 'Conferir entrega' : 'Conferir retirada'}</Button>
    </View>}
  </Animated.View>;
}

const StopCard = memo(function StopCard({ stop, index, onPress }: { stop: RouteStop; index: number; onPress: (id: number) => void }) {
  const { colors, dark, reducedMotion } = useZippyTheme(), first = index === 0, order = stop.pedido;
  const collect = order?.value != null && !paidOnline(order.statusPagamento), gain = stop.earnings?.amount;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ver pedido ${stop.pedidoId}, parada ${index + 1}`} onPress={() => onPress(stop.pedidoId)}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 20, backgroundColor: first ? colors.accentSoft : colors.card, borderWidth: 1, borderColor: first ? colors.accent + '70' : colors.line, boxShadow: dark ? undefined : '0 4px 12px #19365912', transform: [{ scale: pressed && !reducedMotion ? .98 : 1 }] })}>
    <View style={{ width: 40, height: 46, borderRadius: 14, backgroundColor: first ? colors.accent : colors.soft, borderWidth: 1, borderColor: first ? colors.accent : colors.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 19, color: first ? '#fff' : colors.accent }}>{index + 1}</Text></View>
    <View style={{ flex: 1, gap: 4 }}>
      <Text numberOfLines={1} style={{ fontFamily: 'ManropeExtraBold', fontSize: 13, color: colors.ink }}>#{stop.pedidoId} · {order?.nomeCliente || 'Cliente'}</Text>
      <Text numberOfLines={2} style={[type.small, { color: colors.muted }]}>{stopAddress(stop)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 }}>
        <Text style={[type.small, { fontSize: 11, fontWeight: '800', color: first ? colors.accent : colors.muted }]}>{stageLabel(stop, index)}</Text>
        {order?.value != null && <Pill tone={collect ? 'warning' : 'accent'} icon={collect ? Wallet : CircleCheck}>{collect ? `Receber ${money(order.value)}` : 'Pago online'}</Pill>}
      </View>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 6 }}>{gain != null && <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.success }}>+ {money(gain)}</Text>}<ChevronRight color={colors.accent} size={20} /></View>
  </Pressable>;
});

function OrderHero({ stop, index, detail, total }: { stop: RouteStop; index: number; detail: OperationalOrderDetail | null; total: number }) {
  const { colors } = useZippyTheme(), order = stop.pedido;
  const value = detail?.total ?? order?.value, pending = !paidOnline(detail?.statusPagamento ?? order?.statusPagamento) && value != null;
  const status = stop.status === 'en_route' ? 'em andamento' : 'na sequência';
  return <Surface hero style={{ padding: 18, borderRadius: 23 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Pill inverse icon={MapPin}>{`${index + 1}ª parada · ${status}`}</Pill>
      {total > 1 && <Text style={[type.eyebrow, { color: colors.heroMuted }]}>{index + 1} DE {total}</Text>}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={[type.eyebrow, { color: colors.heroMuted }]}>ENTREGAR PARA</Text>
        <Text numberOfLines={2} style={{ fontFamily: 'ManropeExtraBold', fontSize: 22, letterSpacing: -.8, color: colors.heroInk, marginTop: 5 }}>{detail?.nomeCliente || order?.nomeCliente || 'Cliente'}</Text>
      </View>
      {value != null && <View style={{ alignItems: 'flex-end' }}>
        <Text style={[type.eyebrow, { color: colors.heroMuted }]}>{pending ? 'RECEBER' : 'PAGO ONLINE'}</Text>
        <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 22, letterSpacing: -.9, color: colors.heroInk, marginTop: 5 }}>{money(value)}</Text>
      </View>}
    </View>
  </Surface>;
}

function Destination({ stop, detail, onTalk }: { stop: RouteStop; detail: OperationalOrderDetail | null; onTalk: () => void }) {
  const { colors } = useZippyTheme();
  const note = detail?.observacoes || stop.pedido?.observacoes, address = detail?.enderecoEntrega || stopAddress(stop);
  const area = [detail?.bairro || stop.pedido?.bairro, detail?.cidade || stop.pedido?.cidade].filter(Boolean).join(' · ');
  return <Surface style={{ gap: 13 }}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><MapPin size={20} color={colors.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[type.eyebrow, { color: colors.muted }]}>ENDEREÇO</Text>
        <Text style={[type.body, { color: colors.ink, fontWeight: '800', marginTop: 3 }]}>{address}</Text>
        {!!area && !address.includes(area) && <Text style={[type.small, { color: colors.muted }]}>{area}</Text>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Falar com o cliente deste pedido" onPress={onTalk} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, opacity: pressed ? .7 : 1 })}><MessageCircle size={19} color={colors.accent} /></Pressable>
    </View>
    {!!note && <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.warningSoft }}>
      <Bell size={16} color={colors.warning} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 11, color: colors.warning }}>Na hora de entregar</Text><Text style={[type.small, { color: colors.ink, marginTop: 3 }]}>{note}</Text></View>
    </View>}
  </Surface>;
}

function ItemPhoto({ uri }: { uri?: string | null }) {
  const { colors } = useZippyTheme(), [failed, setFailed] = useState(false);
  if (uri && !failed) return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: 56, height: 56, borderRadius: 15, backgroundColor: colors.soft }} />;
  return <View style={{ width: 56, height: 56, borderRadius: 15, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Package size={25} color={colors.accent} /></View>;
}

function Bag({ detail }: { detail: OperationalOrderDetail }) {
  const { colors } = useZippyTheme();
  const extras = useMemo(() => checklistItems(detail.checklist).filter(i => i.extra), [detail.checklist]);
  const count = detail.itens.reduce((sum, item) => sum + (item.quantidade || 1), 0);
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
      <Text accessibilityRole="header" style={{ fontFamily: 'ManropeExtraBold', fontSize: 15, letterSpacing: -.3, color: colors.ink }}>O que vai na bag</Text>
      <Pill icon={Package}>{`${count} ${count === 1 ? 'item' : 'itens'}`}</Pill>
    </View>
    {extras.length > 0 && <View style={{ padding: 14, borderRadius: 16, backgroundColor: colors.warningSoft, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><ShieldCheck size={15} color={colors.warning} /><Text style={{ fontFamily: 'ManropeExtraBold', color: colors.warning, fontSize: 12 }}>Atenção na bag</Text></View>
      {extras.map(item => <Text key={item.key} style={[type.small, { color: colors.ink }]}>{item.quantity}× {item.name}</Text>)}
    </View>}
    {!!detail.capaImagemUrl && <Image source={{ uri: detail.capaImagemUrl }} style={{ height: 110, borderRadius: 18, width: '100%', backgroundColor: colors.soft }} resizeMode="cover" />}
    <Surface style={{ padding: 4, paddingHorizontal: 14 }}>
      {detail.itens.map((item, i) => <View key={item.itemId || i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: colors.line }}>
        <ItemPhoto uri={item.imagemUrl} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, lineHeight: 17, color: colors.ink }}>{item.quantidade}× {item.nome}</Text>
          {!!item.observacao && <Text style={[type.small, { color: colors.warning, fontSize: 11 }]}>{item.observacao}</Text>}
          {item.adicionais.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>{item.adicionais.map((extra, n) => <View key={n} style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.soft }}><Text style={[type.small, { color: colors.muted, fontSize: 10, lineHeight: 14 }]}>{extra.quantidade || 1}× {extra.nome}</Text></View>)}</View>}
        </View>
      </View>)}
      {!detail.itens.length && <Text style={[type.small, { color: colors.muted, paddingVertical: 14 }]}>A loja não detalhou os itens. Confira o conteúdo e as sacolas na retirada.</Text>}
    </Surface>
  </View>;
}

function Row({ icon: Icon, label, children }: { icon: typeof Wallet; label: string; children: React.ReactNode }) {
  const { colors } = useZippyTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 34 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 }}><Icon size={16} color={colors.muted} /><Text style={[type.small, { color: colors.muted }]}>{label}</Text></View>{children}
  </View>;
}

function Checkout({ detail, stop }: { detail: OperationalOrderDetail; stop: RouteStop }) {
  const { colors } = useZippyTheme(), paid = paidOnline(detail.statusPagamento), gain = stop.earnings?.amount;
  const value = (text: string, tone?: string) => <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: tone || colors.ink, textAlign: 'right', flexShrink: 1 }}>{text}</Text>;
  return <View style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={{ fontFamily: 'ManropeExtraBold', fontSize: 15, letterSpacing: -.3, color: colors.ink, marginTop: 6 }}>Na conferência da entrega</Text>
    <Surface style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 6 }}>
        <View style={{ flexShrink: 1 }}><Text style={[type.small, { color: colors.muted }]}>{paid ? 'Pago pelo cliente' : 'Valor a receber'}</Text><Text style={[type.small, { color: colors.muted, fontSize: 10 }]}>{paid ? 'Pagamento online confirmado' : 'Conferir o recebimento na finalização'}</Text></View>
        <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 24, letterSpacing: -1, color: colors.ink }}>{detail.total == null ? 'Não informado' : money(detail.total)}</Text>
      </View>
      <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
      <Row icon={paid ? CircleCheck : Banknote} label={paid ? 'Pagamento' : 'Forma prevista'}>{value(paid ? 'Recebido' : detail.formaPagamento || 'A conferir', paid ? colors.success : colors.warning)}</Row>
      {!paid && detail.troco != null && detail.troco > 0 && <Row icon={Banknote} label="Cliente paga com">{value(money(detail.troco))}</Row>}
      <Row icon={KeyRound} label="Código de entrega">{value(detail.requerCodigoEntrega ? 'Obrigatório' : 'Dispensado', detail.requerCodigoEntrega ? colors.warning : colors.success)}</Row>
      {gain != null && <Row icon={Wallet} label="Sua taxa de entrega">{value(`+ ${money(gain)}`, colors.success)}</Row>}
    </Surface>
  </View>;
}

function Skeleton() {
  const { colors } = useZippyTheme();
  return <View accessibilityLabel="Carregando itens do pedido" accessibilityRole="progressbar" style={{ gap: 10 }}>
    {[88, 72, 72].map((height, i) => <View key={i} style={{ height, borderRadius: 18, backgroundColor: colors.soft, opacity: 1 - i * .25 }} />)}
  </View>;
}
