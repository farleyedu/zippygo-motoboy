import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, ChevronDown, ChevronRight, Map, Package, Route } from 'lucide-react-native';
import { getOperationalOrder, type OperationalOrderDetail, type RouteStop } from '../../services/mobileApi';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { checklistItems } from '../delivery/checklistRules';
import { Button, Gradient, money, Pill, type } from './Kit';
import { useZippyTheme } from './theme';
import { OperationalNotice } from './OperationalNotice';

type Props = { open: boolean; height: number; bottom: number; stops: RouteStop[]; selectedId: number; busy: boolean; actionError: string; onSelect(id: number): void; onClose(): void; onOverview(): void; onOrder(id: number): void };

export function RouteDeck(props: Props) {
  const { colors, dark, reducedMotion } = useZippyTheme(), turn = useOperationalSession();
  const progress = useRef(new Animated.Value(0)).current;
  const [detail, setDetail] = useState<OperationalOrderDetail | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const selected = props.stops.find(s => s.pedidoId === props.selectedId);
  useEffect(() => {
    const animation = Animated.spring(progress, { toValue: props.open ? 1 : 0, damping: 25, stiffness: 220, mass: .8, useNativeDriver: true });
    if (reducedMotion) progress.setValue(props.open ? 1 : 0); else animation.start();
    return () => animation.stop();
  }, [props.open, progress, reducedMotion]);
  useEffect(() => {
    setDetail(null); setError('');
    if (!props.open || !selected || !turn.session) return;
    const abort = new AbortController(); let alive = true;
    void getOperationalOrder(selected.pedidoId, abort.signal).then(value => { if (alive) setDetail(value); }).catch(e => { if (alive && !abort.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível carregar os itens.'); });
    return () => { alive = false; abort.abort(); };
  }, [props.open, selected?.pedidoId, turn.session?.sessionId, turn.queue?.version, retry]);
  const pan = PanResponder.create({ onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx), onPanResponderRelease: (_, g) => { if (g.dy > 35) props.onClose(); } });
  const extras = detail ? checklistItems(detail.checklist).filter(i => i.extra) : [];
  return <Animated.View pointerEvents={props.open ? 'auto' : 'none'} accessibilityElementsHidden={!props.open} importantForAccessibility={props.open ? 'yes' : 'no-hide-descendants'}
    style={{ position: 'absolute', zIndex: 30, left: 10, right: 10, bottom: props.bottom, height: props.height, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', boxShadow: '0 18px 45px #08142655', opacity: progress, transform: [{ perspective: 1000 }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [props.height + props.bottom + 30, 0] }) }, { rotateX: progress.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '0deg'] }) }] }}>
    <View {...pan.panHandlers} style={{ flexShrink: 0 }}>
      <Gradient colors={dark ? ['#2b4566', '#192d48'] : ['#edf5ff', '#dbeaff']} />
      <Pressable accessibilityRole="button" accessibilityLabel="Recolher rota completa" onPress={props.onClose} style={{ height: 24, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: colors.muted }} /></Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 15, gap: 10 }}>
        {selected ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar à sequência da rota" onPress={props.onOverview} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}><ArrowLeft size={22} color={colors.accent} /></Pressable> : <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], boxShadow: '3px 5px 0 #16438f, 0 9px 18px #2872e333' }}><Route size={25} color="#fff" /></View>}
        <View style={{ flex: 1 }}><Text accessibilityRole="header" style={[type.title, { color: colors.ink, fontSize: 21 }]}>{selected ? `Pedido #${selected.pedidoId}` : 'Sua rota, de perto'}</Text><Text style={[type.small, { color: colors.muted, marginTop: 4 }]}>{selected ? selected.pedido?.nomeCliente || 'Detalhes da entrega' : `${props.stops.length} paradas · toque em um pedido`}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhes da rota" onPress={props.onClose} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><ChevronDown color={colors.muted} size={22} /></Pressable>
      </View>
    </View>
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 24 }}>
      {props.open && <OperationalNotice onInspectRoute={props.onOverview} />}
      {!selected ? <>
        {Platform.OS === 'web' && <Text style={[type.small, { color: colors.muted }]}>O mapa mostra a sequência. O percurso pelas ruas abre no Google Maps.</Text>}
        {props.stops.map((stop, index) => <Pressable key={stop.pedidoId} accessibilityRole="button" accessibilityLabel={`Ver pedido ${stop.pedidoId}, parada ${index + 1}`} onPress={() => props.onSelect(stop.pedidoId)} style={({ pressed }) => ({ minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 21, backgroundColor: index === 0 ? colors.accentSoft : colors.card, borderWidth: 1, borderColor: index === 0 ? colors.accent + '70' : colors.line, boxShadow: dark ? '0 5px 12px #08142640' : '0 5px 12px #19365915', transform: [{ perspective: 800 }, { scale: pressed ? .975 : 1 }, { rotateY: pressed && !reducedMotion ? '-3deg' : '0deg' }] })}>
          <View style={{ width: 40, height: 46, borderRadius: 14, backgroundColor: index === 0 ? colors.accent : colors.soft, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 0 #12274424' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 19, color: index === 0 ? '#fff' : colors.accent }}>{index + 1}</Text></View>
          <View style={{ flex: 1, gap: 5 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 13, color: colors.ink }}>#{stop.pedidoId} · {stop.pedido?.nomeCliente || 'Cliente'}</Text><Text numberOfLines={2} style={[type.small, { color: colors.muted }]}>{stop.pedido?.enderecoEntrega || [stop.pedido?.rua, stop.pedido?.numero, stop.pedido?.bairro].filter(Boolean).join(', ')}</Text><Text style={[type.small, { color: index === 0 ? colors.accent : colors.muted }]}>{index === 0 ? stop.pickedUpAtUtc ? 'Próxima entrega' : 'Conferir retirada' : 'Na sequência'}</Text></View><ChevronRight color={colors.accent} size={20} />
        </Pressable>)}
        {!props.stops.length && <Text style={[type.body, { color: colors.muted }]}>Sua rota está livre. A próxima oferta aparecerá aqui no app.</Text>}
      </> : <>
        <Pill icon={Map}>{`${props.stops.indexOf(selected) + 1}ª parada · ${selected.status === 'en_route' ? 'em andamento' : 'na sequência'}`}</Pill>
        <Text style={[type.body, { color: colors.ink }]}>{detail?.enderecoEntrega || selected.pedido?.enderecoEntrega || [selected.pedido?.rua, selected.pedido?.numero, selected.pedido?.bairro].filter(Boolean).join(', ')}</Text>
        {!detail && !error && <ActivityIndicator accessibilityLabel="Carregando itens do pedido" color={colors.accent} />}
        {!!error && <><Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error}</Text><Button secondary onPress={() => setRetry(n => n + 1)}>Carregar itens novamente</Button></>}
        {detail && <>
          {!!detail.capaImagemUrl && <Image source={{ uri: detail.capaImagemUrl }} style={{ height: 120, borderRadius: 18, width: '100%' }} resizeMode="cover" />}
          {extras.length > 0 && <View style={{ padding: 14, borderRadius: 16, backgroundColor: colors.warningSoft }}><Text style={{ fontFamily: 'ManropeExtraBold', color: colors.warning, fontSize: 12 }}>Atenção na bag</Text>{extras.map(item => <Text key={item.key} style={[type.small, { color: colors.ink, marginTop: 6 }]}>{item.quantity}× {item.name}</Text>)}</View>}
          {detail.itens.map((item, i) => <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line }}>
            {item.imagemUrl ? <Image source={{ uri: item.imagemUrl }} style={{ width: 52, height: 52, borderRadius: 15 }} /> : <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }], boxShadow: '2px 4px 0 #16366115' }}><Package size={25} color={colors.accent} /></View>}
            <View style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.ink }}>{item.quantidade}× {item.nome}</Text>{!!item.observacao && <Text style={[type.small, { color: colors.muted, marginTop: 4 }]}>{item.observacao}</Text>}{item.adicionais.map((extra, n) => <Text key={n} style={[type.small, { color: colors.muted }]}>{extra.quantidade || 1}× {extra.nome}</Text>)}</View>
          </View>)}
          {!!detail.observacoes && <Text style={[type.small, { color: colors.ink }]}>{detail.observacoes}</Text>}
          <Text style={[type.small, { color: colors.muted }]}>{detail.statusPagamento === 'pago' ? 'Pagamento confirmado' : `${detail.formaPagamento || 'Confira o pagamento'} · ${money(detail.total)}`}</Text>
          {!!props.actionError && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{props.actionError}</Text>}
          {detail.isCurrent && <Button secondary icon={Package} loading={props.busy} onPress={() => props.onOrder(selected.pedidoId)}>{selected.pickedUpAtUtc ? 'Conferir entrega' : 'Conferir retirada'}</Button>}
        </>}
      </>}
    </ScrollView>
  </Animated.View>;
}
