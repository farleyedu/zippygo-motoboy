import React,{useEffect,useState} from 'react';
import { Text,TextInput,View } from 'react-native';
import { ShieldCheck,KeyRound } from 'lucide-react-native';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { preparedOfficialCode } from '../delivery/ifoodRules';
import { AccountNotice } from './AccountKit';
import { Button,type } from './Kit';
import { useZippyTheme } from './theme';

export function OfficialDeliveryCode() {
  const completion=useDeliveryCompletion(),d=completion.draft,{colors,dark}=useZippyTheme();
  const [code,setCode]=useState(d?.request.codigo || '');
  useEffect(()=>{setCode(d?.request.codigo || '');},[d?.request.operationId]);
  const confirmed=!!d?.codeChecked,prepared=preparedOfficialCode(d?.request.codigo) && code===d?.request.codigo;
  return <View style={{gap:12,marginTop:13}}>
    <TextInput accessibilityLabel="Código do cliente iFood" value={code} onChangeText={text=>{setCode(text);if(d?.request.codigo)void completion.validateCode('');}} maxLength={32} autoCapitalize="none" autoCorrect={false}
      editable={d?.phase==='draft' && !completion.busy && !confirmed} placeholder="Código informado pelo cliente" placeholderTextColor={colors.muted}
      style={{minHeight:62,paddingHorizontal:14,borderRadius:15,borderWidth:1,borderColor:confirmed?colors.success:colors.line,backgroundColor:confirmed?dark?'#214135':'#d7efdf':colors.card,color:confirmed?dark?'#b4efcb':'#205f3d':colors.ink,fontFamily:'ManropeExtraBold',fontSize:22,textAlign:'center'}} />
    <AccountNotice icon={confirmed?ShieldCheck:KeyRound}>{confirmed?'Código confirmado pelo iFood.':prepared?'Código preparado. A confirmação oficial será solicitada ao arrastar.':'Informe o código do cliente. O iFood fará a confirmação ao concluir.'}</AccountNotice>
    {d?.phase==='draft' && <Button icon={KeyRound} loading={completion.busy} disabled={!preparedOfficialCode(code) || prepared} onPress={()=>void completion.validateCode(code)}>Usar este código</Button>}
    {prepared && <Text accessibilityLiveRegion="polite" style={[type.small,{color:colors.muted}]}>Código informado · aguardando confirmação oficial.</Text>}
  </View>;
}
