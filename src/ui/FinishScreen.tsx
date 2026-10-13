import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { Camera, HelpCircle, Lock, MessageCircle, Package, ShieldCheck, Wallet } from 'lucide-react-native';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { readyToComplete } from '../delivery/completionRules';
import { checklistItems } from '../delivery/checklistRules';
import { canConcludeOperationalOrder, operationalDestination } from '../delivery/operationalDestination';
import { AccountNotice } from './AccountKit';
import { Button, Feedback, Header, type } from './Kit';
import { CompletionScreen, money, SlideConfirm, StepCard, TextAction } from './CompletionKit';
import { useOrderChecklists } from '../hooks/useOrderChecklists';
import { OrderChecklistCard } from './OrderChecklistCard';
import { DeliveryCodePanel, DeliveryPaymentPanel, DeliveryProofPanel } from './DeliveryPanels';
import { FinishHero, type FinishStep } from './FinishKit';
import { useZippyTheme } from './theme';

export default function FinishScreen() {
  const completion = useDeliveryCompletion(), turn = useOperationalSession(), router = useRouter();
  const { id, panel } = useLocalSearchParams<{ id?: string; panel?: string }>(), { colors } = useZippyTheme();
  const pedido = Number(id) || turn.queue?.current?.pedidoId || 0;
  const [savingItems, setSavingItems] = useState(false), [paymentEditing, setPaymentEditing] = useState(false);
  const [showPayment, setShowPayment] = useState(panel === 'payment' || panel === 'split'), [showProof, setShowProof] = useState(panel === 'proof');
  const saving = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!pedido || !turn.session || !turn.queue?.estabelecimentoId || turn.busy || completion.loading || !canConcludeOperationalOrder(turn.queue, pedido)) return;
    if (completion.draft?.phase === 'completed' && completion.draft.context.pedidoId === pedido) { router.replace(operationalDestination(turn.store.getSnapshot().queue, Platform.OS)); return; }
    if (!['pending', 'sending'].includes(completion.draft?.phase || '')) void completion.prepare(pedido);
  }, [pedido, turn.session?.sessionId, turn.queue?.estabelecimentoId, turn.queue?.version, turn.busy, completion.loading]));
  const d = completion.draft, c = d?.context, matching = c?.pedidoId === pedido;
  useEffect(() => { setPaymentEditing(false); setShowPayment(panel === 'payment' || panel === 'split' || !!d?.request.payments.length); setShowProof(panel === 'proof'); }, [d?.request.operationId, panel]);
  const orders = matching && c?.checklist ? [{ id: pedido, nomeCliente: c.nomeCliente, checklist: c.checklist }] : [];
  const checks = useOrderChecklists(orders, 'delivery');
  const extraKeys = c?.checklist ? checklistItems(c.checklist).filter(item => item.extra).map(item => item.key) : [];
  // Apenas antecipa a elegibilidade; a confirmação dos destaques é gravada após o gesto.
  const candidate = checks.confirmations[0] ? { ...checks.confirmations[0], recheckedExtraKeys: extraKeys } : undefined;
  const codeReady = !!c && (!c.requiresCode || !!d?.codeChecked);
  const paymentReady = !!c && (!c.requiresPayment || !paymentEditing && !!d?.request.payments.length);
  const proofReady = !!c && (!c.requiresProof || !!d?.request.proofId);
  const missing = !checks.primaryReady ? 'Confira a sacola e os itens destacados.' : !codeReady ? 'Falta validar o código do cliente.' : !paymentReady ? 'Falta confirmar o recebimento.' : !proofReady ? 'Falta anexar o comprovante.' : 'Aguarde a confirmação do servidor.';
  const can = canConcludeOperationalOrder(turn.queue, pedido) && !!c?.checklist && checks.primaryReady && !paymentEditing && !!d && matching && d.phase === 'draft' && readyToComplete(d.context, d.codeChecked, d.request.payments, d.request.proofId, candidate);
  const finish = async () => {
    if (!can || saving.current) return;
    saving.current = true; setSavingItems(true);
    try {
      const confirmations = extraKeys.length ? await checks.confirmExtras() : checks.confirmations;
      if (!confirmations || !await completion.confirmItems(confirmations[0])) return;
      const receipt = await completion.submit();
      if (receipt) router.replace(operationalDestination(turn.store.getSnapshot().queue, Platform.OS));
    } finally { saving.current = false; setSavingItems(false); }
  };
  const showProofStep = !!c && (c.requiresProof || !!d?.request.proofId || showProof);
  const steps: FinishStep[] = c ? [
    { key: 'bag', label: 'Sacola', done: checks.primaryReady, icon: Package },
    ...(c.requiresCode ? [{ key: 'code', label: 'Código', done: codeReady, icon: Lock }] : []),
    ...(c.requiresPayment ? [{ key: 'payment', label: 'Recebimento', done: paymentReady, icon: Wallet }] : []),
    ...(showProofStep ? [{ key: 'proof', label: 'Comprovante', done: proofReady, icon: Camera }] : []),
  ] : [];
  const footer = matching && d && c ? <View style={{ gap: 4 }}>
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 6 }}><ShieldCheck size={15} color={can ? colors.success : colors.accent} /><Text style={[type.small, { flex: 1, fontSize: 10, lineHeight: 15, color: colors.muted }]}>{can ? extraKeys.length ? 'Ao arrastar, você confirma também a entrega dos itens destacados acima.' : 'Tudo conferido. O arraste registra a conclusão.' : missing}</Text></View>
    <SlideConfirm enabled={can && !completion.busy && !savingItems} busy={completion.busy || savingItems} onConfirm={() => void finish()} />
    <Text style={{ fontFamily: 'Manrope', fontSize: 9, color: colors.muted, textAlign: 'center', marginTop: 6 }}>Um gesto. Entrega e recebimento registrados juntos.</Text>
  </View> : undefined;
  return <CompletionScreen footer={footer}>
    <Header title="Conferir & concluir" subtitle={'#' + pedido + ' · ' + (c?.nomeCliente || 'Sua entrega')} onBack={() => router.canGoBack() ? router.back() : router.replace('/mapa')} />
    {!matching || !d || !c ? <>
      <Feedback title="Conferindo o pedido" loading={completion.busy || !completion.error} onRetry={completion.error ? () => void completion.prepare(pedido) : undefined} />
      {d?.phase === 'draft' && !matching && <Button secondary loading={completion.busy} onPress={async () => { if (await completion.discardUnsent()) await completion.prepare(pedido); }}>Descartar conferência anterior e revisar este pedido</Button>}
    </> : <>
      <FinishHero pedido={pedido} name={c.nomeCliente} steps={steps} receive={c.requiresPayment ? { amount: c.total, confirmed: paymentReady } : undefined} />
      {orders.map((order, i) => <OrderChecklistCard key={order.id} stage="delivery" order={order} confirmation={checks.confirmations[i]} disabled={checks.loading || completion.busy || savingItems || d.phase !== 'draft'} onToggle={key => void checks.toggle(order, key)} onToggleBag={() => void checks.toggleBag(order)} />)}
      {!c.checklist && <Feedback title="Conferência indisponível" message="Não foi possível carregar os itens desta entrega." />}
      {!!checks.error && <Feedback title="Confira os itens" message={checks.error} />}
      <View style={{ height: 18 }} />
      {c.requiresCode && <StepCard index={1} icon={codeReady ? ShieldCheck : Lock} verified={codeReady} code title="Código do cliente" description={codeReady ? 'Validado. Este código fica visível.' : 'Peça o código quando entregar o pedido.'}>
        <DeliveryCodePanel key={d.request.operationId} />
      </StepCard>}
      {c.requiresPayment ? <StepCard index={c.requiresCode ? 2 : 1} icon={Wallet} verified={paymentReady} title={money(c.total) + ' · receber'} description={paymentReady ? 'Recebimento conferido. Registra ao concluir.' : 'Confira valor, método e troco com o cliente.'}>
        {showPayment || d.request.payments.length > 0 ? <DeliveryPaymentPanel key={d.request.operationId} initiallySplit={panel === 'split'} onEditingChange={setPaymentEditing} /> : <View style={{ marginTop: 12 }}><Button danger icon={Wallet} disabled={completion.busy || savingItems || d.phase !== 'draft'} onPress={() => setShowPayment(true)}>Cobrar</Button></View>}
      </StepCard> : <Text style={[type.small, { color: colors.muted, marginBottom: 14 }]}>Pagamento já realizado · sem cobrança.</Text>}
      {showProofStep && <StepCard index={(c.requiresCode ? 1 : 0) + (c.requiresPayment ? 1 : 0) + 1} icon={Camera} verified={proofReady} title={c.requiresProof ? 'Comprovante obrigatório' : 'Comprovante da entrega'} description="Fotografe o volume. Evite rostos e dados pessoais.">
        <DeliveryProofPanel key={d.request.operationId} />
      </StepCard>}
      {!!completion.error && d.phase === 'draft' && <Button secondary disabled={completion.busy || savingItems} onPress={() => void completion.prepare(pedido)}>Atualizar conferência do pedido</Button>}
      {!c.requiresProof && !d.request.proofId && !showProof && <TextAction onPress={() => setShowProof(true)}>Adicionar foto, se necessário</TextAction>}
      <Text style={[type.eyebrow, { color: colors.muted, marginTop: 18, marginBottom: 10 }]}>PRECISA DE AJUDA?</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button secondary icon={MessageCircle} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'client', pedidoId: String(pedido) } })}>Falar com o cliente</Button></View>
        <View style={{ flex: 1 }}><Button secondary icon={HelpCircle} onPress={() => router.push('/clienteAusente')}>Cliente não apareceu</Button></View>
      </View>
      <TextAction onPress={() => router.push('/ocorrencia')}>Não consegui entregar</TextAction>
    </>}
  </CompletionScreen>;
}
