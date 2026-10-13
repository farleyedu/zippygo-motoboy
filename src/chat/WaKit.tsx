import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ChevronDown, Paperclip, Reply, Search, Send, Smile, Keyboard as KeyboardIcon, X, LucideIcon } from 'lucide-react-native';
import { useZippyTheme } from '../ui/theme';

// Layout e hierarquia do WhatsApp, com a paleta neutra azul-acinzentada do ZippyGo.
export function useWa() {
  const { colors, dark, reducedMotion, vibration } = useZippyTheme();
  return {
    colors, dark, reducedMotion, vibration,
    header: dark ? '#17233a' : '#ffffff',
    wallpaper: dark ? '#0e1624' : '#e8ebef',
    incoming: dark ? '#1f2b3d' : '#ffffff',
    outgoing: dark ? '#2c4a74' : '#d6e2f3',
    field: dark ? '#1f2b3d' : '#ffffff',
    ink: dark ? '#e9eef7' : '#17202e',
    meta: dark ? '#9fb0c8' : '#667487',
    divider: dark ? '#26354d' : '#e3e8ef',
    chip: dark ? '#1b2941e6' : '#ffffffe6',
    tick: dark ? '#7ab8ff' : '#2f78e0',
    send: '#2f6fdc',
  };
}

const senderTones = { light: ['#2f6fdc', '#a8662a', '#1d8556', '#8a4fd0', '#c25043', '#14869b'], dark: ['#8fbcff', '#e0b27c', '#7fd9ac', '#c7a2f2', '#ffa898', '#74d2e4'] };
export function senderTone(name: string, dark: boolean) {
  let hash = 0; for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return senderTones[dark ? 'dark' : 'light'][hash % 6];
}

export function WaAvatar({ name, uri, size = 40 }: { name: string; uri?: string | null; size?: number }) {
  const wa = useWa(), [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  const tone = senderTone(name, wa.dark);
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: tone + '2b' }}>
    {uri && !failed ? <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size }} /> : <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: size * .38, color: tone }}>{initials}</Text>}
  </View>;
}

export type WaAction = { icon: LucideIcon; label: string; onPress: () => void };
export function WaHeader({ title, subtitle, avatar, avatarUri, onBack, onTitle, actions = [] }: { title: string; subtitle?: string; avatar?: string; avatarUri?: string | null; onBack: () => void; onTitle?: () => void; actions?: WaAction[] }) {
  const wa = useWa(), insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: wa.header, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: wa.divider }}>
    <View style={{ height: 58, flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={6} style={({ pressed }) => ({ height: 48, paddingLeft: 10, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 2, opacity: pressed ? .6 : 1 })}>
        <ArrowLeft size={23} color={wa.ink} strokeWidth={2} />
        {avatar != null && <WaAvatar name={avatar} uri={avatarUri} size={38} />}
      </Pressable>
      <Pressable accessibilityRole={onTitle ? 'button' : 'header'} accessibilityLabel={title} disabled={!onTitle} onPress={onTitle} style={{ flex: 1, minWidth: 0, paddingHorizontal: 8, justifyContent: 'center' }}>
        <Text numberOfLines={1} style={{ fontFamily: 'ManropeExtraBold', fontSize: 17, letterSpacing: -.2, color: wa.ink }}>{title}</Text>
        {!!subtitle && <Text numberOfLines={1} style={{ fontFamily: 'Manrope', fontSize: 12.5, color: wa.meta, marginTop: 1 }}>{subtitle}</Text>}
      </Pressable>
      {actions.map(action => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={({ pressed }) => ({ width: 44, height: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .55 : 1 })}><action.icon size={21} color={wa.ink} strokeWidth={1.9} /></Pressable>)}
    </View>
  </View>;
}

export function dayLabel(iso: string, now = new Date()) {
  const date = new Date(iso), start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86400000);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return date.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^./, c => c.toUpperCase());
  return date.toLocaleDateString('pt-BR');
}
export const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

export function WaChip({ children }: { children: string }) {
  const wa = useWa();
  return <View style={{ alignSelf: 'center', marginTop: 12, marginBottom: 6, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 9, backgroundColor: wa.chip, boxShadow: '0 1px 1px #0000001a' }}><Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 12, color: wa.meta }}>{children}</Text></View>;
}

/** Botão redondo que leva ao fim da conversa, com a contagem de novidades recebidas enquanto você lia. */
export function WaScrollFab({ visible, count, onPress, bottom }: { visible: boolean; count: number; onPress: () => void; bottom: number }) {
  const wa = useWa();
  if (!visible) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={count ? `Ir para o fim, ${count} novas mensagens` : 'Ir para o fim da conversa'} onPress={onPress} style={{ position: 'absolute', right: 14, bottom, width: 44, height: 44, borderRadius: 22, backgroundColor: wa.header, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px #00000033', borderWidth: StyleSheet.hairlineWidth, borderColor: wa.divider }}>
    <ChevronDown size={24} color={wa.meta} />
    {count > 0 && <View style={{ position: 'absolute', top: -8, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: wa.send, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 11, color: '#fff' }}>{count > 99 ? '99+' : count}</Text></View>}
  </Pressable>;
}

/** Arraste a mensagem para a direita para responder, como no WhatsApp. */
export function SwipeReply({ enabled = true, onReply, children }: { enabled?: boolean; onReply: () => void; children: React.ReactNode }) {
  const wa = useWa(), shift = useRef(new Animated.Value(0)).current, fired = useRef(false);
  const latest = useRef({ onReply, enabled, vibration: wa.vibration }); latest.current = { onReply, enabled, vibration: wa.vibration };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => latest.current.enabled && g.dx > 12 && g.dx > Math.abs(g.dy) * 2,
    onPanResponderMove: (_, g) => {
      const x = Math.max(0, Math.min(72, g.dx * .8)); shift.setValue(x);
      if (x >= 52 && !fired.current) { fired.current = true; if (latest.current.vibration && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }
    },
    onPanResponderRelease: () => { if (fired.current) latest.current.onReply(); fired.current = false; Animated.spring(shift, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 240 }).start(); },
    onPanResponderTerminate: () => { fired.current = false; Animated.spring(shift, { toValue: 0, useNativeDriver: true }).start(); },
  }), [shift]);
  return <View {...pan.panHandlers}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 0, bottom: 0, justifyContent: 'center', opacity: shift.interpolate({ inputRange: [0, 48], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale: shift.interpolate({ inputRange: [0, 52], outputRange: [.5, 1], extrapolate: 'clamp' }) }] }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: wa.chip, alignItems: 'center', justifyContent: 'center' }}><Reply size={17} color={wa.meta} /></View>
    </Animated.View>
    <Animated.View style={{ transform: [{ translateX: shift }] }}>{children}</Animated.View>
  </View>;
}

type EmojiData = { categories: { id: string; emojis: string[] }[]; emojis: Record<string, { skins: { native: string }[] }> };
const emojiTabs: Record<string, string> = { people: '😀', nature: '🐶', foods: '🍕', activity: '⚽', places: '🚗', objects: '💡', symbols: '❤️', flags: '🏁' };
function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const wa = useWa(), [category, setCategory] = useState('people');
  const data = useMemo(() => require('@emoji-mart/data') as EmojiData, []);
  const list = data.categories.find(c => c.id === category)?.emojis || [];
  return <View style={{ height: 270, backgroundColor: wa.header, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: wa.divider }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 44 }} contentContainerStyle={{ paddingHorizontal: 8 }}>
      {data.categories.filter(c => emojiTabs[c.id]).map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Emojis: ${c.id}`} onPress={() => setCategory(c.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: category === c.id ? wa.send : 'transparent' }}><Text style={{ fontSize: 21 }}>{emojiTabs[c.id]}</Text></Pressable>)}
    </ScrollView>
    <FlatList data={list} numColumns={8} keyExtractor={id => id} initialNumToRender={48} windowSize={5} keyboardShouldPersistTaps="always"
      renderItem={({ item: id }) => { const native = data.emojis[id]?.skins[0]?.native; return native ? <Pressable accessibilityLabel={native} onPress={() => onPick(native)} style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 25 }}>{native}</Text></Pressable> : null; }} />
  </View>;
}

export type ComposerProps = {
  value: string; onChange: (text: string) => void; onSend: () => void; onAttach?: () => void; onFocus?: () => void;
  disabled?: boolean; busy?: boolean; editable?: boolean; audio?: React.ReactNode; placeholder?: string; maxLength?: number; keyboardVisible: boolean;
  top?: React.ReactNode; accessory?: React.ReactNode;
};
/** Campo arredondado + botão redondo que vira microfone quando não há texto. */
export function WaComposer(props: ComposerProps) {
  const wa = useWa(), insets = useSafeAreaInsets(), [emoji, setEmoji] = useState(false), input = useRef<TextInput>(null);
  const hasText = !!props.value.trim();
  return <View style={{ backgroundColor: 'transparent' }}>
    {props.top}
    {props.accessory}
    <View style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: emoji ? 6 : props.keyboardVisible ? 6 : Math.max(insets.bottom, 8) }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      <View style={{ flex: 1, minHeight: 48, maxHeight: 140, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, backgroundColor: wa.field, boxShadow: '0 1px 1px #0000001a', paddingHorizontal: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={emoji ? 'Mostrar teclado' : 'Emojis'} onPress={() => { if (emoji) { setEmoji(false); input.current?.focus(); } else { setEmoji(true); input.current?.blur(); } }} style={{ width: 42, height: 48, alignItems: 'center', justifyContent: 'center' }}>{emoji ? <KeyboardIcon size={23} color={wa.meta} /> : <Smile size={23} color={wa.meta} />}</Pressable>
        <TextInput ref={input} accessibilityLabel="Mensagem" multiline placeholder={props.placeholder || 'Mensagem'} placeholderTextColor={wa.meta} value={props.value} onChangeText={props.onChange} maxLength={props.maxLength ?? 500} editable={props.editable ?? !props.disabled}
          onFocus={() => { setEmoji(false); props.onFocus?.(); }} selectionColor={wa.send}
          style={{ flex: 1, minWidth: 0, maxHeight: 124, paddingTop: Platform.OS === 'web' ? 13 : 11, paddingBottom: 11, paddingHorizontal: 2, fontFamily: 'Manrope', fontSize: 16.5, lineHeight: 22, color: wa.ink, outlineStyle: 'none' } as never} />
        {!!props.onAttach && <Pressable accessibilityRole="button" accessibilityLabel="Anexar foto" disabled={props.disabled} onPress={props.onAttach} style={{ width: 42, height: 48, alignItems: 'center', justifyContent: 'center', opacity: props.disabled ? .5 : 1 }}><Paperclip size={22} color={wa.meta} style={{ transform: [{ rotate: '-45deg' }] }} /></Pressable>}
      </View>
      {hasText
        ? <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" disabled={props.disabled || props.busy} onPress={props.onSend} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: wa.send, alignItems: 'center', justifyContent: 'center', opacity: props.disabled || props.busy ? .6 : pressed ? .85 : 1, boxShadow: '0 1px 2px #0000002e' })}><Send size={20} color="#fff" /></Pressable>
        : props.audio}
    </View>
    </View>
    {emoji && <EmojiPanel onPick={emojiChar => props.onChange(props.value + emojiChar)} />}
  </View>;
}

/** Faixa "Respondendo a…" acima do campo, com a barra colorida do WhatsApp. */
export function WaReplyBar({ sender, body, onCancel }: { sender: string; body: string; onCancel: () => void }) {
  const wa = useWa(), tone = senderTone(sender, wa.dark);
  return <View style={{ marginHorizontal: 8, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, paddingRight: 4, borderRadius: 14, backgroundColor: wa.field }}>
    <View style={{ flex: 1, flexDirection: 'row', borderRadius: 9, overflow: 'hidden', backgroundColor: wa.dark ? '#00000030' : '#0000000a' }}>
      <View style={{ width: 4, backgroundColor: tone }} />
      <View style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 9 }}>
        <Text numberOfLines={1} style={{ fontFamily: 'ManropeExtraBold', fontSize: 12.5, color: tone }}>{sender}</Text>
        <Text numberOfLines={2} style={{ fontFamily: 'Manrope', fontSize: 13.5, color: wa.meta }}>{body}</Text>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Cancelar resposta" onPress={onCancel} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><X size={19} color={wa.meta} /></Pressable>
  </View>;
}

/** Página de chat: cabeçalho próprio, sem o respiro do Screen padrão. */
export function WaPage({ header, children, footer, background }: { header: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; background?: string }) {
  const wa = useWa();
  return <View style={{ flex: 1, backgroundColor: background ?? wa.header }}>
    <StatusBar style={wa.dark ? 'light' : 'dark'} />
    <View style={{ width: '100%', maxWidth: 480, flex: 1, minHeight: 0, alignSelf: 'center' }}>{header}{children}</View>
    {footer}
  </View>;
}

/** Linha de conversa: avatar grande, nome, prévia, horário e contador. */
export function WaListRow({ name, title, preview, time, unread = 0, online, icon: Icon, onPress }: { name: string; title: string; preview: string; time?: string; unread?: number; online?: boolean; icon?: LucideIcon; onPress: () => void }) {
  const wa = useWa();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}${unread ? `, ${unread} não lidas` : ''}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, paddingRight: 16, backgroundColor: pressed ? wa.divider : 'transparent' })}>
    <View>
      <WaAvatar name={name} size={52} />
      {online && <View style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: wa.colors.success, borderWidth: 2, borderColor: wa.header }} />}
    </View>
    <View style={{ flex: 1, minWidth: 0, minHeight: 74, justifyContent: 'center', gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: wa.divider }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'ManropeExtraBold', fontSize: 16.5, letterSpacing: -.2, color: wa.ink }}>{title}</Text>
        {!!time && <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: unread ? '800' : '500', color: unread ? wa.send : wa.meta }}>{time}</Text>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={14} color={wa.meta} />}
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14.5, color: unread ? wa.ink : wa.meta, fontWeight: unread ? '700' : '500' }}>{preview}</Text>
        {unread > 0 && <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: wa.send, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: '#fff' }}>{unread > 99 ? '99+' : unread}</Text></View>}
      </View>
    </View>
  </Pressable>;
}

/** Campo de busca em pílula, como na lista do WhatsApp. */
export function WaSearch({ value, onChange, placeholder, label }: { value: string; onChange: (text: string) => void; placeholder: string; label: string }) {
  const wa = useWa();
  return <View style={{ marginHorizontal: 12, marginBottom: 8, height: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 22, backgroundColor: wa.dark ? '#1f2b3d' : '#eef1f5' }}>
    <Search size={18} color={wa.meta} />
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={wa.meta} selectionColor={wa.send} style={{ flex: 1, minWidth: 0, fontFamily: 'Manrope', fontSize: 16, color: wa.ink, paddingVertical: 8, outlineStyle: 'none' } as never} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => onChange('')} hitSlop={8}><X size={17} color={wa.meta} /></Pressable>}
  </View>;
}

/** Filtros em pílulas (Todas, Não lidas…). */
export function WaFilters({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  const wa = useWa();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 10 }}>
    {options.map(label => { const on = value === label; return <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(label)} style={{ height: 34, paddingHorizontal: 15, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? wa.send + '24' : wa.dark ? '#1f2b3d' : '#eef1f5' }}><Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 13.5, color: on ? wa.send : wa.meta }}>{label}</Text></Pressable>; })}
  </ScrollView>;
}

/** Botão flutuante de nova conversa. */
export function WaFab({ icon: Icon, label, onPress, bottom }: { icon: LucideIcon; label: string; onPress: () => void; bottom: number }) {
  const wa = useWa();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ position: 'absolute', right: 18, bottom, width: 58, height: 58, borderRadius: 18, backgroundColor: wa.send, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px #00000040', opacity: pressed ? .9 : 1 })}><Icon size={24} color="#fff" /></Pressable>;
}
