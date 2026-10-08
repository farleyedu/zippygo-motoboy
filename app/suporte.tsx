import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HelpCircle, MessageCircle, Send, ShieldCheck } from 'lucide-react-native';
import { createIdentifier } from '../services/mobileApi';
import { sendSupport } from '../services/workApi';
import { useWork } from '../src/hooks/useWork';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Button, Feedback, Field, Header, SectionTitle, type } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

const categories: Record<string, string> = { delivery: 'Entrega', payment: 'Pagamento', account: 'Conta', location: 'Localização', security: 'Segurança' };
export default function SupportScreen() {
  const router = useRouter(), params = useLocalSearchParams<{ category?: string; pedido?: string; settlement?: string }>(), work = useWork('90'), turn = useOperationalSession(), { colors } = useZippyTheme();
  const [category, setCategory] = useState(categories[params.category || ''] ? params.category! : 'delivery');
  const [message, setMessage] = useState(params.pedido ? `Pedido #${params.pedido}: ` : params.settlement ? `Acerto ${params.settlement}: ` : '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const attempt = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => { attempt.current = null; setSuccess(''); setError(''); }, [work.store]);
  const send = async () => {
    if (busy || !work.store || !message.trim()) return;
    const key = `${work.store}:${category}:${message.trim()}`;
    if (attempt.current?.key !== key) attempt.current = { key, id: createIdentifier() };
    setBusy(true); setError(''); setSuccess('');
    try { const id = await sendSupport(work.store, attempt.current.id, category, message.trim()); setSuccess(`Solicitação ${id} registrada para a loja. Aguarde a revisão; isso não aciona emergência nem garante atendimento imediato.`); setMessage(''); attempt.current = null; work.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível registrar. Sua mensagem foi mantida.'); }
    finally { setBusy(false); }
  };
  return <AccountScreen><Header title="Tem apoio no seu caminho." subtitle="Ajuda e suporte" onBack={() => router.back()} /><View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><HelpCircle size={34} color={colors.accent} /></View><SectionTitle>O que precisa de atenção?</SectionTitle><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>{Object.entries(categories).map(([id, label]) => <Pressable key={id} disabled={busy} accessibilityRole="tab" accessibilityState={{ selected: category === id }} onPress={() => setCategory(id)} style={{ padding: 12, borderRadius: 20, backgroundColor: category === id ? colors.accentSoft : colors.soft }}><Text style={[type.small, { color: colors.ink }]}>{label}</Text></Pressable>)}</View><Field label="Descreva o que aconteceu" value={message} onChangeText={setMessage} multiline maxLength={2000} editable={!busy} /><View style={{ marginVertical: 16 }}><Button icon={Send} loading={busy} disabled={!work.store || !message.trim() || busy} onPress={() => void send()}>Registrar solicitação para a loja</Button></View>{!!error && <Feedback title="Solicitação não confirmada" message={error} />}{!!success && <Feedback title="Solicitação registrada" message={success} />}<MenuRow icon={MessageCircle} title="Falar com o estabelecimento" subtitle={turn.session ? 'Atendimento do turno' : 'O chat operacional requer um turno ativo'} disabled={!turn.session} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store' } })} /><MenuRow icon={ShieldCheck} title="Central de segurança" onPress={() => router.push('/seguranca')} /><SectionTitle>Suas solicitações</SectionTitle>{work.error && <Feedback title="Histórico de solicitações indisponível" message={work.error} onRetry={work.refresh} />}{work.data?.support.map(s => <View key={s.id} style={{ borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 14 }}><Text style={[type.small, { color: colors.ink, fontWeight: '800' }]}>{categories[s.category]} · {new Date(s.createdAtUtc).toLocaleString('pt-BR')}</Text><Text style={[type.body, { color: colors.muted }]}>{s.message}</Text></View>)}</AccountScreen>;
}
