import React,{useState} from 'react';
import { Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check,ShieldCheck } from 'lucide-react-native';
import { PaymentMethod,PaymentPart } from '../../services/completionApi';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { parseCents,paymentError } from '../delivery/completionRules';
import { Button,Field,Header,Surface,type } from './Kit';
import { AccountNotice } from './AccountKit';
import { CheckReceived,CompletionScreen,money } from './CompletionKit';
import { PaymentMethodSelect } from './PaymentMethodSelect';
import { useZippyTheme } from './theme';
export default function SplitPaymentScreen(){
  const completion=useDeliveryCompletion(),router=useRouter(),{colors}=useZippyTheme(),c=completion.draft?.context;
  const [methods,setMethods]=useState<PaymentMethod[]>(['pix','dinheiro']),[amounts,setAmounts]=useState(['','']),[cash,setCash]=useState(['','']),[checked,setChecked]=useState([false,false]),[error,setError]=useState('');
  const change=<T,>(setter:React.Dispatch<React.SetStateAction<T[]>>,index:number,value:T)=>{setter(old=>old.map((v,i)=>i===index?value:v));setChecked(old=>old.map((v,i)=>i===index?false:v));};
  const sum=amounts.reduce((value,text)=>value+(parseCents(text)||0),0),due=Math.round((c?.total||0)*100);
  const prepare=async()=>{const parts:PaymentPart[]=amounts.map((text,i)=>({method:methods[i],amount:(parseCents(text)||0)/100,cashReceived:methods[i]==='dinheiro'?(parseCents(cash[i])??-1)/100:undefined,receivedConfirmed:checked[i]}));const failure=paymentError(c?.total,parts);if(failure){setError(failure);return;}try{await completion.preparePayment(parts);router.replace({pathname:'/confirmacaoEntrega',params:{id:String(c?.pedidoId)}});}catch(e){setError(e instanceof Error?e.message:'Recebimento não preparado.');}};
  return <CompletionScreen><Header title="Cada parte, conferida." subtitle={`Dividir · pedido #${c?.pedidoId||''}`} onBack={()=>router.back()}/><Text style={[type.body,{color:colors.muted}]}>Duas formas. Um total de {money(c?.total)}.</Text>{[0,1].map(i=><Surface key={i} style={{padding:15,borderRadius:19,marginTop:12}}><Text style={{fontFamily:'ManropeExtraBold',fontSize:12,color:colors.ink,marginBottom:12}}>Parte {i+1}</Text><PaymentMethodSelect label={`Forma de pagamento da parte ${i+1}`} value={methods[i]} onChange={m=>change(setMethods,i,m)}/><Field compact label="Valor desta parte" value={amounts[i]} keyboardType="decimal-pad" inputMode="decimal" onChangeText={v=>change(setAmounts,i,v)}/>{methods[i]==='dinheiro'&&<View style={{marginTop:12}}><Field compact label="Dinheiro recebido para esta parte" value={cash[i]} keyboardType="decimal-pad" inputMode="decimal" onChangeText={v=>change(setCash,i,v)}/><Text style={[type.small,{color:colors.muted,marginTop:8}]}>Troco: {money(Math.max(0,((parseCents(cash[i])||0)-(parseCents(amounts[i])||0))/100))}</Text></View>}<CheckReceived checked={checked[i]} onChange={()=>setChecked(old=>old.map((v,j)=>j===i?!v:v))} label={methods[i]==='pix'?'Crédito Pix conferido na conta da loja':methods[i]==='dinheiro'?'Dinheiro recebido e troco conferido':'Aprovação conferida na maquininha'}/></Surface>)}<Surface style={{backgroundColor:colors.soft,marginTop:12}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={[type.small,{color:colors.ink}]}>Soma {money(sum/100)}</Text><Text style={[type.small,{color:due===sum?colors.accent:colors.danger}]}>Diferença {money((due-sum)/100)}</Text></View></Surface><AccountNotice icon={ShieldCheck}>Confira cada recebimento. O registro acontece junto com a conclusão.</AccountNotice>{!!error&&<Text accessibilityLiveRegion="polite" style={[type.small,{color:colors.danger,marginBottom:12}]}>{error}</Text>}<Button icon={Check} onPress={()=>void prepare()}>Recebimentos conferidos</Button></CompletionScreen>;
}
