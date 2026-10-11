import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Clock, EyeOff, MapPin, Route, X } from 'lucide-react-native';
import Mapa from '../../components/Mapa';
import { acceptOffer, queueToPedidos, rejectOffer } from '../../services/mobileApi';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { useRouteAction } from '../hooks/useRouteAction';
import { useZippyTheme } from './theme';
import { Button, Gradient, money, Pill, type } from './Kit';
import { offerTotal, stopAddress, stopEarnings } from '../delivery/offerDetails';
import { operationalDestination } from '../delivery/operationalDestination';

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
  return <Modal transparent visible={visible} animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={canDefer ? defer : () => setConfirm(null)} statusBarTranslucent>
    <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View accessibilityViewIsModal style={[styles.sheet, { maxHeight: size.height - Math.max(insets.top, 12) - Math.max(insets.bottom, 12), backgroundColor: colors.card, borderColor: colors.line }]}>
        <View style={styles.heading}><Route size={19} color={colors.accent} /><Text accessibilityRole="header" style={[type.body, { flex: 1, color: colors.ink, fontWeight: '800' }]}>Nova rota</Text><Pill icon={Clock} tone="warning">{Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' para responder'}</Pill></View>
        <ScrollView style={{ flexShrink: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.map, { height: Math.max(150, Math.min(225, size.height * .26)) }]}>
            {visible && <Mapa pedidos={mapOrders} emEntrega={false} navigationEnabled={false} routePreview path={previewPath} view3D={false} sessionKey={'offer:' + offer?.offerId} selectedPedidoId={focusedId} onOrderPress={setFocusedId} />}
            <View pointerEvents="none" style={[styles.mapCaption, { backgroundColor: colors.card }]}>
              <MapPin size={13} color={colors.accent} /><Text style={[type.small, { color: colors.ink }]}>{turn.queue?.current ? 'Rota atual + novas paradas' : 'Todas as paradas da oferta'}</Text>
            </View>
          </View>
          <View style={styles.content}>
            <Text style={[type.small, { color: colors.muted, marginBottom: 10 }]}>Mapa mostra a sequência das paradas. O caminho pelas ruas é calculado ao navegar.</Text>
            <View style={[styles.earnings, { backgroundColor: colors.hero, borderColor: colors.line }]}>
              <Gradient colors={['#28374a', '#19222e']} glow />
              <View style={{ flex: 1, minWidth: 0, zIndex: 1 }}><Text style={[type.eyebrow, { color: colors.heroMuted, textAlign: 'left' }]}>SEUS GANHOS NESTA OFERTA</Text><Text style={[styles.amount, { color: colors.heroInk }]}>{total == null ? 'Confira por pedido' : money(total)}</Text></View>
              <View style={{ alignItems: 'flex-end', flexShrink: 0, zIndex: 1 }}><Text style={[type.title, { color: colors.heroInk }]}>{chosen.length}</Text><Text style={[type.small, { color: colors.heroMuted }]}>{chosen.length === 1 ? 'entrega' : 'entregas'}</Text></View>
            </View>
            <Text style={[type.small, { color: colors.muted, marginBottom: 12 }]}>{total == null ? 'Pagamento por período ou ganho não informado: confira a regra de cada pedido.' : 'Soma dos ganhos das entregas selecionadas. Cada valor é gerado ao concluir o pedido.'}</Text>
            {!!focusedStop && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.accent, marginBottom: 10 }]}>{'Pin selecionado · #' + focusedStop.pedidoId + ' · ' + stopAddress(focusedStop)}</Text>}
            {missingCoordinates > 0 && <Text style={[type.small, { color: colors.warning, marginBottom: 10 }]}>{missingCoordinates + ' pedido(s) sem coordenadas no mapa. Confira o endereço abaixo com a loja.'}</Text>}
            <Text style={[type.small, { color: colors.muted, marginBottom: 10 }]}>Os pedidos desmarcados serão recusados ao aceitar.</Text>
            {offer?.stops.map(stop => <View key={stop.pedidoId} style={[styles.stop, { backgroundColor: focusedId === stop.pedidoId ? colors.accentSoft : colors.paper, borderColor: focusedId === stop.pedidoId ? colors.accent : colors.line }]}>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={'Selecionar pedido #' + stop.pedidoId} accessibilityState={{ checked: selected.includes(stop.pedidoId), disabled: action.busy || blocked }} disabled={action.busy || blocked} onPress={() => { setConfirm(null); setSelected(ids => ids.includes(stop.pedidoId) ? ids.filter(id => id !== stop.pedidoId) : [...ids, stop.pedidoId]); }} style={styles.checkTarget}>
                <View style={[styles.check, { backgroundColor: selected.includes(stop.pedidoId) ? colors.accent : colors.card, borderColor: colors.accent }]}>{selected.includes(stop.pedidoId) && <Check size={15} color="#ffffff" />}</View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={'Ver pedido #' + stop.pedidoId + ' no mapa'} onPress={() => setFocusedId(stop.pedidoId)} style={{ flex: 1, paddingVertical: 12, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}><Text style={[type.small, { color: colors.muted, flex: 1 }]}>{mapOrders.findIndex(p => p.id === stop.pedidoId) + 1 + ' · #' + stop.pedidoId + ' · ' + (stop.pedido?.nomeCliente || 'Entrega')}</Text><Text style={[type.small, { color: colors.accent, fontWeight: '800' }]}>{stopEarnings(stop, money)}</Text></View>
                <Text style={[type.body, { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 4 }]}>{stopAddress(stop)}</Text>
                {stop.pedido?.statusPagamento?.toLowerCase() === 'pendente' && <Text style={[type.small, { color: colors.warning, marginTop: 4 }]}>Cobrança na entrega · confira o troco na retirada</Text>}
              </Pressable>
            </View>)}
          </View>
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.line }]}>
          {blocked && <Text accessibilityRole="alert" style={[type.small, { color: colors.warning, marginBottom: 8 }]}>Conclua a sincronização da entrega pendente para responder a esta oferta.</Text>}
          {blocked && <Button secondary loading={completion.busy} onPress={() => void completion.recover(true)}>Sincronizar entrega pendente</Button>}
          {blocked && !!completion.error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{completion.error}</Text>}
          {!!action.error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger, marginBottom: 8 }]}>{action.error}</Text>}
          {confirm ? <><Text style={[type.small, { color: colors.ink, marginBottom: 8 }]}>{confirm === 'reject' ? 'Recusar todos os pedidos e devolver para a loja?' : 'Aceitar ' + selected.length + ' e recusar ' + ((offer?.stops.length || 0) - selected.length) + ' pedidos?'}</Text><Button danger={confirm === 'reject'} disabled={blocked} loading={action.busy} onPress={() => void resolve(confirm === 'accept')}>{'Confirmar ' + (confirm === 'reject' ? 'recusa' : 'escolha')}</Button><Button secondary disabled={action.busy} onPress={() => setConfirm(null)}>Revisar</Button></> : <>
            <Button icon={Check} loading={action.busy} disabled={blocked || !selected.length || action.busy} onPress={() => selected.length < (offer?.stops.length || 0) ? setConfirm('accept') : void resolve(true)}>{'Aceitar ' + (selected.length === 1 ? 'pedido' : selected.length + ' pedidos') + (total == null ? '' : ' · ' + money(total))}</Button>
            <View style={styles.secondary}><Pressable accessibilityRole="button" disabled={blocked || action.busy} onPress={() => setConfirm('reject')} style={styles.textButton}><X size={17} color={colors.danger} /><Text style={[type.small, { color: colors.danger }]}>Recusar</Text></Pressable>
              {canDefer && <Pressable accessibilityRole="button" disabled={action.busy} onPress={defer} style={styles.textButton}><EyeOff size={17} color={colors.muted} /><Text style={[type.small, { color: colors.muted }]}>Ocultar por enquanto</Text></Pressable>}
            </View>
          </>}
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#081426a8', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 10 },
  sheet: { width: '100%', maxWidth: 560, borderRadius: 26, borderWidth: 1, overflow: 'hidden', boxShadow: '0 18px 50px #08142666' },
  heading: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 14 },
  map: { overflow: 'hidden', position: 'relative' },
  mapCaption: { position: 'absolute', left: 12, bottom: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', gap: 5, alignItems: 'center', boxShadow: '0 3px 10px #08142620' },
  content: { padding: 14 },
  earnings: { borderRadius: 18, padding: 16, borderWidth: 1, overflow: 'hidden', flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10, boxShadow: '0 8px 18px #10203522' },
  amount: { fontFamily: 'ManropeExtraBold', fontSize: 30, lineHeight: 39, letterSpacing: -1, marginTop: 4, textAlign: 'left' },
  stop: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: 9, boxShadow: '0 3px 7px #1020350b' },
  checkTarget: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  check: { width: 23, height: 23, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 5, borderTopWidth: 1, gap: 5, flexShrink: 0 },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  textButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
});
