import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheck, X } from 'lucide-react-native';
import { refuseStop } from '../services/routeApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Field, Header } from '../src/ui/Kit';
import { activeStops, RouteScreen } from '../src/ui/RouteKit';

export default function RefuseScreen() {
  const params = useLocalSearchParams<{ pedidoId: string }>(), router = useRouter(), turn = useOperationalSession(), action = useRouteAction();
  const id = Number(params.pedidoId), stop = activeStops(turn.queue).find(s => s.pedidoId === id);
  const [reason, setReason] = useState(''), [confirm, setConfirm] = useState(false);
  const blocked = !stop || stop.locked || !!stop.pickedUpAtUtc || turn.queue?.politicas?.allowMotoboyRefuse === false;
  return <RouteScreen><Header title="Confira antes de devolver à fila." subtitle={`Recusar pedido #${id}`} onBack={() => router.back()} /><AccountNotice warning icon={ShieldCheck}>Um pedido coletado ou travado precisa de orientação da loja. A recusa só altera sua fila após confirmação do servidor.</AccountNotice>{blocked && <Feedback title="Este pedido não pode ser recusado por aqui" message="Converse com o atendimento para resolver a operação." />}<Field label="Motivo da recusa" value={reason} onChangeText={v => { setReason(v); setConfirm(false); }} multiline placeholder="Explique para o estabelecimento…" editable={!blocked && !action.busy} maxLength={500} /><View style={{ marginTop: 18 }}><Button danger icon={X} disabled={blocked || !reason.trim() || action.busy} loading={action.busy} onPress={() => confirm ? void action.run(() => refuseStop(id, reason.trim()), () => router.replace('/rota')) : setConfirm(true)}>{confirm ? 'Confirmar recusa deste pedido' : 'Revisar recusa'}</Button></View>{action.error && <Feedback title="Seu pedido foi mantido" message={action.error} />}</RouteScreen>;
}
