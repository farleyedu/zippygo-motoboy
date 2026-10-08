import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Package } from 'lucide-react-native';
import { reorderQueue, resumeQueue } from '../services/mobileApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, IconButton, SectionTitle, Surface, type } from '../src/ui/Kit';
import { activeStops, MiniRouteMap, RouteScreen, StopRow } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';
import { ReorderHandle } from '../src/ui/ReorderHandle';

export default function RouteOrganizeScreen() {
  const turn = useOperationalSession(), router = useRouter(), action = useRouteAction(), { colors } = useZippyTheme();
  const [ids, setIds] = useState<number[]>([]), [changed, setChanged] = useState(false), version = useRef(-1), dirty = useRef(false), rowHeights = useRef<Record<number,number>>({});
  const stops = activeStops(turn.queue), allowed = turn.queue?.politicas?.allowMotoboyReorder !== false, firstMovable=turn.queue?.current?1:0;
  useEffect(() => { if (!turn.queue || turn.queue.version === version.current) return; setChanged(dirty.current); setIds(activeStops(turn.queue).map(s => s.pedidoId)); version.current = turn.queue.version; dirty.current = false; }, [turn.queue]);
  const confirm = () => void action.run(async () => { const saved = dirty.current ? await reorderQueue(version.current, ids) : turn.queue; return saved?.current ? saved : resumeQueue(); }, () => router.push('/retirada'));
  const drop = (index: number, distance: number) => { const delta = Math.round(distance/(rowHeights.current[ids[index]]||82)); if(!delta || action.busy || !allowed) return; const target = Math.max(firstMovable,Math.min(ids.length-1,index+delta)); if(index<firstMovable || target===index) return; const range=ids.slice(Math.min(index,target),Math.max(index,target)+1); if(range.some(id=>stops.find(s=>s.pedidoId===id)?.locked))return; const next=[...ids]; next.splice(target,0,next.splice(index,1)[0]); dirty.current=true;setIds(next); };
  return <RouteScreen footer={<Button icon={Package} loading={action.busy} disabled={!ids.length || action.busy} onPress={confirm}>Conferir retirada</Button>}>
    <Header title="Um caminho bem pensado." subtitle="Organizar rota" onBack={() => router.back()} /><View style={{ flexDirection: 'row', gap: 5, marginBottom: 16 }}>{[true, true, false].map((done, i) => <View key={i} style={{ height: 3, flex: 1, borderRadius: 3, backgroundColor: done ? colors.accent : colors.line }} />)}</View>
    <MiniRouteMap queue={turn.queue} caption="Mapa e sequência contam a mesma história." />
    {changed && <AccountNotice warning icon={Lock}>A loja mudou a fila. Sua edição foi descartada: confira a nova sequência antes de continuar.</AccountNotice>}
    <SectionTitle>Sequência das entregas</SectionTitle><Surface style={{ paddingVertical: 0 }}>{ids.map((id, index) => { const stop = stops.find(s => s.pedidoId === id); return stop && <View key={id} onLayout={event=>{rowHeights.current[id]=event.nativeEvent.layout.height;}}><StopRow stop={stop} index={index} right={allowed && index >= firstMovable && !stop.locked ? <ReorderHandle label={`Mudar posição do pedido ${id}`} onDrop={distance=>drop(index,distance)}/> : <Lock size={15} color={colors.muted} />} /></View>; })}{!ids.length && <Text style={[type.body, { color: colors.muted, paddingVertical: 20 }]}>Sua fila está vazia. Novas ofertas aparecem no início.</Text>}</Surface>
    <AccountNotice icon={Lock}>{allowed ? 'A entrega atual e os pedidos travados mantêm sua posição. A loja acompanha a sequência que você confirma.' : 'A loja mantém a ordem fixa nesta operação.'}</AccountNotice>
    {action.error && <Feedback title="A sequência não foi salva" message={action.error} onRetry={() => void turn.store.refreshQueue()} />}
  </RouteScreen>;
}
