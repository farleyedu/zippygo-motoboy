import React,{useEffect} from 'react';
import { Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock,RefreshCw,ShieldCheck,WifiOff } from 'lucide-react-native';
import { useDeliveryCompletion } from '../src/contexts/DeliveryCompletionContext';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button,Feedback,Header,Screen,Surface,type } from '../src/ui/Kit';
import { money,ReceiptPair } from '../src/ui/CompletionKit';
import { useZippyTheme } from '../src/ui/theme';
export default function PendingDelivery(){
  const completion=useDeliveryCompletion(),router=useRouter(),{colors}=useZippyTheme(),d=completion.draft;
  useEffect(()=>{if(d?.phase==='completed')router.replace('/entregaConcluida');},[d?.phase]);
  return <Screen><Header title="Seu trabalho não se perde." subtitle="Entrega & sincronização" onBack={()=>router.replace('/')}/><View style={{width:83,height:83,borderRadius:27,backgroundColor:colors.warningSoft,alignItems:'center',justifyContent:'center',marginTop:30,marginBottom:27,boxShadow:'0 8px 0 #e0c6a055',transform:[{rotate:'-6deg'}]}}><Clock size={36} color={colors.warning}/></View><Text style={{fontFamily:'ManropeExtraBold',fontSize:32,lineHeight:35,letterSpacing:-1.2,color:colors.ink}}>Sua conferência{ '\n' }está guardada.</Text><Text style={[type.body,{fontSize:13,color:colors.muted,marginVertical:16}]}>A conclusão aguarda a confirmação do servidor. A próxima entrega só será liberada depois dela.</Text>{d&&<Surface><ReceiptPair label="Pedido" value={`#${d.context.pedidoId}`}/><ReceiptPair label="Total" value={money(d.context.total)}/><ReceiptPair label="Registro" value={d.request.operationId.slice(0,8).toUpperCase()}/><ReceiptPair label="Situação" value={d.phase==='draft'?'Precisa de revisão':'Aguardando confirmação'}/></Surface>}<AccountNotice icon={ShieldCheck} warning>Consultar o resultado é seguro. Reenviar usa a mesma identificação e não conclui a próxima parada.</AccountNotice>{completion.error&&<Feedback title="Ainda não foi confirmado" message={completion.error}/>}<View style={{gap:10,marginTop:15}}><Button icon={RefreshCw} loading={completion.busy} disabled={!d} onPress={()=>void completion.recover(false)}>Consultar resultado</Button><Button secondary icon={RefreshCw} loading={completion.busy} disabled={!d || d.phase==='draft'} onPress={()=>void completion.recover(true)}>Reenviar a mesma conferência</Button>{d?.phase==='draft'&&<Button onPress={()=>router.replace({pathname:'/confirmacaoEntrega',params:{id:String(d.context.pedidoId)}})}>Revisar entrega</Button>}<Button secondary icon={WifiOff} onPress={()=>router.push('/mapa')}>Consultar o caminho</Button></View></Screen>;
}
