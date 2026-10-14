import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { Check, CheckCheck, LucideIcon } from 'lucide-react-native';
import { money } from './CompletionKit';
import { Surface, type } from './Kit';
import { useZippyTheme } from './theme';

export type FinishStep = { key: string; label: string; done: boolean; icon: LucideIcon };

// Uma barra por conferência: enche com animação nativa quando a etapa é concluída.
function Segment({ done }: { done: boolean }) {
  const { reducedMotion } = useZippyTheme(), fill = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => { if (reducedMotion) fill.setValue(done ? 1 : 0); else Animated.timing(fill, { toValue: done ? 1 : 0, duration: 320, useNativeDriver: true }).start(); }, [done, fill, reducedMotion]);
  return <View style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#ffffff26' }}>
    <Animated.View style={{ flex: 1, backgroundColor: '#aed0fc', borderRadius: 3, transform: [{ scaleX: fill }], transformOrigin: 'left' } as never} />
  </View>;
}

export function FinishHero({ pedido, label, name, steps, receive }: { pedido: number; label?:string; name?: string; steps: FinishStep[]; receive?: { amount?: number; confirmed: boolean } }) {
  const { colors } = useZippyTheme(), done = steps.filter(step => step.done).length, all = done === steps.length;
  return <Surface hero style={{ padding: 18, borderRadius: 23, marginBottom: 14 }}>
    <Text style={[type.eyebrow, { color: colors.heroMuted }]}>O ÚLTIMO DETALHE IMPORTA.</Text>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 26, letterSpacing: -1, color: colors.heroInk }}>Entregar {label || `#${pedido}`}</Text>
        {!!name && <Text numberOfLines={1} style={[type.small, { color: colors.heroMuted, marginTop: 2 }]}>{name}</Text>}
      </View>
      {receive?.amount != null && <View style={{ alignItems: 'flex-end' }}>
        <Text style={[type.eyebrow, { color: colors.heroMuted }]}>{receive.confirmed ? 'RECEBIDO' : 'RECEBER'}</Text>
        <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 20, letterSpacing: -.7, color: colors.heroInk, marginTop: 3 }}>{money(receive.amount)}</Text>
      </View>}
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel={`${done} de ${steps.length} conferências feitas`} accessibilityValue={{ min: 0, max: steps.length, now: done }} style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>{steps.map(step => <Segment key={step.key} done={step.done} />)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
      {steps.map(step => { const Icon = step.done ? Check : step.icon; return <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, backgroundColor: step.done ? '#aed0fc2e' : '#ffffff14', borderWidth: 1, borderColor: step.done ? '#aed0fc66' : 'transparent' }}>
        <Icon size={13} color={step.done ? '#d6e8ff' : colors.heroMuted} strokeWidth={step.done ? 2.8 : 2} />
        <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 11, color: step.done ? '#e6f1ff' : colors.heroMuted }}>{step.label}</Text>
      </View>; })}
    </View>
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }}>
      {all && <CheckCheck size={15} color="#aed0fc" />}
      <Text style={[type.small, { color: all ? '#d6e8ff' : colors.heroMuted, fontWeight: all ? '800' : '500' }]}>{all ? 'Tudo conferido. Deslize para concluir.' : `${done} de ${steps.length} conferências feitas`}</Text>
    </View>
  </Surface>;
}
