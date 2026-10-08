import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, CheckSquare, HelpCircle, Square, Wallet } from 'lucide-react-native';
import { settlementAction } from '../services/workApi';
import { useWork } from '../src/hooks/useWork';
import { AccountNotice, AccountScreen } from '../src/ui/AccountKit';
import { Button, Feedback, Field, Header, SectionTitle, money, type } from '../src/ui/Kit';
import { periodBreakdown, WorkPair, WorkState, settlementStatus } from '../src/ui/WorkKit';
import { useZippyTheme } from '../src/ui/theme';

export default function SettlementScreen() {
  const router = useRouter(), work = useWork('90'), { colors } = useZippyTheme();
  const [checked, setChecked] = useState<string | null>(null), [dispute, setDispute] = useState<string | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const run = async (id: string, action: 'review' | 'dispute' | 'receive') => {
    if (busy || !work.store) return;
    setBusy(true); setError('');
    try { await settlementAction(work.store, id, action, action === 'dispute' ? reason.trim() : undefined); setChecked(null); setDispute(null); setReason(''); work.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'O acerto não mudou. Tente novamente.'); }
    finally { setBusy(false); }
  };
  return <AccountScreen active="earnings"><Header title="Tudo certo entre vocês." subtitle="Acerto com a loja" onBack={() => router.back()} /><WorkState {...work} />{!!error && <Feedback title="A conferência não foi registrada" message={error} />}{work.data && <>
    <SectionTitle>São contas diferentes</SectionTitle><WorkPair label="Sua remuneração a receber" value={money(work.data.balance.outstanding)} /><WorkPair label="Dinheiro da loja a devolver" value={money(work.data.balance.cashToReturn)} /><AccountNotice icon={Wallet}>O acerto não compensa valores automaticamente. A loja registra o pagamento e a devolução separadamente; você confirma somente o que recebeu.</AccountNotice>
    {!work.data.settlements.length && <Feedback title="Nenhum acerto gerado" message="Os ganhos permanecem registrados. Peça à loja que gere o resumo para sua conferência." />}
    {!!work.data.unconfirmedReceipts && <AccountNotice icon={Wallet} warning>Há recebimentos ainda não conferidos. Eles precisam ser resolvidos antes de gerar um novo acerto.</AccountNotice>}
    {work.data.settlements.map(s => <View key={s.id} style={{ borderTopWidth: 1, borderColor: colors.line, paddingVertical: 20, gap: 12 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>{settlementStatus[s.status] || s.status}</Text><Text style={[type.small, { color: colors.muted }]}>{new Date(s.createdAtUtc).toLocaleString('pt-BR')}</Text><WorkPair label="Seu repasse previsto" value={money(s.earnings)} /><WorkPair label="Dinheiro a devolver à loja" value={money(s.storeCash)} /><WorkPair label="Devolução" value={s.cashReturned ? 'Recebida pela loja' : 'Não confirmada pela loja'} />
      <SectionTitle>Lançamentos deste acerto</SectionTitle>{work.data?.settlementEntries.filter(e => e.settlementId === s.id).map(e => <View key={e.id}>
        <WorkPair label={e.kind === 'delivery' ? `Pedido #${e.pedidoId}` : `Período · ${new Date(e.fromUtc).toLocaleDateString('pt-BR')} a ${new Date(e.toUtc).toLocaleDateString('pt-BR')}`} value={`${money(e.amount)} · loja ${money(e.storeCash)}`} />
        {!!periodBreakdown(e) && <Text style={[type.small, { color: colors.muted, marginTop: -6, marginBottom: 6 }]}>{periodBreakdown(e)}</Text>}
        {!!e.backfilled && <Text style={[type.small, { color: colors.warning, marginTop: -6, marginBottom: 6 }]}>Valor aplicado pela loja depois da entrega, com a regra atual</Text>}
      </View>)}
      {!!s.reason && <Text style={[type.small, { color: colors.warning }]}>{s.reason}</Text>}{!!s.reference && <WorkPair label={`Pagamento registrado · ${s.method}`} value={s.reference} />}
      {['draft', 'disputed', 'paid'].includes(s.status) && <><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: checked === s.id, disabled: busy }} disabled={busy} onPress={() => setChecked(checked === s.id ? null : s.id)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 10 }}>{checked === s.id ? <CheckSquare size={22} color={colors.accent} /> : <Square size={22} color={colors.muted} />}<Text style={[type.small, { flex: 1, color: colors.ink }]}>{s.status === 'paid' ? 'Conferi e realmente recebi este pagamento.' : 'Revisei os lançamentos e os recebimentos deste acerto.'}</Text></Pressable><Button icon={Check} loading={busy} disabled={checked !== s.id || busy} onPress={() => void run(s.id, s.status === 'paid' ? 'receive' : 'review')}>{s.status === 'paid' ? 'Confirmar que recebi' : 'Confirmar conferência'}</Button></>}
      {['draft', 'reviewed'].includes(s.status) && <Button secondary icon={HelpCircle} disabled={busy} onPress={() => { setDispute(dispute === s.id ? null : s.id); setReason(''); }}>Encontrei uma diferença</Button>}
      {dispute === s.id && <><Field label="O que precisa ser revisado?" value={reason} onChangeText={setReason} multiline maxLength={1000} editable={!busy} /><Button icon={HelpCircle} disabled={!reason.trim() || busy} loading={busy} onPress={() => void run(s.id, 'dispute')}>Registrar divergência</Button></>}
      {s.status === 'paid' && <Button secondary icon={HelpCircle} onPress={() => router.push({ pathname: '/suporte', params: { category: 'payment', settlement: s.id } })}>Não recebi ou preciso de ajuda</Button>}
    </View>)}<Button secondary icon={Check} onPress={() => router.push('/resumoTurno')}>Ver resumo do turno</Button>
  </>}</AccountScreen>;
}
