import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, Store } from 'lucide-react-native';
import { Pill, Surface, type } from './Kit';
import { useZippyTheme } from './theme';
import { MotoboyLinkRequest } from '../../services/mobileApi';

export function StoreCard({ name, detail, selected, onPress, disabled, children }: { name: string; detail?: string; selected?: boolean; onPress?: () => void; disabled?: boolean; children?: React.ReactNode }) {
  const { colors } = useZippyTheme();
  const contents = <Surface style={{ borderColor: selected ? colors.accent : colors.line, backgroundColor: selected ? colors.soft : colors.card }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Store size={21} color={colors.accent} /></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={[type.body, { fontWeight: '800', color: colors.ink }]}>{name}</Text>{detail ? <Text style={[type.small, { color: colors.muted }]}>{detail}</Text> : null}</View>
      {selected && <Check size={20} color={colors.accent} />}
    </View>
    {children && <View style={{ marginTop: 14, gap: 12 }}>{children}</View>}
  </Surface>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`Selecionar ${name}`} accessibilityState={{ selected: !!selected, disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ opacity: disabled || pressed ? .6 : 1 })}>{contents}</Pressable> : contents;
}

export function LinkStatus({ request }: { request: MotoboyLinkRequest }) {
  const pending = request.status === 'pending';
  return <Pill tone={request.status === 'rejected' ? 'danger' : pending ? 'warning' : 'accent'}>{request.status === 'approved' ? 'Vínculo aprovado' : request.status === 'rejected' ? 'Solicitação recusada' : pending ? request.origem === 'estabelecimento' ? 'Convite recebido' : 'Aguardando aprovação' : 'Status indisponível'}</Pill>;
}
