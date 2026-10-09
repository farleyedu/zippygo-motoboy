import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Forward, Store, UserRound, Users, X } from 'lucide-react-native';
import { listChatContacts, type ChatAttachment, type ChatContact, type ChatTarget } from '../../services/communicationApi';
import { createIdentifier } from '../../services/mobileApi';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { Button, Feedback, Surface, type } from '../ui/Kit';
import { MenuRow } from '../ui/AccountKit';
import { useZippyTheme } from '../ui/theme';
import { openChatFile, retainChatFile } from './media';
import type { createChatOutbox } from './outbox';

export function ChatForwardSheet({ message, outbox, onDismiss }: { message: { body: string; attachment?: ChatAttachment }; outbox: ReturnType<typeof createChatOutbox>; onDismiss: () => void }) {
  const turn = useOperationalSession(), { colors } = useZippyTheme(), insets = useSafeAreaInsets(), router = useRouter();
  const [contacts, setContacts] = useState<ChatContact[]>([]), [target, setTarget] = useState<ChatTarget | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), sending = useRef(false), session = useRef(turn.session?.sessionId); session.current = turn.session?.sessionId;
  useEffect(() => { alive.current = true; const scope = session.current; void listChatContacts().then(rows => { if (alive.current && session.current === scope) setContacts(rows); }).catch(e => { if (alive.current) setError(e instanceof Error ? e.message : 'Não foi possível consultar os participantes.'); }); return () => { alive.current = false; }; }, [turn.session?.sessionId]);
  const choices = [{ name: 'Estabelecimento', subtitle: 'Conversa com a loja', icon: Store, target: { channel: 'store' } as ChatTarget }, { name: 'Grupo da loja', subtitle: 'Todos os participantes da equipe', icon: Users, target: { channel: 'group' } as ChatTarget }, ...contacts.filter(c => c.motoboyId !== turn.queue?.motoboyId).map(c => ({ name: c.nome, subtitle: c.online ? 'Online' : 'Motoboy da equipe', icon: UserRound, target: { channel: 'private', target: c.motoboyId } as ChatTarget }))];
  const confirm = async () => {
    if (!target || sending.current || !session.current) return;
    sending.current = true; setBusy(true); setError(''); const scope = session.current;
    try {
      let file;
      if (message.attachment) {
        const attachment = message.attachment, uri = await openChatFile(attachment.id, attachment.clientPedidoId);
        const normalized = uri.endsWith('.m4a') || uri.startsWith('data:audio/mp4;');
        file = await retainChatFile({ uri, name: normalized ? attachment.name.replace(/\.[^.]+$/, '') + '.m4a' : attachment.name, contentType: normalized ? 'audio/mp4' : attachment.contentType });
      }
      if (!alive.current || scope !== session.current) return;
      await outbox.enqueue({ target, request: { clientId: createIdentifier(), body: message.body, forwarded: true, mentions: [] }, file, state: 'queued', createdAtUtc: new Date().toISOString() });
      if (!alive.current || scope !== session.current) return;
      void outbox.flush().catch(() => {});
      onDismiss(); router.navigate({ pathname: '/conversas', params: { channel: target.channel, ...(target.target ? { target: String(target.target) } : {}) } });
    } catch (e) { if (alive.current && scope === session.current) setError(e instanceof Error ? e.message : 'Não foi possível encaminhar a mensagem.'); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  };
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onDismiss(); }}><View style={{ flex: 1, backgroundColor: '#061126b8', justifyContent: 'flex-end' }}><Pressable onPress={() => { if (!busy) onDismiss(); }} style={{ flex: 1 }} accessibilityLabel="Fechar encaminhamento" /><Surface style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: Math.max(insets.bottom, 16), maxHeight: '80%' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Forward color={colors.accent} size={22} /><Text style={[type.body, { color: colors.ink, fontFamily: 'ManropeExtraBold', flex: 1 }]}>Encaminhar mensagem</Text><Pressable disabled={busy} onPress={onDismiss} accessibilityLabel="Fechar" style={{ padding: 10 }}><X color={colors.muted} size={20} /></Pressable></View><Text numberOfLines={3} style={[type.small, { color: colors.muted, marginVertical: 12 }]}>{message.body || (message.attachment?.contentType.startsWith('audio/') ? 'Mensagem de áudio' : 'Foto')}</Text>
    <ScrollView style={{ maxHeight: 310 }}>{choices.map(choice => <MenuRow key={choice.target.channel + ':' + choice.target.target} icon={choice.icon} title={choice.name} subtitle={choice.subtitle} disabled={busy} onPress={() => setTarget(choice.target)} right={<View style={{ width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: colors.accent, backgroundColor: choice.target.channel === target?.channel && choice.target.target === target?.target ? colors.accent : colors.card }} />} />)}</ScrollView>{!!error && <Feedback title="Mensagem não encaminhada" message={error} />}<View style={{ marginTop: 16 }}><Button icon={Forward} loading={busy} disabled={!target || busy} onPress={() => void confirm()}>Confirmar encaminhamento</Button></View>
  </Surface></View></Modal>;
}
