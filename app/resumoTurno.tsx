import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Play, Wallet } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../src/contexts/DeliveryCompletionContext';
import { END_WITH_WORK_MESSAGE, END_WITH_WORK_TITLE, useEndShift } from '../src/hooks/useEndShift';
import { useWork } from '../src/hooks/useWork';
import { AccountScreen } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Surface, money, type } from '../src/ui/Kit';
import { WorkPair, WorkState } from '../src/ui/WorkKit';
import { useZippyTheme } from '../src/ui/theme';
import { workWindow } from '../services/workApi';
import { inactivityRemainingLabel } from '../src/session/inactivity';

export default function ShiftSummaryScreen() {
  const router = useRouter(), turn = useOperationalSession(), completion = useDeliveryCompletion(), work = useWork('90'), { colors } = useZippyTheme();
  const [confirm, setConfirm] = useState(false), shift = useEndShift('client_end'), busy = shift.busy, pendingCompletion = shift.pendingCompletion;
  const start = turn.session ? Date.parse(turn.session.startedAtUtc) : Date.parse(workWindow('today').from);
  const entries = work.data?.entries.filter(e => Date.parse(e.toUtc) >= start) ?? [];
  const active = !!turn.queue?.current || !!turn.queue?.next.length || !!turn.queue?.offer || turn.queue?.routeState === 'returning' || ['pending', 'sending'].includes(completion.draft?.phase || '');
  const end = async () => { if (await shift.end(shift.needsWorkConfirmation)) router.replace('/'); };
  return <AccountScreen active="earnings" footer={<View style={{ gap: 10 }}>{turn.session && <Button icon={Check} disabled={pendingCompletion || busy} loading={busy} onPress={() => confirm ? void end() : setConfirm(true)}>{!confirm ? 'Encerrar meu turno' : shift.needsWorkConfirmation ? 'Encerrar e passar pedidos à loja' : 'Confirmar encerramento do turno'}</Button>}{turn.session && confirm && <Button secondary disabled={busy} onPress={() => { shift.cancel(); setConfirm(false); }}>Manter o turno</Button>}<Button secondary icon={Play} onPress={() => router.navigate('/')}>Continuar no app</Button></View>}><Header title="Um turno bem feito." subtitle={turn.session ? 'Resumo do turno atual' : 'Resumo do trabalho de hoje'} onBack={() => router.back()} /><Image source={require('../assets/images/capacete-3d-azul.png')} resizeMode="contain" style={{ alignSelf: 'center', width: 190, height: 160 }} /><WorkState {...work} />{work.data && <><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 26, lineHeight: 31, color: colors.ink, marginBottom: 20 }}>Seu trabalho, registrado.</Text><Surface><WorkPair label="Entregas concluídas" value={String(work.data.history.filter(h => h.status === 'completed' && Date.parse(h.updatedAtUtc) >= start).length)} /><WorkPair label="Ganhos conferidos" value={money(entries.reduce((sum, e) => sum + (e.amount ?? 0), 0))} /><WorkPair label="Dinheiro recebido para a loja" value={money(entries.reduce((sum, e) => sum + e.storeCash, 0))} /><WorkPair label="Situação operacional" value={active ? 'Existem pendências' : 'Sem entregas pendentes'} />{turn.session && <WorkPair label="Inatividade" value={inactivityRemainingLabel(turn.session.inactivityExpiresAtUtc) ?? 'Encerra sozinho após longo período sem uso do app'} />}{turn.session && <WorkPair label="Início do turno" value={new Date(turn.session.startedAtUtc).toLocaleString('pt-BR')} />}</Surface><Text style={[type.small, { color: colors.muted, marginVertical: 18 }]}>Encerrar o turno não marca remuneração como paga. Valores por hora ou período dependem da conferência da loja. A localização operacional para após o encerramento confirmado.</Text><Button secondary icon={Wallet} onPress={() => router.push('/acerto')}>Conferir acerto</Button></>}{(confirm || turn.pendingWorkEnd) && shift.needsWorkConfirmation && <Feedback title={END_WITH_WORK_TITLE} message={END_WITH_WORK_MESSAGE} />}{pendingCompletion && <Feedback title="Consulte a conclusão pendente" message="Há uma conclusão ainda não confirmada pelo servidor. Aguarde o resultado antes de encerrar." />}{!!shift.error && <Feedback title="Seu turno foi mantido" message={shift.error} />}</AccountScreen>;
}
