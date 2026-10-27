import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Clock3, Pause, Play, ShieldCheck, Wallet } from 'lucide-react-native';
import { setTurnPaused } from '../services/routeApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useAuth } from '../src/contexts/AuthContext';
import { END_WITH_WORK_MESSAGE, END_WITH_WORK_TITLE, useEndShift } from '../src/hooks/useEndShift';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Surface, type } from '../src/ui/Kit';
import { RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';
import { inactivityRemainingLabel } from '../src/session/inactivity';

export default function TurnScreen() {
  const turn = useOperationalSession(), auth = useAuth(), router = useRouter(), action = useRouteAction(), { colors } = useZippyTheme();
  const [confirmEnd, setConfirmEnd] = useState(false), paused = !!turn.queue?.paused;
  const shift = useEndShift('client_end'), ending = shift.busy;
  const end = async (confirmPendingWork: boolean) => { if (await shift.end(confirmPendingWork)) router.replace('/'); };
  const location = Platform.OS === 'web'
    ? 'No navegador, a localização só é enviada enquanto o ZippyGo está aberto, visível e com permissão. Com a página fechada ou em segundo plano a loja vê apenas a última posição confirmada, com o horário dela. Isso não encerra o turno.'
    : 'A localização permanece compartilhada com a loja enquanto seu turno estiver ativo, inclusive na pausa.';
  return <RouteScreen footer={<View style={{ gap: 10 }}><Button icon={paused ? Play : Pause} loading={action.busy} disabled={action.busy || ending} onPress={() => void action.run(() => setTurnPaused(!paused))}>{paused ? 'Retomar novos chamados' : 'Pausar novos chamados'}</Button><Button secondary icon={Play} onPress={() => router.replace('/')}>Continuar no app</Button></View>}>
    <Header title="Seu turno, no seu ritmo." onBack={() => router.back()} /><View style={{ width: 82, height: 82, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft, marginTop: 16, marginBottom: 25 }}><Pause size={34} color={colors.warning} /></View>
    <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 32, lineHeight: 35, letterSpacing: -1.2, color: colors.ink }}>{paused ? 'Uma pausa\ntambém faz parte.' : 'Seu turno.\nSeu próximo movimento.'}</Text><Text style={[type.body, { color: colors.muted, marginVertical: 18 }]}>Pausar interrompe novos chamados. Pedidos aceitos continuam sob sua responsabilidade.</Text>
    <Surface><Text style={[type.small, { color: colors.muted }]}>Estabelecimento</Text><Text style={[type.body, { color: colors.ink, marginBottom: 12 }]}>{auth.estabelecimentoAtual?.nome}</Text><Text style={[type.small, { color: colors.muted }]}>Situação</Text><Text style={[type.body, { color: colors.ink }]}>{paused ? 'Chamados pausados' : 'Disponível para novos chamados'}</Text></Surface>
    <AccountNotice icon={ShieldCheck}>{location}</AccountNotice>
    <AccountNotice icon={Clock3}>{inactivityRemainingLabel(turn.session?.inactivityExpiresAtUtc) ?? 'Se o app ficar sem uso por muito tempo, o servidor encerra o turno e os pedidos passam para a gestão da loja.'}</AccountNotice>
    <Button secondary icon={Wallet} onPress={() => router.push('/resumoTurno')}>Conferir resumo do turno</Button>
    {!!action.error && <Feedback title="A disponibilidade não mudou" message={action.error} />}{!!shift.error && <Feedback title="Seu turno foi mantido" message={shift.error} />}
    <View style={{ marginTop: 18 }}><Button secondary icon={Check} disabled={ending || action.busy} onPress={() => { if (confirmEnd) shift.cancel(); setConfirmEnd(v => !v); }}>{confirmEnd ? 'Continuar o turno' : 'Encerrar meu turno'}</Button>{(confirmEnd || turn.pendingWorkEnd) && <View style={{ marginTop: 10 }}>{shift.pendingCompletion && <Feedback title="Consulte a conclusão pendente" message="Há uma conclusão ainda não confirmada pelo servidor. Aguarde o resultado antes de encerrar." />}{shift.needsWorkConfirmation && <Feedback title={END_WITH_WORK_TITLE} message={END_WITH_WORK_MESSAGE} />}<Button icon={Check} loading={ending} disabled={ending || shift.pendingCompletion} onPress={() => void end(shift.needsWorkConfirmation)}>{shift.needsWorkConfirmation ? 'Encerrar e passar pedidos à loja' : 'Confirmar encerramento'}</Button></View>}</View>
  </RouteScreen>;
}
