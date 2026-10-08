import React,{useCallback} from 'react';
import { Text,View } from 'react-native';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Camera,Lock,ShieldCheck,Wallet } from 'lucide-react-native';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { readyToComplete } from '../delivery/completionRules';
import { AccountNotice } from './AccountKit';
import { Button,Feedback,Header,type } from './Kit';
import { CompletionScreen,money,SlideConfirm,StepCard,TextAction } from './CompletionKit';
import { useZippyTheme } from './theme';

export default function FinishScreen(){
  const completion=useDeliveryCompletion(),turn=useOperationalSession(),router=useRouter(),{id}=useLocalSearchParams<{id?:string}>(),{colors,dark}=useZippyTheme();
  const pedido=Number(id)||turn.queue?.current?.pedidoId||0;
  useFocusEffect(useCallback(()=>{
    if (!pedido || !turn.session || !turn.queue?.estabelecimentoId || turn.busy || completion.loading) return;
    if (completion.draft?.phase==='completed' && completion.draft.context.pedidoId===pedido) { router.replace('/entregaConcluida'); return; }
    if (!['pending','sending'].includes(completion.draft?.phase||'')) void completion.prepare(pedido);
  },[pedido,turn.session?.sessionId,turn.queue?.estabelecimentoId,turn.queue?.version,turn.busy,completion.loading]));
  const d=completion.draft,c=d?.context,matching=c?.pedidoId===pedido;
  const codeReady=!!c&&(!c.requiresCode||!!d?.codeChecked),paymentReady=!!c&&(!c.requiresPayment||!!d?.request.payments.length),proofReady=!!c&&(!c.requiresProof||!!d?.request.proofId);
  const can=!!d&&matching&&d.phase==='draft'&&readyToComplete(d.context,d.codeChecked,d.request.payments,d.request.proofId)&&turn.queue?.current?.pedidoId===pedido;
  const finish=async()=>{const receipt=await completion.submit();if(receipt)router.replace('/entregaConcluida');};
  return <CompletionScreen><Header title="Conferir & concluir" subtitle={`#${pedido} · ${c?.nomeCliente||'Sua entrega'}`} onBack={()=>router.back()}/>
    <View style={{paddingTop:4,paddingBottom:18}}><Text style={[type.eyebrow,{color:colors.muted}]}>O ÚLTIMO DETALHE IMPORTA.</Text><Text style={{fontFamily:'ManropeExtraBold',fontSize:28,lineHeight:32,letterSpacing:-1.2,color:colors.ink,marginTop:12,marginBottom:8}}>Uma boa entrega{ '\n' }termina <Text style={{color:colors.accent}}>bem.</Text></Text><Text style={[type.body,{fontSize:13,color:colors.muted}]}>Confira o que precisa. Depois, deslize.</Text></View>
    {!matching||!d||!c?<><Feedback title="Conferindo o pedido" loading={completion.busy} onRetry={()=>void completion.prepare(pedido)}/>{d?.phase==='draft'&&!matching&&<Button secondary loading={completion.busy} onPress={async()=>{if(await completion.discardUnsent())await completion.prepare(pedido);}}>Descartar conferência anterior e revisar este pedido</Button>}</>:<>
    <StepCard index={1} icon={codeReady?ShieldCheck:Lock} verified={codeReady} code={c.requiresCode} title={c.requiresCode?'Código do cliente':'Código dispensado'} description={c.requiresCode?codeReady?'Validado. Este código fica visível.':'Peça o código quando entregar o pedido.':'Este pedido não exige código.'}>
      {c.requiresCode&&<><View style={{flexDirection:'row',gap:5,marginTop:10}}>{(d.request.codigo||'••••').split('').map((digit,i)=><View key={i} style={{width:30,height:32,borderRadius:9,backgroundColor:codeReady?dark?'#315540':'#d7efdf':dark?'#273548':colors.soft,alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:'ManropeExtraBold',fontSize:14,color:codeReady?dark?'#c1f0d1':'#205f3d':dark?'#a0b3cd':colors.ink}}>{digit}</Text></View>)}</View>{!codeReady&&<TextAction step emphasis onPress={()=>router.push('/VerificationScreen')}>Conferir código ↗</TextAction>}</>}
    </StepCard>
    <StepCard index={2} icon={Wallet} verified={paymentReady} title={c.requiresPayment?`${money(c.total)} · receber`:'Pagamento online'} description={c.requiresPayment?paymentReady?'Recebimento conferido. Registra ao concluir.':'Confira valor, método e troco com o cliente.':'Pagamento já realizado. Sem cobrança.'}><TextAction step emphasis={!paymentReady} danger={c.requiresPayment&&!paymentReady} onPress={()=>router.push('/cobrarEntrega')}>{c.requiresPayment?paymentReady?'Revisar recebimento ↗':'Cobrar e conferir ↗':'Ver pagamento ↗'}</TextAction></StepCard>
    <StepCard index={3} icon={Camera} verified={proofReady} title={c.requiresProof?'Comprovante obrigatório':'Comprovante opcional'} description={d.request.proofId?'Foto anexada. Evite dados pessoais.':c.requiresProof?'A loja pede uma foto nesta entrega.':'Só fotografe quando necessário.'}><TextAction step emphasis={!proofReady} onPress={()=>router.push('/comprovanteEntrega')}>{d.request.proofId?'Substituir foto ↗':'Adicionar foto ↗'}</TextAction></StepCard>
    <AccountNotice icon={ShieldCheck}>{can?'Tudo conferido. O arraste registra a conclusão.':'A conclusão fica disponível após as conferências.'}</AccountNotice><SlideConfirm enabled={can&&!completion.busy} busy={completion.busy} onConfirm={()=>void finish()}/><View style={{alignItems:'center'}}><TextAction onPress={()=>router.push('/ocorrencia')}>Não consegui entregar</TextAction></View></>}
  </CompletionScreen>;
}
