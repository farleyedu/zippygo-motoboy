import React from 'react';
import { Pressable, PressableProps, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Check, CheckCheck } from 'lucide-react-native';
import { senderTone, useWa } from './WaKit';

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
  const wa = useWa();
  const background = mine ? wa.outgoing : wa.incoming;
  return <Pressable {...props} delayLongPress={320} style={[styles.bubble, {
    alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: continuation ? 2 : 8, marginHorizontal: 8,
    backgroundColor: background,
    borderTopLeftRadius: !mine && !continuation ? 0 : 10,
    borderTopRightRadius: mine && !continuation ? 0 : 10,
    borderWidth: highlightColor ? 2 : 0, borderColor: highlightColor,
    boxShadow: '0 1px 0.5px #0000002b',
  }]}>
    {!continuation && <View pointerEvents="none" style={{ position: 'absolute', top: 0, [mine ? 'right' : 'left']: -7 }}>
      <Svg width={8} height={12} viewBox="0 0 8 12"><Path d={mine ? 'M0 0H8L0 12Z' : 'M8 0H0L8 12Z'} fill={background} /></Svg>
    </View>}
    {children}
  </Pressable>;
}

export function MessageMeta({ createdAtUtc, mine, read, delivered = false }: {
  createdAtUtc: string; mine: boolean; read: boolean; delivered?: boolean;
}) {
  const wa = useWa();
  const time = new Date(createdAtUtc).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const Status = read || delivered ? CheckCheck : Check;
  return <View testID="message-meta" accessibilityLabel={`${time}${mine ? read ? ' · Lida' : delivered ? ' · Entregue' : ' · Enviada' : ''}`} style={styles.meta}>
    <Text style={{ color: wa.meta, fontFamily: 'Manrope', fontSize: 11.5, lineHeight: 16 }}>{time}</Text>
    {mine && <Status size={16} strokeWidth={2} color={read ? wa.tick : wa.meta} />}
  </View>;
}

export function BubbleText({ body, foreground, metadata }: { body: string; foreground: string; metadata?: React.ReactNode }) {
  return <View style={{ minHeight: 22 }}>
    <Text style={{ fontFamily: 'Manrope', fontSize: 16, lineHeight: 22, color: foreground }}>
      {body}{metadata && <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ fontSize: 11, color: 'transparent' }}>{' '.repeat(6)}</Text>}
    </Text>
    {metadata && <View style={{ position: 'absolute', right: 0, bottom: 0 }}>{metadata}</View>}
  </View>;
}

export function ReplyQuote({ sender, body, mine, onPress }: { sender: string; body: string; mine: boolean; onPress?: () => void }) {
  const wa = useWa(), tone = senderTone(sender, wa.dark);
  return <Pressable disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? 'Ver mensagem citada' : undefined} onPress={onPress} style={{
    flexDirection: 'row', borderRadius: 8, overflow: 'hidden', marginBottom: 5, marginTop: 1,
    backgroundColor: wa.dark ? '#00000038' : mine ? '#0000000f' : '#0000000b',
  }}>
    <View style={{ width: 4, backgroundColor: tone }} />
    <View style={{ flex: 1, paddingVertical: 5, paddingHorizontal: 9 }}>
      <Text numberOfLines={1} style={{ fontFamily: 'ManropeExtraBold', fontSize: 13, lineHeight: 18, color: tone }}>{sender}</Text>
      <Text numberOfLines={2} style={{ fontFamily: 'Manrope', fontSize: 14, lineHeight: 19, color: wa.meta }}>{body}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '84%', paddingHorizontal: 9, paddingTop: 5, paddingBottom: 5, borderRadius: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
});
