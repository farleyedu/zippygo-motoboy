import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Clock, EyeOff, LucideIcon, MapPin, Navigation, Package, Route, Store, Timer, TrendingUp, Wallet, X } from 'lucide-react-native';
import Mapa from '../../components/Mapa';
import { acceptOffer, queueToPedidos, rejectOffer } from '../../services/mobileApi';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { useRouteAction } from '../hooks/useRouteAction';
import { useZippyTheme } from './theme';
import { Button, Entrance, Gradient, money, Pill, type } from './Kit';
import { getStoreDestination, type StoreDestination } from '../../services/routeApi';
import { distanceMeters } from '../delivery/externalRoute';
import { offerTotal, stopAddress, stopEarnings } from '../delivery/offerDetails';
import { operationalDestination } from '../delivery/operationalDestination';
import { orderLabel } from '../delivery/ifoodRules';

// O mapa da oferta não usa o motor de navegação da rota em andamento.
export function OfferPrompt() {
  const turn = useOperationalSession(), completion = useDeliveryCompletion(), action = useRouteAction({ allowWithoutLocation: true });
  const { colors, reducedMotion } = useZippyTheme(), segments = useSegments(), router = useRouter(), insets = useSafeAreaInsets();
  const size = useWindowDimensions(), offer = turn.queue?.offer, [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<number[]>([]), [confirm, setConfirm] = useState<'accept' | 'reject' | null>(null);
  const [focusedId, setFocusedId] = useState<number | undefined>();
  const signature = turn.session?.sessionId + ':' + offer?.offerId + ':' + offer?.stops.map(s => s.pedidoId).join(',');
  const live = useRef(signature); live.current = signature;
  const selectionSignature = useRef('');
  useEffect(() => { selectionSignature.current = signature; setSelected(offer?.stops.map(s => s.pedidoId) || []); setFocusedId(undefined); setConfirm(null); action.clear(); }, [signature]);
  useEffect(() => { if (!offer) return; const timer = setInterval(() => setNow(Date.now()), 1000); setNow(Date.now()); return () => clearInterval(timer); }, [signature]);
  const seconds = offer ? Math.max(0, Math.ceil((Date.parse(offer.expiresAtUtc) - now) / 1000)) : 0;
  useEffect(() => { if (offer && seconds === 0) void turn.store.refreshQueue(); }, [offer?.offerId, seconds, turn.store]);
  const blocked = ['pending', 'sending'].includes(completion.draft?.phase || '');
  const visible = !!offer?.offerId && seconds > 0 && !!turn.session && !['offline', 'expired', 'ending'].includes(turn.phase)
    && turn.deferredOfferId !== offer.offerId && String(segments[0]) !== 'oferta';
  const canDefer = blocked || String(segments[0]) === 'mapa' && !!turn.queue?.current?.pickedUpAtUtc;
  useEffect(() => {
    if (!visible) return;
    Keyboard.dismiss();
    if (Platform.OS === 'web' && ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) (document.activeElement as HTMLElement).blur();
  }, [visible]);
  const chosen = offer?.stops.filter(s => selected.includes(s.pedidoId)) || [], total = offerTotal(chosen);
  const mapOrders = useMemo(() => turn.queue && offer ? queueToPedidos({
    ...turn.queue, offer: null, current: turn.queue.current,
    next: [...turn.queue.next, ...offer.stops.filter(s => s.pedidoId !== turn.queue?.current?.pedidoId && !turn.queue?.next.some(n => n.pedidoId === s.pedidoId))],
  }) : [], [offer, turn.queue?.current, turn.queue?.next]);
  const missingCoordinates = (offer?.stops.length || 0) - mapOrders.filter(p => offer?.stops.some(s => s.pedidoId === p.id) && p.coordinates).length;
  const previewPath = useMemo(() => mapOrders.flatMap(p => p.coordinates ? [p.coordinates] : []), [mapOrders]);
  const focusedStop = offer?.stops.find(s => s.pedidoId === focusedId);
  const resolve = async (accept: boolean) => {
    const snapshot = turn.store.getSnapshot(), before = signature;
    if (blocked || !offer?.offerId || action.busy || selectionSignature.current !== signature || snapshot.queue?.offer?.offerId !== offer.offerId || seconds <= 0) return;
    await action.run(() => accept ? acceptOffer(offer.offerId!, snapshot.queue?.version, selected) : rejectOffer('Recusada pelo motoboy', offer.offerId!), queue => {
      if (live.current === before) setConfirm(null);
      if (accept && !snapshot.queue?.current && !snapshot.queue?.next.length) router.replace(operationalDestination(queue, Platform.OS));
    });
    if (live.current === before) await turn.store.refreshQueue();
  };
  const defer = () => { if (canDefer && !action.busy) { setConfirm(null); turn.deferOffer(); } };
  const [store, setStore] = useState<StoreDestination | null>(null);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void getStoreDestination(controller.signal).then(setStore).catch(() => {});
    return () => controller.abort();
  }, [visible, offer?.offerId]);
  // Distâncias em linha reta, encadeadas pela ordem da oferta: loja → parada 1 → parada 2…
  const trip = useMemo(() => {
    const point = (la?: number | null, ln?: number | null) => { const lat = Number(la), lng = Number(ln); return la != null && ln != null && Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null; };
    let previous = point(store?.latitude as number, store?.longitude as number), km = 0, known = 0;
    const legs = (offer?.stops || []).map(stop => {
      if (!selected.includes(stop.pedidoId)) return null;
      const here = point(stop.pedido?.latitude, stop.pedido?.longitude);
      let leg: number | null = null;
      if (here && previous) leg = distanceMeters(previous, here) / 1000;
      else if (stop.earnings?.distanceKm != null) leg = stop.earnings.distanceKm;
      if (here) previous = here;
      if (leg != null) { km += leg; known++; }
      return leg;
    });
    const minutes = known ? Math.round(km * 1.25 / 22 * 60 + 3 * chosen.length) : null;
    return { legs, km: known === chosen.length && known > 0 ? km : known ? km : null, complete: known === chosen.length && known > 0, minutes };
  }, [offer?.stops, selected, store, chosen.length]);
  const perKm = total != null && trip.km && trip.complete ? total / trip.km : null;
  const km = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
  const lowTime = seconds <= 30;
  const budget = Math.max(60, (offer?.timeoutMinutes || 2) * 60);
  const bar = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const from = Math.min(1, seconds / budget);
    bar.setValue(from);
    const animation = Animated.timing(bar, { toValue: 0, duration: seconds * 1000, easing: Easing.linear, useNativeDriver: true });
    if (!reducedMotion) animation.start();
    return () => animation.stop();
  }, [visible, offer?.offerId, budget]);
  const mapHeight = Math.max(210, Math.min(380, size.height * .36));
  // Mesmo número do pin no mapa (as paradas já aceitas vêm antes).
  const stopNumber = (id: number, fallback: number) => { const at = mapOrders.findIndex(p => p.id === id); return at >= 0 ? at + 1 : fallback + 1; };
  return <Modal transparent visible={visible} animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={canDefer ? defer : () => setConfirm(null)} statusBarTranslucent>
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ height: mapHeight, overflow: 'hidden', backgroundColor: colors.soft }}>
        {visible && <Mapa pedidos={mapOrders} emEntrega={false} navigationEnabled={false} routePreview path={previewPath} view3D={false} sessionKey={'offer:' + offer?.offerId} selectedPedidoId={focusedId} onOrderPress={setFocusedId} />}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: Math.max(insets.top, 12) + 4, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={[styles.floating, { backgroundColor: colors.card }]}><MapPin size={14} color={colors.accent} /><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.ink }}>{offer?.stops.length || 0} {(offer?.stops.length || 0) === 1 ? 'parada' : 'paradas'}</Text></View>
          {canDefer && <Pressable accessibilityRole="button" accessibilityLabel="Ocultar por enquanto" disabled={action.busy} onPress={defer} style={[styles.floating, { backgroundColor: colors.card, minHeight: 40 }]}><EyeOff size={15} color={colors.muted} /><Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 12, color: colors.muted }}>Ocultar</Text></Pressable>}
        </View>
        {(missingCoordinates > 0 || !!focusedStop) && <View pointerEvents="none" style={[styles.floating, { position: 'absolute', left: 12, right: 12, bottom: 34, backgroundColor: colors.card, borderRadius: 14 }]}><Text accessibilityLiveRegion="polite" numberOfLines={2} style={{ flex: 1, fontFamily: 'Manrope', fontSize: 12, color: focusedStop ? colors.accent : colors.warning }}>{focusedStop ? 'Pin selecionado · #' + focusedStop.pedidoId + ' · ' + stopAddress(focusedStop) : missingCoordinates + ' pedido(s) sem coordenadas no mapa. Confira o endereço abaixo.'}</Text></View>}
      </View>
      <View style={{ flex: 1, minHeight: 0, marginTop: -22, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.card, overflow: 'hidden', boxShadow: '0 -8px 30px #08142633' }}>
        <View style={{ height: 4, backgroundColor: colors.line }}><Animated.View style={{ flex: 1, backgroundColor: lowTime ? colors.danger : colors.accent, transform: [{ scaleX: bar }], transformOrigin: 'left' } as never} /></View>
        <ScrollView style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 14 }}>
          <View style={styles.heading}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Route size={20} color={colors.accent} /></View>
            <Text accessibilityRole="header" style={{ flex: 1, fontFamily: 'ManropeExtraBold', fontSize: 20, letterSpacing: -.6, color: colors.ink }}>Nova rota</Text>
            <Pill icon={Clock} tone={lowTime ? 'danger' : 'warning'}>{Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' para responder'}</Pill>
          </View>
          <View style={styles.content}>
            <View style={[styles.earnings, { backgroundColor: colors.hero }]}>
              <Gradient colors={[colors.heroEnd, colors.hero]} glow />
              <Text style={[type.eyebrow, { color: colors.heroMuted, zIndex: 1 }]}>VOCÊ GANHA</Text>
              <View style={{ zIndex: 1 }}>{total == null ? <Text style={styles.amount}>Confira por pedido</Text> : <CountUp value={total} style={styles.amount} />}</View>
              <View style={styles.tiles}>
                <Tile icon={Navigation} label="distância" value={trip.km != null ? (trip.complete ? '' : '≥ ') + km(trip.km) : '—'} />
                <Tile icon={Package} label={chosen.length === 1 ? 'entrega' : 'entregas'} value={String(chosen.length)} />
                <Tile icon={Timer} label="tempo" value={trip.minutes != null ? trip.minutes + ' min' : '—'} />
                <Tile icon={TrendingUp} label="por km" value={perKm != null ? money(perKm) : '—'} />
              </View>
            </View>
            <Text style={[type.small, { color: colors.muted, marginTop: 8, marginBottom: 4 }]}>{total == null ? 'Pagamento por período ou ganho não informado: confira a regra de cada pedido. ' : 'Cada valor é gerado ao concluir o pedido. '}Distâncias em linha reta; o caminho pelas ruas pode ser maior.</Text>
            <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 10 }}>SEU CAMINHO · desmarque o que não quiser</Text>
            <View style={styles.timelineRow}>
              <View style={styles.rail}><View style={[styles.node, { backgroundColor: colors.hero }]}><Store size={14} color="#fff" /></View><View style={[styles.line, { backgroundColor: colors.line }]} /></View>
              <View style={{ flex: 1, paddingBottom: 14 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 14, color: colors.ink }}>Retirada · {store?.nome || 'Estabelecimento'}</Text><Text numberOfLines={1} style={[type.small, { color: colors.muted }]}>{[store?.rua, store?.numero, store?.bairro].filter(Boolean).join(', ') || 'Ponto de coleta da loja'}</Text></View>
            </View>
            {offer?.stops.map((stop, index) => {
              const on = selected.includes(stop.pedidoId), leg = trip.legs[index], pending = stop.pedido?.statusPagamento?.toLowerCase() === 'pendente', gain = stop.earnings?.amount;
              const last = index === (offer?.stops.length || 0) - 1;
              return <Entrance key={stop.pedidoId} delay={index * 70}><View style={styles.timelineRow}>
                <View style={styles.rail}><View style={[styles.node, { backgroundColor: on ? colors.accent : colors.soft, borderWidth: on ? 0 : 1, borderColor: colors.line }]}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: on ? '#fff' : colors.muted }}>{stopNumber(stop.pedidoId, index)}</Text></View>{!last && <View style={[styles.line, { backgroundColor: colors.line }]} />}</View>
                <View style={[styles.stop, { backgroundColor: focusedId === stop.pedidoId ? colors.accentSoft : colors.paper, borderColor: focusedId === stop.pedidoId ? colors.accent : colors.line, opacity: on ? 1 : .55 }]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={'Ver pedido #' + stop.pedidoId + ' no mapa'} onPress={() => setFocusedId(stop.pedidoId)} style={{ flex: 1, paddingVertical: 12, paddingLeft: 12, gap: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'ManropeExtraBold', fontSize: 13.5, color: colors.ink }}>{orderLabel(stop.pedido,stop.pedidoId)} · {stop.pedido?.nomeCliente || 'Entrega'}</Text>
                      <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 14, color: colors.success }}>{gain != null && ['delivery', 'distance'].includes(stop.earnings?.mode || '') ? money(gain) : stopEarnings(stop, money)}</Text>
                    </View>
                    <Text numberOfLines={2} style={[type.small, { color: colors.muted }]}>{stopAddress(stop)}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      <Pill icon={Navigation}>{on && leg != null ? km(leg) + (index === 0 || !trip.legs.slice(0, index).some(v => v != null) ? ' da loja' : ' da anterior') : on ? 'Distância indisponível' : 'Fora da rota'}</Pill>
                      {pending ? <Pill tone="warning" icon={Wallet}>{'Receber ' + money(stop.pedido?.value) + (stop.pedido?.troco ? ' · troco p/ ' + money(stop.pedido.troco) : '')}</Pill> : <Pill icon={Check}>Pago online</Pill>}
                    </View>
                    {pending && <Text style={[type.small, { color: colors.warning, fontSize: 11 }]}>Cobrança na entrega · confira o troco na retirada</Text>}
                  </Pressable>
                  <Pressable accessibilityRole="checkbox" accessibilityLabel={'Selecionar pedido #' + stop.pedidoId} accessibilityState={{ checked: on, disabled: action.busy || blocked }} disabled={action.busy || blocked} onPress={() => { setConfirm(null); setSelected(ids => ids.includes(stop.pedidoId) ? ids.filter(id => id !== stop.pedidoId) : (offer?.stops || []).map(s => s.pedidoId).filter(id => id === stop.pedidoId || ids.includes(id))); }} style={styles.checkTarget}>
                    <View style={[styles.check, { backgroundColor: on ? colors.accent : colors.card, borderColor: colors.accent }]}>{on && <Check size={16} color="#ffffff" />}</View>
                  </Pressable>
                </View>
              </View></Entrance>;
            })}
          </View>
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.card }]}>
          {blocked && <Text accessibilityRole="alert" style={[type.small, { color: colors.warning, marginBottom: 8 }]}>Conclua a sincronização da entrega pendente para responder a esta oferta.</Text>}
          {blocked && <Button secondary loading={completion.busy} onPress={() => void completion.recover(true)}>Sincronizar entrega pendente</Button>}
          {blocked && !!completion.error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{completion.error}</Text>}
          {!!action.error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger, marginBottom: 8 }]}>{action.error}</Text>}
          {confirm ? <><Text style={[type.small, { color: colors.ink, marginBottom: 8 }]}>{confirm === 'reject' ? 'Recusar todos os pedidos e devolver para a loja?' : 'Aceitar ' + selected.length + ' e recusar ' + ((offer?.stops.length || 0) - selected.length) + ' pedidos?'}</Text><Button danger={confirm === 'reject'} disabled={blocked} loading={action.busy} onPress={() => void resolve(confirm === 'accept')}>{'Confirmar ' + (confirm === 'reject' ? 'recusa' : 'escolha')}</Button><Button secondary disabled={action.busy} onPress={() => setConfirm(null)}>Revisar</Button></> : <>
            <Button icon={Check} loading={action.busy} disabled={blocked || !selected.length || action.busy} onPress={() => selected.length < (offer?.stops.length || 0) ? setConfirm('accept') : void resolve(true)}>{'Aceitar ' + (selected.length === 1 ? 'pedido' : selected.length + ' pedidos') + (total == null ? '' : ' · ' + money(total))}</Button>
            <Pressable accessibilityRole="button" disabled={blocked || action.busy} onPress={() => setConfirm('reject')} style={styles.textButton}><X size={17} color={colors.danger} /><Text style={[type.small, { color: colors.danger, fontWeight: '800' }]}>Recusar</Text></Pressable>
          </>}
        </View>
      </View>
    </View>
  </Modal>;
}

function Tile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  const { colors } = useZippyTheme();
  return <View style={{ flex: 1, minWidth: 0, gap: 3, padding: 9, borderRadius: 13, backgroundColor: '#ffffff14', zIndex: 1 }}>
    <Icon size={14} color={colors.heroMuted} />
    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'ManropeExtraBold', fontSize: 14, color: colors.heroInk }}>{value}</Text>
    <Text numberOfLines={1} style={{ fontFamily: 'Manrope', fontSize: 10, color: colors.heroMuted }}>{label}</Text>
  </View>;
}

/** Valor que "rola" até o novo total sempre que a seleção muda. */
function CountUp({ value, style }: { value: number; style: object }) {
  const { reducedMotion } = useZippyTheme(), animated = useRef(new Animated.Value(value)).current, [shown, setShown] = useState(value);
  useEffect(() => {
    if (reducedMotion) { setShown(value); animated.setValue(value); return; }
    const id = animated.addListener(({ value: v }) => setShown(v));
    Animated.timing(animated, { toValue: value, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => animated.removeListener(id);
  }, [value]);
  return <Text accessibilityLabel={money(value)} style={style}>{money(Math.round(shown * 100) / 100)}</Text>;
}

const styles = StyleSheet.create({
  floating: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, boxShadow: '0 3px 10px #08142633' },
  heading: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  content: { paddingHorizontal: 14, paddingTop: 6 },
  earnings: { borderRadius: 22, padding: 16, overflow: 'hidden', gap: 6, boxShadow: '0 8px 18px #10203522' },
  amount: { fontFamily: 'ManropeExtraBold', fontSize: 38, lineHeight: 46, letterSpacing: -1.6, color: '#f4f8ff' },
  tiles: { flexDirection: 'row', gap: 7, marginTop: 8 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  rail: { width: 28, alignItems: 'center' },
  node: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, marginVertical: 3, borderRadius: 1 },
  stop: { flex: 1, flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  checkTarget: { width: 52, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1, gap: 4, flexShrink: 0 },
  textButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 46, paddingHorizontal: 8 },
});
