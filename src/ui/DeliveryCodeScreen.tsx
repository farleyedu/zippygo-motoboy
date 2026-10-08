import React,{useRef,useState} from 'react';
import { Text,TextInput,View,useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { HelpCircle,KeyRound,ShieldCheck } from 'lucide-react-native';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { AccountNotice } from './AccountKit';
import { Button,Header,type } from './Kit';
import { CompletionScreen } from './CompletionKit';
import { useZippyTheme } from './theme';
export default function DeliveryCodeScreen(){
  const completion=useDeliveryCompletion(),router=useRouter(),{colors,dark}=useZippyTheme(),d=completion.draft,[digits,setDigits]=useState(['','','','']),refs=useRef<(TextInput|null)[]>([]);
  const checked=!!d?.codeChecked, digitWidth=Math.min(63,(useWindowDimensions().width-71)/4);
  return <CompletionScreen><Header title="Código de entrega" subtitle={`Pedido #${d?.context.pedidoId||''}`} onBack={()=>router.back()}/>
    <View style={{width:75,height:75,borderRadius:25,backgroundColor:colors.accentSoft,borderWidth:1,borderColor:colors.line,boxShadow:'0 7px 0 #83a2cb55, 0 14px 24px #607a9d17',alignSelf:'center',alignItems:'center',justifyContent:'center',marginVertical:26}}><ShieldCheck size={32} color={colors.accent}/></View>
    <Text style={[type.eyebrow,{color:colors.muted,textAlign:'center'}]}>ENTREGA CONFERIDA</Text><Text style={{fontFamily:'ManropeExtraBold',fontSize:28,lineHeight:32,letterSpacing:-1,color:colors.ink,textAlign:'center',marginTop:12,marginBottom:15}}>O código fecha{ '\n' }a última etapa.</Text><Text style={[type.body,{fontSize:13,color:colors.muted,textAlign:'center'}]}>Peça os 4 dígitos ao cliente{ '\n' }no momento da entrega.</Text>
    <View style={{flexDirection:'row',justifyContent:'center',gap:9,marginTop:32,marginBottom:15}}>{digits.map((value,i)=><TextInput key={i} ref={input=>{refs.current[i]=input;}} accessibilityLabel={`Dígito ${i+1} do código`} keyboardType="number-pad" inputMode="numeric" maxLength={4} value={checked?(d?.request.codigo||'')[i]||'':value} editable={!checked&&!completion.busy&&d?.phase==='draft'} onKeyPress={e=>{if(e.nativeEvent.key==='Backspace'&&!value&&i>0)refs.current[i-1]?.focus();}} onChangeText={text=>{const clean=text.replace(/\D/g,'');setDigits(old=>{const next=[...old];if(clean.length>1){clean.split('').slice(0,4-i).forEach((digit,k)=>{next[i+k]=digit;});}else next[i]=clean;return next;});refs.current[Math.min(3,i+clean.length)]?.focus();}} style={{width:digitWidth,height:77,borderRadius:18,borderWidth:1,borderColor:checked?dark?'#69ae88':colors.success:dark?'#465a73':colors.line,backgroundColor:checked?dark?'#214135':'#d7efdf':dark?'#222e3e':colors.card,color:checked?dark?'#b4efcb':'#205f3d':dark?'#e5eef9':colors.ink,fontFamily:'ManropeExtraBold',fontSize:30,textAlign:'center',boxShadow:checked&&dark?'0 5px 0 #142f25':dark?'0 5px 0 #0d1117':'0 5px 0 #83a2cb33'}}/>)}</View>
    <AccountNotice icon={checked?ShieldCheck:KeyRound}>{checked?'Código validado e protegido.':'A validação confere o código informado para esta entrega.'}</AccountNotice>
    <View style={{gap:10,marginTop:22}}><Button icon={ShieldCheck} loading={completion.busy} disabled={!d || (!checked && digits.join('').length!==4)} onPress={()=>checked?router.back():void completion.validateCode(digits.join(''))}>{checked?'Voltar à conferência':'Validar código'}</Button><Button secondary icon={HelpCircle} onPress={()=>router.push('/ocorrencia')}>Cliente não tem o código</Button></View>
  </CompletionScreen>;
}
