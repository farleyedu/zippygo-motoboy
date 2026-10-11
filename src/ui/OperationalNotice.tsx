import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Check, ChevronRight, Clock, X } from 'lucide-react-native';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { operationalDestination } from '../delivery/operationalDestination';
import { useZippyTheme } from './theme';
import { offerTotal } from '../delivery/offerDetails';
import { money } from './Kit';

export function OperationalNotice({ onInspectRoute }: { onInspectRoute?: () => void }) {
  const completion = useDeliveryCompletion(), turn = useOperationalSession(), router = useRouter(), segments = useSegments();
  const { colors } = useZippyTheme(), pending = ['pending', 'sending'].includes(completion.draft?.phase || '');
  const offer = turn.queue?.offer, [now, setNow] = useState(Date.now());
  useEffect(() => { if (!offer || turn.deferredOfferId !== offer.offerId) return; setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [offer?.offerId, turn.deferredOfferId]);
  const seconds = Math.max(0, Math.ceil((Date.parse(offer?.expiresAtUtc || '') - now) / 1000)), gain = offerTotal(offer?.stops || []);
  const row = (label: string, action: () => void, dismiss?: () => void, success = false) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: success ? colors.accentSoft : colors.warningSoft, marginBottom: 10, borderWidth: 1, borderColor: colors.line }}>
    <Pressable accessibilityRole="button" onPress={action} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, padding: 11 }}>
      {success ? <Check size={18} color={colors.accent} /> : <Clock size={18} color={colors.warning} />}
      <Text accessibilityLiveRegion="polite" style={{ flex: 1, fontFamily: 'Manrope', fontSize: 12, lineHeight: 17, color: colors.ink }}>{label}</Text><ChevronRight size={16} color={colors.muted} />
    </Pressable>{dismiss && <Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso" onPress={dismiss} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><X size={17} color={colors.muted} /></Pressable>}
  </View>;
  return <>
    {!!offer?.offerId && turn.deferredOfferId === offer.offerId && seconds > 0 && row(`Nova oferta · ${gain == null ? `${offer.stops.length} pedidos` : money(gain)} · responder em ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, turn.showOffer)}
    {pending && String(segments[0]) !== 'entregaPendente' && row(`Pedido #${completion.draft?.context.pedidoId} · ${completion.busy ? 'sincronizando' : 'conclusão aguardando confirmação'}`, () => router.push('/entregaPendente'))}
    {completion.notice && row(`Pedido #${completion.notice.pedidoId} · entrega concluída`, () => router.push({ pathname: '/entregaConcluida', params: { operation: completion.notice!.operationId } }), completion.clearNotice, true)}
    {turn.routeNotice && row(turn.routeNotice.kind === 'cancelled' ? 'A loja cancelou um pedido · confira a fila atual' : 'Sua rota foi atualizada · confira a sequência', () => { turn.clearRouteNotice(); if (onInspectRoute) onInspectRoute(); else router.navigate(operationalDestination(turn.store.getSnapshot().queue, Platform.OS)); }, turn.clearRouteNotice)}
    {turn.transferNotice && row(`Pedido #${turn.transferNotice.pedidoId} · ${turn.transferNotice.status === 'pending_approval' ? 'transferência aguardando a loja' : turn.transferNotice.status === 'completed' ? 'transferência confirmada' : turn.transferNotice.status === 'rejected' ? 'transferência recusada' : 'transferência cancelada'}`, () => router.push({ pathname: '/acompanharTransferencia', params: { id: String(turn.transferNotice!.id) } }), turn.transferNotice.status === 'pending_approval' ? undefined : () => turn.setTransferNotice(null), turn.transferNotice.status === 'completed')}
  </>;
}
