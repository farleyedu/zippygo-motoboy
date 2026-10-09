import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtSign, Forward, Reply, SmilePlus, X } from 'lucide-react-native';
import { useZippyTheme } from '../ui/theme';
import { Avatar, Surface, type } from '../ui/Kit';

type EmojiData = { categories: { id: string; emojis: string[] }[]; emojis: Record<string, { name: string; skins: { native: string }[] }> };
const categories: Record<string, string> = { people: 'Pessoas', nature: 'Natureza', foods: 'Comidas', activity: 'Atividades', places: 'Lugares', objects: 'Objetos', symbols: 'Símbolos', flags: 'Bandeiras' };
export function ChatMessageActions({ message, senderName, onDismiss, onReply, onReact, onForward, onMention, busy = false }: {
  message: { body: string; attachment?: { contentType: string }; reactions?: { reaction: string; mine: boolean }[] };
  senderName: string; onDismiss: () => void; onReply: () => void; onReact?: (emoji: string | null) => void;
  onForward?: () => void; onMention?: () => void; busy?: boolean;
}) {
  const { colors } = useZippyTheme(), insets = useSafeAreaInsets();
  const [picker, setPicker] = useState(false), [category, setCategory] = useState('people'), [skin, setSkin] = useState(0);
  const data = useMemo(() => picker ? require('@emoji-mart/data') as EmojiData : null, [picker]);
  const choose = (emoji: string) => onReact?.(message.reactions?.some(r => r.mine && r.reaction === emoji) ? null : emoji);
  const actions = [{ name: 'Responder', icon: Reply, run: onReply }, ...(onForward ? [{ name: 'Encaminhar', icon: Forward, run: onForward }] : []), ...(onMention ? [{ name: 'Mencionar', icon: AtSign, run: onMention }] : [])];
  return <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
    <View style={{ flex: 1, backgroundColor: '#061126b8', justifyContent: 'flex-end' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Fechar ações" />
      <View style={{ padding: 16, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        <Surface style={{ padding: 15, marginBottom: 10 }}><View style={styles.row}><Avatar name={senderName} /><View style={{ flex: 1 }}><Text style={[type.small, { color: colors.accent, fontWeight: '800' }]}>{senderName}</Text><Text numberOfLines={3} style={[type.body, { color: colors.ink }]}>{message.body || (message.attachment?.contentType.startsWith('audio/') ? 'Mensagem de áudio' : 'Foto')}</Text></View><Pressable accessibilityLabel="Fechar" onPress={onDismiss} style={styles.touch}><X size={20} color={colors.muted} /></Pressable></View></Surface>
        <Surface style={{ padding: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          {onReact && <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 8 }]}>{['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => <Pressable key={emoji} disabled={busy} onPress={() => choose(emoji)} accessibilityRole="button" accessibilityLabel={'Reagir ' + emoji} style={[styles.touch, { borderRadius: 16, backgroundColor: message.reactions?.some(r => r.mine && r.reaction === emoji) ? colors.accentSoft : colors.soft }]}><Text style={{ fontSize: 25 }}>{emoji}</Text></Pressable>)}<Pressable disabled={busy} onPress={() => setPicker(v => !v)} accessibilityLabel="Todos os emojis" style={styles.touch}><SmilePlus color={colors.accent} size={24} /></Pressable></View>}
          {picker && data ? <>
            <ScrollView horizontal style={{ flexGrow: 0, height: 44 }} showsHorizontalScrollIndicator={false}>{data.categories.map(c => <Pressable key={c.id} onPress={() => setCategory(c.id)} style={{ padding: 10, borderRadius: 10, backgroundColor: category === c.id ? colors.accentSoft : colors.card }}><Text style={[type.small, { color: colors.accent }]}>{categories[c.id]}</Text></Pressable>)}</ScrollView>
            <View style={styles.row}>{['👋', '👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿'].map((emoji, index) => <Pressable key={emoji} onPress={() => setSkin(index)} accessibilityLabel={'Tom de pele ' + index} accessibilityState={{ selected: skin === index }} style={[styles.touch, { borderRadius: 12, backgroundColor: skin === index ? colors.accentSoft : colors.card }]}><Text style={{ fontSize: 22 }}>{emoji}</Text></Pressable>)}</View>
            <FlatList style={{ height: 240 }} data={data.categories.find(c => c.id === category)?.emojis || []} numColumns={7} keyExtractor={id => id} renderItem={({ item: id }) => { const emoji = data.emojis[id]; const native = (emoji.skins[skin] || emoji.skins[0]).native; return <Pressable style={{ flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center' }} disabled={busy} accessibilityLabel={emoji.name} onPress={() => choose(native)}><Text style={{ fontSize: 26 }}>{native}</Text></Pressable>; }} />
          </> : actions.map(action => <Pressable key={action.name} onPress={action.run} disabled={busy} accessibilityRole="button" style={[styles.row, { minHeight: 50, paddingHorizontal: 10 }]}><action.icon size={20} color={colors.accent} /><Text style={[type.body, { color: colors.ink }]}>{action.name}</Text></Pressable>)}
        </Surface>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 9 }, touch: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' } });
