import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Banknote, Check, CreditCard, LucideIcon, QrCode, WalletCards } from 'lucide-react-native';
import type { PaymentMethod } from '../../services/completionApi';
import { methodNames, money } from './CompletionKit';
import { type } from './Kit';
import { useZippyTheme } from './theme';

// Valores do protótipo aprovado (.payment-method, .split-part, .card-warm e .split-summary),
// claro e noturno. Mantêm a cobrança na mesma família azul/âmbar do restante do app.
export function useChargeTone() {
  const { colors, dark } = useZippyTheme();
  return {
    colors, dark,
    idle: { background: dark ? '#1f2a39' : colors.card, border: dark ? '#41536a' : colors.line, ink: dark ? '#e1e9f4' : colors.ink },
    active: { background: dark ? '#2a384b' : '#d7e2f1', border: dark ? '#7ca3d5' : '#7397c7', ring: dark ? '#7ca3d533' : '#81a6d744' },
    part: { background: dark ? '#1d2836' : colors.card, border: dark ? '#41536a' : colors.line },
    warm: { background: dark ? '#382f26' : '#f9efdf', border: dark ? '#99734b66' : '#ebd4b3', ink: dark ? '#f2d2ab' : '#895a2c' },
    summary: { background: dark ? '#273446' : colors.soft, ink: dark ? '#d3e0f0' : colors.ink },
  };
}

const icons: Record<PaymentMethod, LucideIcon> = { dinheiro: Banknote, pix: QrCode, debito: CreditCard, credito: WalletCards };
const order: PaymentMethod[] = ['dinheiro', 'pix', 'debito', 'credito'];
export const methodIcon = (method: PaymentMethod) => icons[method];

export function MethodGrid({ value, onChange, label, disabled, compact }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void; label: string; disabled?: boolean; compact?: boolean }) {
  const tone = useChargeTone();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {order.map(method => {
      const on = method === value, Icon = icons[method];
      return <Pressable key={method} accessibilityRole="radio" accessibilityLabel={methodNames[method]} accessibilityState={{ checked: on, disabled: !!disabled }} disabled={disabled} onPress={() => onChange(method)}
        style={({ pressed }) => ({ flexBasis: '46%', flexGrow: 1, flexShrink: 0, minWidth: 118, minHeight: compact ? 46 : 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? tone.active.border : tone.idle.border, backgroundColor: on ? tone.active.background : tone.idle.background, opacity: disabled ? .55 : pressed ? .86 : 1 })}>
        <View style={{ width: compact ? 26 : 30, height: compact ? 26 : 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? tone.colors.accent : tone.colors.soft }}><Icon size={compact ? 15 : 17} color={on ? tone.colors.card : tone.colors.accent} strokeWidth={2} /></View>
        <Text numberOfLines={1} style={{ flexShrink: 0, fontFamily: 'ManropeExtraBold', fontSize: 12, color: tone.idle.ink }}>{methodNames[method]}</Text>
      </Pressable>;
    })}
  </View>;
}

/** Aceita só dígitos e um separador, com até duas casas; "100" continua sendo cem reais. */
export function cleanMoneyText(text: string) {
  const [whole, ...rest] = text.replace(/\./g, ',').replace(/[^\d,]/g, '').split(',');
  const digits = whole.replace(/^0+(?=\d)/, '').slice(0, 7);
  return rest.length ? `${digits || '0'},${rest.join('').slice(0, 2)}` : digits;
}
export const moneyText = (value: number) => value.toFixed(2).replace('.', ',');

export function MoneyInput({ label, value, onChange, editable = true, error, big }: { label: string; value: string; onChange: (text: string) => void; editable?: boolean; error?: boolean; big?: boolean }) {
  const { colors, dark } = useZippyTheme(), [focused, setFocused] = useState(false);
  return <View style={{ gap: 7 }}>
    <Text style={[type.small, { fontWeight: '700', fontSize: 10, lineHeight: 14, color: colors.ink }]}>{label}</Text>
    <View style={{ minHeight: big ? 58 : 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, backgroundColor: dark ? '#1f2a39' : colors.card, borderColor: error ? colors.danger : focused ? colors.accent : dark ? '#41536a' : colors.line, opacity: editable ? 1 : .6 }}>
      <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: big ? 16 : 13, color: colors.muted }}>R$</Text>
      <TextInput accessibilityLabel={label} value={value} editable={editable} inputMode="decimal" keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={colors.muted} selectionColor={colors.accent} selectTextOnFocus
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChangeText={text => onChange(cleanMoneyText(text))}
        style={{ flex: 1, minWidth: 0, paddingVertical: 10, fontFamily: 'ManropeExtraBold', fontSize: big ? 26 : 19, letterSpacing: -.6, color: colors.ink, outlineStyle: 'none' } as never} />
    </View>
  </View>;
}

const notes = [10, 20, 50, 100, 200];
/** Cédulas que o cliente provavelmente entrega: as três menores que cobrem o valor. */
export function cashSuggestions(total: number) {
  const bigger = notes.filter(note => note > total + .004).slice(0, 3);
  if (bigger.length) return bigger;
  const base = Math.ceil((total + .01) / 50) * 50;
  return [base, base + 50];
}

export function QuickCash({ total, selected, disabled, onPick }: { total: number; selected: number | null; disabled?: boolean; onPick: (value: number) => void }) {
  const { colors, dark } = useZippyTheme();
  const values = [total, ...cashSuggestions(total)].filter((value, index, all) => all.findIndex(other => Math.abs(other - value) < .004) === index);
  return <View accessibilityLabel="Valores sugeridos" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {values.map((value, index) => {
      const on = selected != null && Math.abs(selected - value) < .004;
      return <Pressable key={value} accessibilityRole="button" accessibilityLabel={index === 0 ? `Valor exato ${money(value)}` : `Cliente deu ${money(value)}`} accessibilityState={{ selected: on, disabled: !!disabled }} disabled={disabled} onPress={() => onPick(value)}
        style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderColor: on ? colors.accent : dark ? '#41536a' : colors.line, backgroundColor: on ? colors.accentSoft : dark ? '#1f2a39' : colors.card, opacity: pressed ? .8 : 1 })}>
        <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 11, color: on ? colors.accent : colors.ink }}>{index === 0 ? 'Valor exato' : money(value).replace(/\s/g, ' ')}</Text>
      </Pressable>;
    })}
  </View>;
}

/** Troco calculado a partir do que o cliente entregou; deixa claro quando ainda falta dinheiro. */
export function ChangeCard({ received, due, compact }: { received: number | null; due: number; compact?: boolean }) {
  const tone = useChargeTone(), { colors } = tone;
  const missing = received != null && received + .004 < due, change = received == null ? 0 : Math.max(0, received - due);
  const state = received == null ? 'idle' : missing ? 'missing' : change > .004 ? 'change' : 'exact';
  const palette = state === 'missing' ? { bg: colors.dangerSoft, ink: colors.danger, border: colors.danger + '55' }
    : state === 'change' ? { bg: tone.warm.background, ink: tone.warm.ink, border: tone.warm.border }
    : state === 'exact' ? { bg: tone.summary.background, ink: colors.success, border: colors.success + '44' }
    : { bg: tone.summary.background, ink: colors.muted, border: 'transparent' };
  const title = state === 'missing' ? 'Falta receber' : state === 'change' ? 'Troco para devolver' : state === 'exact' ? 'Valor exato · sem troco' : 'Informe o dinheiro recebido';
  const amount = state === 'missing' ? due - (received ?? 0) : change;
  return <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: compact ? 11 : 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, backgroundColor: palette.bg, borderColor: palette.border }}>
    <Text style={{ flexShrink: 1, minWidth: 96, fontFamily: 'Manrope', fontWeight: '700', fontSize: 11.5, color: palette.ink }}>{title}</Text>
    {state !== 'idle' && state !== 'exact' && <Text numberOfLines={1} accessibilityLabel={`${title}: ${money(amount)}`} style={{ flexShrink: 0, fontFamily: 'ManropeExtraBold', fontSize: compact ? 17 : 22, letterSpacing: -.6, color: palette.ink }}>{money(amount)}</Text>}
    {state === 'exact' && <Check size={20} color={palette.ink} strokeWidth={2.6} />}
  </View>;
}
