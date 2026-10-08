import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Clock, MessageCircle, Store } from 'lucide-react-native';
import { sendClientMessage, sendStoreMessage } from '../services/mobileApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useAccountSave } from '../src/hooks/useAccountSave';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, type } from '../src/ui/Kit';
import { RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';

export default function AbsentScreen() {
  const router = useRouter(), turn = useOperationalSession(), save = useAccountSave(), { colors } = useZippyTheme();
  const id = turn.queue?.current?.pedidoId, start = useRef(Date.now()), [elapsed, setElapsed] = useState(0);
  useEffect(() => { start.current = Date.now(); setElapsed(0); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start.current) / 1000)), 1000); return () => clearInterval(timer); }, [id]);
  const notify = (client: boolean) => { if (!id) return; void save.run(async () => { if (client) await sendClientMessage(id, 'Olá! Estou no local da entrega. Pode me orientar para encontrar você?'); else await sendStoreMessage(`Cliente não localizado no pedido #${id}. Estou aguardando orientação para continuar.`, id); }, client ? 'Mensagem enviada pelo canal do pedido.' : 'A loja recebeu sua solicitação de orientação.'); };
  return <RouteScreen><Header title="Vamos tentar contato." subtitle="Cliente não localizado" onBack={() => router.back()} /><View style={{ width: 152, height: 152, borderRadius: 76, borderWidth: 5, borderColor: colors.warningSoft, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 31, color: colors.ink }}>{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</Text><Text style={{ fontFamily: 'Manrope', fontSize: 9, color: colors.muted, marginTop: 5 }}>tempo nesta tentativa</Text></View><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 28, lineHeight: 32, letterSpacing: -1, textAlign: 'center', color: colors.ink }}>{'O cliente ainda\nnão apareceu.'}</Text><Text style={[type.body, { textAlign: 'center', color: colors.muted, marginVertical: 19 }]}>Tente o canal permitido. Registre a tentativa e combine a decisão com a loja.</Text><View style={{ gap: 10 }}><Button secondary icon={MessageCircle} disabled={!id || save.saving} onPress={() => notify(true)}>Enviar mensagem ao cliente</Button><Button secondary icon={Store} onPress={() => router.push({ pathname: '/conversas', params: { channel: 'store', pedidoId: String(id || '') } })}>Falar com a loja</Button><Button icon={Check} disabled={!id} onPress={() => router.replace({ pathname: '/pedido/[id]', params: { id: String(id) } })}>O cliente chegou</Button></View><AccountNotice warning icon={Clock}>A espera e a decisão de devolução seguem a orientação da loja. O tempo mostrado não autoriza concluir uma entrega que não ocorreu.</AccountNotice><Button secondary icon={Clock} loading={save.saving} disabled={!id || save.saving} onPress={() => notify(false)}>Registrar ausência e pedir orientação</Button>{save.failure && <Feedback title="A mensagem não foi enviada" message={save.failure} />}{save.success && <AccountNotice icon={Check}>{save.success}</AccountNotice>}</RouteScreen>;
}
