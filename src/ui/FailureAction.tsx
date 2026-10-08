import React,{useState} from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck,X } from 'lucide-react-native';
import { failCurrent } from '../../services/mobileApi';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useRouteAction } from '../hooks/useRouteAction';
import { AccountNotice } from './AccountKit';
import { Button,Feedback,Field,Surface } from './Kit';

export function FailureAction(){
  const turn=useOperationalSession(),action=useRouteAction(),router=useRouter();
  const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
  const id=turn.queue?.current?.pedidoId;
  if(!id)return null;
  return <View style={{marginTop:20}}>{!open?<Button secondary icon={X} onPress={()=>setOpen(true)}>Registrar entrega não realizada</Button>:<Surface>
    <AccountNotice icon={ShieldCheck} warning>Combine o destino do pedido com a loja antes de registrar. Esta ação devolve o pedido à fila da loja e não registra pagamento ou entrega concluída.</AccountNotice>
    <Field label="Motivo e orientação da loja" value={reason} multiline maxLength={500} editable={!action.busy} onChangeText={text=>{setReason(text);setConfirmed(false);}}/>
    <View style={{gap:10,marginTop:15}}><Button danger icon={X} disabled={!reason.trim()||action.busy} loading={action.busy} onPress={()=>confirmed?void action.run(()=>failCurrent(reason.trim(),id),()=>router.replace('/rota')):setConfirmed(true)}>{confirmed?`Confirmar não entrega do pedido #${id}`:'Revisar registro'}</Button><Button secondary disabled={action.busy} onPress={()=>{setOpen(false);setConfirmed(false);}}>Manter pedido na minha rota</Button></View>
    {action.error&&<Feedback title="O pedido foi mantido" message={action.error}/>}
  </Surface>}</View>;
}
