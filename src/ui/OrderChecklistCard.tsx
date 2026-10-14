import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Package, ShieldCheck } from 'lucide-react-native';
import { checklistItems, type ChecklistConfirmation, type ChecklistOrder } from '../delivery/checklistRules';
import { Pill, Surface, type } from './Kit';
import { useZippyTheme } from './theme';
import { orderLabel } from '../delivery/ifoodRules';

export function OrderChecklistCard({ order, confirmation, onToggle, onToggleBag, stage = 'pickup', extrasOnly = false, disabled = false }: {
  order: ChecklistOrder; confirmation?: ChecklistConfirmation; onToggle: (key: string) => void; onToggleBag?: () => void; stage?: 'pickup' | 'delivery'; extrasOnly?: boolean; disabled?: boolean;
}) {
  const { colors } = useZippyTheme();
  const items = checklistItems(order.checklist).filter(i => !extrasOnly || i.extra);
  const checkedKeys = extrasOnly ? confirmation?.recheckedExtraKeys : confirmation?.confirmedKeys;
  const ordinary = items.filter(item => !item.extra), bagChecked = ordinary.length > 0 && ordinary.every(item => checkedKeys?.includes(item.key));
  if (!items.length) return null;
  return <Surface style={{ padding: 16, marginBottom: 14 }}>
    <View style={styles.heading}><View style={{ flex: 1 }}>
      <Text style={[type.eyebrow, { color: colors.muted }]}>{extrasOnly ? 'ANTES DE CONTINUAR' : 'IDENTIFIQUE NA BAG'}</Text>
      <Text style={[styles.number, { color: colors.ink }]}>Pedido {orderLabel(order,order.id)}</Text>
      {!!order.nomeCliente && <Text numberOfLines={2} style={[type.small, { color: colors.muted }]}>{order.nomeCliente}</Text>}
    </View><Pill icon={extrasOnly ? ShieldCheck : Package}>{String(items.filter(i => checkedKeys?.includes(i.key)).length) + '/' + items.length}</Pill></View>
    {ordinary.length > 0 && onToggleBag && <>
      {ordinary.map(item => <View key={item.key} style={[styles.item, { borderColor: colors.line, backgroundColor: colors.card }]}>
        {!!item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.photo} />}
        <View style={{ flex: 1 }}><Text style={[styles.itemName, { color: colors.ink }]}>{item.quantity}× {item.name}</Text>{!!item.parentName && <Text style={[type.small, { color: colors.muted }]}>Adicional de {item.parentName}</Text>}{!!item.note && <Text style={[type.small, { color: colors.warning }]}>{item.note}</Text>}</View>
      </View>)}
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`Conferi a sacola e os itens do pedido ${order.id}`} accessibilityState={{ checked: bagChecked, disabled }} aria-checked={bagChecked} aria-disabled={disabled} disabled={disabled} onPress={onToggleBag} style={[styles.item, { minHeight: 54, backgroundColor: bagChecked ? colors.accentSoft : colors.soft, borderColor: bagChecked ? colors.accent : colors.line }]}>
        <View style={[styles.check, { borderColor: colors.accent, backgroundColor: bagChecked ? colors.accent : colors.card }]}>{bagChecked && <Check size={16} color={colors.paper} />}</View><Text style={[styles.itemName, { flex: 1, color: colors.ink }]}>{stage === 'pickup' ? 'Conferi a sacola e os itens acima' : 'Entreguei esta sacola com os itens acima'}</Text>
      </Pressable>
    </>}
    {(onToggleBag ? items.filter(item => item.extra) : items).map(item => {
      const checked = !!checkedKeys?.includes(item.key);
      return <Pressable key={item.key} accessibilityRole="checkbox" accessibilityLabel={String(item.quantity) + ' ' + item.name + (item.parentName ? ' · ' + item.parentName : '')}
        accessibilityState={{ checked, disabled }} aria-checked={checked} aria-disabled={disabled} disabled={disabled} onPress={() => onToggle(item.key)}
        style={({ pressed }) => [styles.item, { borderColor: checked ? colors.accent + '70' : colors.line, backgroundColor: checked ? colors.accentSoft : colors.card, opacity: disabled ? .65 : pressed ? .85 : 1 }]}>
        {!!item.imageUrl && !extrasOnly && <Image source={{ uri: item.imageUrl }} style={styles.photo} />}
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: colors.ink }]}>{item.quantity}× {item.name}</Text>
          {!!item.parentName && <Text style={[type.small, { color: colors.muted, fontSize: 10 }]}>Adicional de {item.parentName}</Text>}
          {!!item.note && <Text style={[type.small, { color: colors.warning, fontSize: 10 }]}>{item.note}</Text>}
          {item.extra && <Text style={[styles.reminder, { color: colors.accent }]}>{extrasOnly ? 'Atenção: confira esta quantidade' : 'Confira com atenção · destacado pela loja'}</Text>}
        </View>
        <View style={[styles.check, { backgroundColor: checked ? colors.accent : colors.soft, borderColor: checked ? colors.accent : colors.line }]}>{checked && <Check size={16} color={colors.paper} />}</View>
      </Pressable>;
    })}
  </Surface>;
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  number: { fontFamily: 'ManropeExtraBold', fontSize: 25, letterSpacing: -.9, marginVertical: 5 },
  item: { minHeight: 72, padding: 11, borderWidth: 1, borderRadius: 13, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  photo: { width: 58, height: 58, borderRadius: 10 },
  itemName: { fontFamily: 'ManropeExtraBold', fontSize: 12, lineHeight: 18 },
  reminder: { fontFamily: 'Manrope', fontSize: 9, lineHeight: 14, marginTop: 4 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
