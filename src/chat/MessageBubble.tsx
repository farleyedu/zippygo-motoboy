import React from 'react';
import { Pressable, PressableProps, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Check, CheckCheck } from 'lucide-react-native';
import { useZippyTheme } from '../ui/theme';
import { Gradient } from '../ui/Kit';

type GroupMessage = { mine: boolean; createdAtUtc: string; senderKey?: string };
export function continuesMessage(previous: GroupMessage | undefined, message: GroupMessage): boolean {
  if (!previous || previous.mine !== message.mine || previous.senderKey !== message.senderKey) return false;
  const before = new Date(previous.createdAtUtc), after = new Date(message.createdAtUtc);
  const gap = after.getTime() - before.getTime();
  return gap >= 0 && gap < 120000 && before.toDateString() === after.toDateString();
}

export function MessageBubble({ mine, continuation = false, highlightColor, children, ...props }: {
  mine: boolean; continuation?: boolean; highlightColor?: string; children: React.ReactNode;
} & Pick<PressableProps, 'onLayout' | 'onLongPress' | 'accessibilityLabel' | 'testID'>) {
  const { colors, dark } = useZippyTheme();
  const background = mine ? dark ? '#2872e3' : '#c7d8ee' : dark ? '#22334c' : '#ffffff';
  const edge = highlightColor || (mine ? dark ? '#65a1ff70' : '#b9cde7' : colors.line);
  return <Pressable {...props} delayLongPress={350} style={[styles.bubble, {
    alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: continuation ? 3 : 10,
    backgroundColor: background, borderColor: edge, borderWidth: highlightColor ? 2 : 1,
    borderTopLeftRadius: !mine && !continuation ? 3 : 12,
    borderTopRightRadius: mine && !continuation ? 3 : 12,
    boxShadow: dark ? '0 2px 1px #00000038, 0 5px 10px #00000020' : '0 2px 1px #243e6120, 0 4px 8px #243e6110',
  }]}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 11, overflow: 'hidden' }]}><Gradient colors={dark ? ['#ffffff10', '#00000008'] : ['#ffffff50', '#243e6105']} /></View>
    {!continuation && <View pointerEvents="none" style={{ position: 'absolute', top: -1, [mine ? 'right' : 'left']: -7 }}>
      <Svg width={8} height={14} viewBox="0 0 8 14"><Path d={mine ? 'M0 .5H7Q8 .5 6.5 3L0 13Z' : 'M8 .5H1Q0 .5 1.5 3L8 13Z'} fill={background} stroke={edge} strokeWidth={0.8} /></Svg>
    </View>}
    {children}
  </Pressable>;
}

export function MessageMeta({ createdAtUtc, mine, read, delivered = false }: {
  createdAtUtc: string; mine: boolean; read: boolean; delivered?: boolean;
}) {
  const { colors, dark } = useZippyTheme();
  const muted = mine && dark ? '#d6e8ff' : colors.muted;
  const time = new Date(createdAtUtc).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const Status = read || delivered ? CheckCheck : Check;
  return <View testID="message-meta" accessibilityLabel={`${time}${mine ? read ? ' · Lida' : delivered ? ' · Entregue' : ' · Enviada' : ''}`} style={styles.meta}>
    <Text style={{ color: muted, fontFamily: 'Manrope', fontSize: 11, lineHeight: 16 }}>{time}</Text>
    {mine && <Status size={16} strokeWidth={1.8} color={read ? dark ? '#70d5f1' : colors.accent : muted} />}
  </View>;
}

export function BubbleText({ body, foreground, metadata }: { body: string; foreground: string; metadata?: React.ReactNode }) {
  return <View style={{ marginTop: 2, minHeight: 22 }}>
    <Text style={{ fontFamily: 'Manrope', fontSize: 15, lineHeight: 22, color: foreground }}>
      {body}{metadata && <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ fontSize: 11, color: 'transparent' }}>{'\u2003'.repeat(6)}</Text>}
    </Text>
    {metadata && <View style={{ position: 'absolute', right: 0, bottom: 1 }}>{metadata}</View>}
  </View>;
}

export function ReplyQuote({ sender, body, mine, onPress }: { sender: string; body: string; mine: boolean; onPress?: () => void }) {
  const { colors, dark } = useZippyTheme();
  return <Pressable disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? 'Ver mensagem citada' : undefined} onPress={onPress} style={{
    borderLeftWidth: 4, borderLeftColor: mine && dark ? '#8bd3ff' : colors.accent,
    borderRadius: 7, paddingVertical: 7, paddingHorizontal: 9, marginBottom: 5,
    backgroundColor: dark ? '#07182d36' : mine ? '#6a8ebf21' : colors.soft,
  }}>
    <Text numberOfLines={1} style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, lineHeight: 18, color: mine && dark ? '#c1e4ff' : colors.accent }}>{sender}</Text>
    <Text numberOfLines={2} style={{ fontFamily: 'Manrope', fontSize: 13, lineHeight: 19, color: mine && dark ? '#dfebfc' : colors.muted }}>{body}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '90%', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
});
