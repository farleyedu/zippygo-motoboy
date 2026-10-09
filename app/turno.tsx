import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Pause, Play, ShieldCheck, Wallet } from 'lucide-react-native';
import { setTurnPaused } from '../services/routeApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useAuth } from '../src/contexts/AuthContext';
import { useDeliveryCompletion } from '../src/contexts/DeliveryCompletionContext';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Surface, type } from '../src/ui/Kit';
import { RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

export default function TurnScreen() {
  const turn = useOperationalSession(), auth = useAuth(), router = useRouter(), action = useRouteAction(), { colors } = useZippyTheme();
  const [ending, setEnding] = useState(false), [endError, setEndError] = useState(''), [confirmEnd, setConfirmEnd] = useState(false), paused = !!turn.queue?.paused;
  const completion = useDeliveryCompletion();
  const end = async () => { if (ending) return; setEnding(true); setEndError(''); try { completion.assertRouteMutationAllowed(); if (!(await turn.store.end('client_end'))) throw new Error(turn.store.getSnapshot().error || 'Seu turno foi mantido. Confira as pendências.'); router.replace('/'); } catch (e) { setEndError(e instanceof Error ? e.message : 'Seu turno foi mantido.'); } finally { setEnding(false); } };
  return <RouteScreen footer={<View style={{ gap: 10 }}><Button icon={paused ? Play : Pause} loading={action.busy} disabled={action.busy || ending} onPress={() => void action.run(() => setTurnPaused(!paused))}>{paused ? 'Retomar novos chamados' : 'Pausar novos chamados'}</Button><Button secondary icon={Play} onPress={() => router.replace('/')}>Continuar no app</Button></View>}>
    <Header title="Seu turno, no seu ritmo." onBack={() => router.back()} /><View style={{ width: 82, height: 82, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft, marginTop: 16, marginBottom: 25 }}><Pause size={34} color={colors.warning} /></View>
    <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 32, lineHeight: 35, letterSpacing: -1.2, color: colors.ink }}>{paused ? 'Uma pausa\ntambém faz parte.' : 'Seu turno.\nSeu próximo movimento.'}</Text><Text style={[type.body, { color: colors.muted, marginVertical: 18 }]}>Pausar interrompe novos chamados. Pedidos aceitos continuam sob sua responsabilidade.</Text>
    <Surface><Text style={[type.small, { color: colors.muted }]}>Estabelecimento</Text><Text style={[type.body, { color: colors.ink, marginBottom: 12 }]}>{auth.estabelecimentoAtual?.nome}</Text><Text style={[type.small, { color: colors.muted }]}>Situação</Text><Text style={[type.body, { color: colors.ink }]}>{paused ? 'Chamados pausados' : 'Disponível para novos chamados'}</Text></Surface>
    <AccountNotice icon={ShieldCheck}>A localização permanece compartilhada com a loja enquanto seu turno estiver ativo, inclusive na pausa.</AccountNotice>
    <Button secondary icon={Wallet} onPress={() => router.push('/resumoTurno')}>Conferir resumo do turno</Button>
    {!!action.error && <Feedback title="A disponibilidade não mudou" message={action.error} />}{!!endError && <Feedback title="Seu turno foi mantido" message={endError} />}
    <View style={{ marginTop: 18 }}><Button secondary icon={Check} disabled={ending || action.busy} onPress={() => setConfirmEnd(v => !v)}>{confirmEnd ? 'Continuar o turno' : 'Encerrar meu turno'}</Button>{confirmEnd && <View style={{ marginTop: 10 }}><Button icon={Check} loading={ending} onPress={() => void end()}>Confirmar encerramento</Button></View>}</View>
  </RouteScreen>;
}
