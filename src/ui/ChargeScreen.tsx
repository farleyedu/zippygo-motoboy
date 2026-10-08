import React,{useState} from 'react';
import { Pressable,Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { Banknote,Check,CreditCard,ShieldCheck,Shuffle,Wallet } from 'lucide-react-native';
import { PaymentMethod,PaymentPart } from '../../services/completionApi';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { parseCents,paymentError } from '../delivery/completionRules';
import { AccountNotice } from './AccountKit';
import { Button,Field,Header,Surface,type } from './Kit';
import { CheckReceived,CompletionScreen,methodNames,money } from './CompletionKit';
import { useZippyTheme } from './theme';
export function PaymentMethods({value,onChange}:{value:PaymentMethod;onChange:(m:PaymentMethod)=>void}) {
  const {colors}=useZippyTheme();return <View style={{flexDirection:'row',flexWrap:'wrap',gap:9,marginBottom:17}}>{(Object.keys(methodNames) as PaymentMethod[]).map(m=><Pressable key={m} accessibilityRole="radio" accessibilityState={{checked:m===value}} onPress={()=>onChange(m)} style={{width:'48%',flexGrow:1,flexBasis:'45%',flexDirection:'row',gap:9,alignItems:'center',paddingVertical:15,paddingHorizontal:11,borderRadius:14,borderWidth:1,borderColor:m===value?colors.accent:colors.line,backgroundColor:m===value?colors.accentSoft:colors.card}}>{m==='dinheiro'?<Banknote size={19} color={colors.accent}/>:<CreditCard size={19} color={colors.accent}/>}<Text style={{fontFamily:'Manrope',fontWeight:'700',fontSize:10,color:colors.ink}}>{methodNames[m]}</Text></Pressable>)}</View>;
}
export default function ChargeScreen(){
  const completion=useDeliveryCompletion(),router=useRouter(),{colors}=useZippyTheme(),d=completion.draft,c=d?.context;
  const [method,setMethod]=useState<PaymentMethod>(d?.request.payments[0]?.method||'dinheiro'),[cash,setCash]=useState(''),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
  const prepare=async()=>{if(!c)return;const part:PaymentPart={method,amount:c.total||0,cashReceived:method==='dinheiro'?(parseCents(cash)??-1)/100:undefined,receivedConfirmed:confirmed};const failure=paymentError(c.total,[part]);if(failure){setError(failure);return;}try{await completion.preparePayment([part]);router.back();}catch(e){setError(e instanceof Error?e.message:'Recebimento não preparado.');}};
  return <CompletionScreen><Header title="Conferir recebimento" subtitle={`#${c?.pedidoId||''} · ${c?.nomeCliente||''}`} onBack={()=>router.back()}/><View style={{marginTop:18,marginBottom:21,alignItems:'center'}}><Text style={[type.eyebrow,{color:colors.muted}]}>{c?.requiresPayment?'TOTAL A RECEBER':'PEDIDO PAGO ONLINE'}</Text><Text style={{fontFamily:'ManropeExtraBold',fontSize:44,letterSpacing:-2.4,color:colors.ink,marginVertical:8}}>{money(c?.total)}</Text><Text style={{fontFamily:'Manrope',fontSize:10,color:colors.muted}}>O recebimento só é registrado na conclusão.</Text></View>
    {c?.requiresPayment?<><PaymentMethods value={method} onChange={m=>{setMethod(m);setConfirmed(false);}}/>{method==='dinheiro'?<><Field compact label="Dinheiro recebido" inputMode="decimal" keyboardType="decimal-pad" placeholder="100,00" value={cash} onChangeText={v=>{setCash(v);setConfirmed(false);}}/><Surface style={{backgroundColor:colors.warningSoft,marginTop:12}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={[type.small,{color:colors.warning}]}>Troco do cliente</Text><Text style={[type.small,{fontWeight:'800',color:colors.warning}]}>{money(Math.max(0,(parseCents(cash)||0)/100-(c.total||0)))}</Text></View></Surface></>:<AccountNotice icon={ShieldCheck} warning>{method==='pix'?'Confira o crédito na conta indicada pela loja. Uma imagem do cliente não confirma recebimento.':'Confira a aprovação na maquininha antes de continuar.'}</AccountNotice>}
    <CheckReceived checked={confirmed} onChange={()=>setConfirmed(v=>!v)} label={`Conferi e recebi ${money(c.total)}${method==='dinheiro'?' e entreguei o troco':''}.`}/>{!!error&&<Text accessibilityLiveRegion="polite" style={[type.small,{color:colors.danger,marginBottom:12}]}>{error}</Text>}<View style={{gap:10}}><Button icon={Check} onPress={()=>void prepare()}>Recebimento conferido</Button><Button secondary icon={Shuffle} onPress={()=>router.push('/dividirPagamento')}>Dividir em duas formas</Button></View></>:<><AccountNotice icon={Check}>Pagamento aprovado antes da entrega. Não cobre novamente.</AccountNotice><Button onPress={()=>router.back()}>Voltar à entrega</Button></>}
  </CompletionScreen>;
}
