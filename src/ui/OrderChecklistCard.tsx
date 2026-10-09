import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Package, ShieldCheck } from 'lucide-react-native';
import { checklistItems, type ChecklistConfirmation, type ChecklistOrder } from '../delivery/checklistRules';
import { Pill, Surface, type } from './Kit';
import { useZippyTheme } from './theme';

export function OrderChecklistCard({ order, confirmation, onToggle, extrasOnly = false, disabled = false }: {
  order: ChecklistOrder; confirmation?: ChecklistConfirmation; onToggle: (key: string) => void; extrasOnly?: boolean; disabled?: boolean;
}) {
  const { colors, reducedMotion } = useZippyTheme();
  const items = checklistItems(order.checklist).filter(i => !extrasOnly || i.extra);
  const checkedKeys = extrasOnly ? confirmation?.recheckedExtraKeys : confirmation?.confirmedKeys;
  if (!items.length) return null;
  return <Surface style={{ padding: 16, marginBottom: 14 }}>
    <View style={styles.heading}><View style={{ flex: 1 }}>
      <Text style={[type.eyebrow, { color: colors.muted }]}>{extrasOnly ? 'ANTES DE CONTINUAR' : 'IDENTIFIQUE NA BAG'}</Text>
      <Text style={[styles.number, { color: colors.ink }]}>Pedido #{order.id}</Text>
      {!!order.nomeCliente && <Text numberOfLines={2} style={[type.small, { color: colors.muted }]}>{order.nomeCliente}</Text>}
    </View><Pill icon={extrasOnly ? ShieldCheck : Package}>{String(items.filter(i => checkedKeys?.includes(i.key)).length) + '/' + items.length}</Pill></View>
    {items.map(item => {
      const checked = !!checkedKeys?.includes(item.key);
      return <Pressable key={item.key} accessibilityRole="checkbox" accessibilityLabel={String(item.quantity) + ' ' + item.name + (item.parentName ? ' · ' + item.parentName : '')}
        accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onToggle(item.key)}
        style={({ pressed }) => [styles.item, { borderColor: checked ? colors.accent + '70' : colors.line, backgroundColor: checked ? colors.accentSoft : colors.card, opacity: disabled ? .65 : pressed ? .85 : 1, transform: [{ scale: pressed && !reducedMotion ? .985 : 1 }] }]}>
        {!!item.imageUrl && !extrasOnly && <Image source={{ uri: item.imageUrl }} style={styles.photo} />}
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: colors.ink }]}>{item.quantity}× {item.name}</Text>
          {!!item.parentName && <Text style={[type.small, { color: colors.muted, fontSize: 10 }]}>Adicional de {item.parentName}</Text>}
          {!!item.note && <Text style={[type.small, { color: colors.warning, fontSize: 10 }]}>{item.note}</Text>}
          {item.extra && <Text style={[styles.reminder, { color: colors.accent }]}>{extrasOnly ? 'Confirme esta quantidade novamente' : 'Confira também na confirmação dos extras'}</Text>}
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
