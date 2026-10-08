import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeftRight, Check, ShieldCheck, Users } from 'lucide-react-native';
import { getTransferTargets, requestTransfer, TransferTarget } from '../services/routeApi';
import { getOperationalQueue } from '../services/mobileApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { AccountNotice } from '../src/ui/AccountKit';
import { Avatar, Button, Feedback, Field, Header, SectionTitle, Surface, type } from '../src/ui/Kit';
import { activeStops, RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

export default function TransferScreen() {
  const params = useLocalSearchParams<{ pedidoId: string }>(), router = useRouter(), turn = useOperationalSession(), action = useRouteAction(), { colors } = useZippyTheme();
  const pedidoId = Number(params.pedidoId) || turn.queue?.current?.pedidoId || 0;
  const stop = activeStops(turn.queue).find(s => s.pedidoId === pedidoId), policy = String(turn.queue?.politicas?.transferPolicy || 'disabled');
  const [targets, setTargets] = useState<TransferTarget[]>([]), [selected, setSelected] = useState<number | null>(null), [reason, setReason] = useState(''), [confirm, setConfirm] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => { request.current?.abort(); const c = new AbortController(); request.current = c; setLoading(true); setError(''); try { const list = await getTransferTargets(c.signal); if (!c.signal.aborted) { setTargets(list); setSelected(null); } } catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Tente novamente.'); } finally { if (!c.signal.aborted) setLoading(false); } }, [turn.session?.sessionId]);
  useFocusEffect(useCallback(() => { void load(); return () => request.current?.abort(); }, [load]));
  const send = () => { if (!selected || !reason.trim() || !stop || policy === 'disabled') return; let transferId = 0; void action.run(async () => { const result = await requestTransfer(pedidoId, selected, reason.trim()); transferId = result.transfer.id; return result.sourceQueue || getOperationalQueue(); }, () => router.replace({ pathname: '/acompanharTransferencia', params: { id: String(transferId) } })); };
  return <RouteScreen><Header title="Trocar o responsável." subtitle={`Transferência · #${pedidoId}`} onBack={() => router.back()} /><AccountNotice warning icon={ShieldCheck}>{policy === 'disabled' ? 'A loja não permite transferência pelo motoboy.' : policy === 'direct' ? 'A transferência direta muda o responsável após confirmação do servidor.' : 'A transferência precisa da aprovação da loja. Você continua responsável enquanto aguarda.'}</AccountNotice><SectionTitle>Quem pode receber?</SectionTitle>
    {loading && <Feedback title="Conferindo os colegas disponíveis" loading />}{error && <Feedback title="Não foi possível carregar os colegas" message={error} onRetry={() => void load()} />}
    <Surface style={{ paddingVertical: 0 }}>{targets.map(target => <Pressable key={target.motoboyId} accessibilityRole="radio" accessibilityState={{ checked: selected === target.motoboyId }} accessibilityLabel={target.nome} disabled={action.busy} onPress={() => { setSelected(target.motoboyId); setConfirm(false); }} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: colors.line }}><Avatar name={target.nome} /><View style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.ink }}>{target.nome}</Text><Text style={[type.small, { color: colors.muted }]}>{target.hasCurrentDelivery ? 'Em rota' : 'Disponível'} · {target.queueSize} pedidos</Text></View><View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: selected === target.motoboyId ? colors.accent : colors.line, backgroundColor: selected === target.motoboyId ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{selected === target.motoboyId && <Check size={14} color={colors.paper} />}</View></Pressable>)}{!loading && !targets.length && <Text style={[type.body, { color: colors.muted, paddingVertical: 18 }]}>Nenhum colega elegível neste momento.</Text>}</Surface>
    <View style={{ marginTop: 18, marginBottom: 16 }}><Field label="Motivo da transferência" placeholder="Explique para a loja e seu colega…" value={reason} onChangeText={v => { setReason(v); setConfirm(false); }} multiline maxLength={500} editable={!action.busy} /></View>
    {!stop && <Feedback title="O pedido saiu da sua fila" message="Confira a rota atual antes de continuar." />}{stop?.locked && <AccountNotice warning icon={ShieldCheck}>Este pedido está travado pela loja. O atendimento precisa orientar a mudança.</AccountNotice>}
    {action.error && <Feedback title="A transferência não foi confirmada" message={action.error} onRetry={() => void load()} />}
    <Button icon={ArrowLeftRight} disabled={!stop || stop.locked || !selected || !reason.trim() || policy === 'disabled' || action.busy} loading={action.busy} onPress={() => confirm ? send() : setConfirm(true)}>{confirm ? policy === 'direct' ? 'Confirmar transferência agora' : 'Confirmar solicitação à loja' : policy === 'direct' ? 'Revisar transferência' : 'Pedir transferência'}</Button>
    <AccountNotice icon={Users}>{confirm ? `Destino: ${targets.find(t => t.motoboyId === selected)?.nome}. Confira antes de confirmar.` : 'Até confirmar, o pedido continua sob sua responsabilidade.'}</AccountNotice>
  </RouteScreen>;
}
