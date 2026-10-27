import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Play, Wallet } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../src/contexts/DeliveryCompletionContext';
import { useWork } from '../src/hooks/useWork';
import { AccountScreen } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Surface, money, type } from '../src/ui/Kit';
import { WorkPair, WorkState } from '../src/ui/WorkKit';
import { useZippyTheme } from '../src/ui/theme';
import { workWindow } from '../services/workApi';
import { inactivityRemainingLabel } from '../src/session/inactivity';
import { hasOperationalWork } from '../src/session/operationalSessionStore';

export default function ShiftSummaryScreen() {
  const router = useRouter(), turn = useOperationalSession(), completion = useDeliveryCompletion(), work = useWork('90'), { colors } = useZippyTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  const start = turn.session ? Date.parse(turn.session.startedAtUtc) : Date.parse(workWindow('today').from);
  const entries = work.data?.entries.filter(e => Date.parse(e.toUtc) >= start) ?? [];
  const pendingCompletion = ['pending', 'sending'].includes(completion.draft?.phase || '');
  const hasWork = !!turn.queue && (hasOperationalWork(turn.queue) || !!turn.queue.offer);
  const active = !!turn.queue?.current || !!turn.queue?.next.length || !!turn.queue?.offer || turn.queue?.routeState === 'returning' || ['pending', 'sending'].includes(completion.draft?.phase || '');
  const end = async () => { if (busy) return; setBusy(true); setError(''); try { completion.assertRouteMutationAllowed(); if (!(await turn.store.end('client_end'))) throw new Error(turn.store.getSnapshot().error || 'Confira as pendências antes de encerrar.'); router.replace('/'); } catch (e) { setError(e instanceof Error ? e.message : 'Seu turno foi mantido.'); } finally { setBusy(false); } };
  return <AccountScreen active="earnings" footer={<View style={{ gap: 10 }}>{turn.session && <Button icon={Check} disabled={pendingCompletion || busy} loading={busy} onPress={() => confirm ? void end() : setConfirm(true)}>{confirm ? 'Confirmar encerramento do turno' : 'Encerrar meu turno'}</Button>}<Button secondary icon={Play} onPress={() => router.navigate('/')}>Continuar no app</Button></View>}><Header title="Um turno bem feito." subtitle={turn.session ? 'Resumo do turno atual' : 'Resumo do trabalho de hoje'} onBack={() => router.back()} /><Image source={require('../assets/images/capacete-3d-azul.png')} resizeMode="contain" style={{ alignSelf: 'center', width: 190, height: 160 }} /><WorkState {...work} />{work.data && <><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 26, lineHeight: 31, color: colors.ink, marginBottom: 20 }}>Seu trabalho, registrado.</Text><Surface><WorkPair label="Entregas concluídas" value={String(work.data.history.filter(h => h.status === 'completed' && Date.parse(h.updatedAtUtc) >= start).length)} /><WorkPair label="Ganhos conferidos" value={money(entries.reduce((sum, e) => sum + (e.amount ?? 0), 0))} /><WorkPair label="Dinheiro recebido para a loja" value={money(entries.reduce((sum, e) => sum + e.storeCash, 0))} /><WorkPair label="Situação operacional" value={active ? 'Existem pendências' : 'Sem entregas pendentes'} />{turn.session && <WorkPair label="Inatividade" value={inactivityRemainingLabel(turn.session.inactivityExpiresAtUtc) ?? 'Encerra sozinho após longo período sem uso do app'} />}{turn.session && <WorkPair label="Início do turno" value={new Date(turn.session.startedAtUtc).toLocaleString('pt-BR')} />}</Surface><Text style={[type.small, { color: colors.muted, marginVertical: 18 }]}>Encerrar o turno não marca remuneração como paga. Valores por hora ou período dependem da conferência da loja. A localização operacional para após o encerramento confirmado.</Text><Button secondary icon={Wallet} onPress={() => router.push('/acerto')}>Conferir acerto</Button></>}{confirm && hasWork && <Feedback title="Você ainda tem pedidos em andamento" message="Se o servidor aceitar o encerramento, esses pedidos ficam sob gestão do estabelecimento e saem da sua rota. Seus dados só são removidos deste aparelho depois que o servidor confirmar." />}{pendingCompletion && <Feedback title="Consulte a conclusão pendente" message="Há uma conclusão ainda não confirmada pelo servidor. Aguarde o resultado antes de encerrar." />}{!!error && <Feedback title="Seu turno foi mantido" message={error} />}</AccountScreen>;
}
