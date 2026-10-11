import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Check, Package } from 'lucide-react-native';
import { checklistItems, type ChecklistOrder } from '../delivery/checklistRules';
import { Button, Feedback, type } from './Kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useZippyTheme } from './theme';

export function ExtrasConfirmation({ visible, orders, stage, busy, error, onCancel, onConfirm }: {
  visible: boolean; orders: ChecklistOrder[]; stage: 'pickup' | 'delivery'; busy: boolean; error?: string; onCancel: () => void; onConfirm: () => void;
}) {
  const { colors } = useZippyTheme(), insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onCancel()}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#12192388', padding: 13, paddingTop: insets.top + 20, paddingBottom: Math.max(14, insets.bottom) }}>
      <View accessibilityViewIsModal accessibilityRole="alert" style={{ backgroundColor: colors.paper, borderRadius: 25, borderWidth: 1, borderColor: colors.line, padding: 20, maxHeight: '90%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}><Package color={colors.accent} size={24} /><Text accessibilityRole="header" style={[type.title, { color: colors.ink, flex: 1 }]}>{stage === 'pickup' ? 'Confira antes de sair' : 'Entregou estes itens também?'}</Text></View>
        <Text style={[type.body, { color: colors.muted, marginBottom: 14 }]}>{stage === 'pickup' ? 'A loja destacou estes itens. Confira as quantidades de cada pedido e confirme que tudo está na bag.' : 'Confira as quantidades destacadas pela loja antes de concluir.'}</Text>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
          {orders.map(order => { const items = checklistItems(order.checklist).filter(item => item.extra); return items.length ? <View key={order.id} style={{ padding: 14, borderRadius: 14, backgroundColor: colors.soft }}><Text style={[type.body, { fontWeight: '800', color: colors.ink, marginBottom: 8 }]}>Pedido #{order.id}{order.nomeCliente ? ' · ' + order.nomeCliente : ''}</Text>{items.map(item => <Text key={item.key} style={[type.body, { color: colors.ink, marginVertical: 3 }]}>{item.quantity}× {item.name}{item.parentName ? ' · ' + item.parentName : ''}</Text>)}</View> : null; })}
          {!!error && <Feedback title="Confira antes de continuar" message={error} />}
        </ScrollView>
        <View style={{ gap: 9, marginTop: 18 }}><Button icon={Check} loading={busy} onPress={onConfirm}>{stage === 'pickup' ? 'Tudo na bag · estou saindo' : 'Confirmar itens entregues'}</Button><Button secondary disabled={busy} onPress={onCancel}>Voltar e conferir</Button></View>
      </View>
    </View>
  </Modal>;
}
