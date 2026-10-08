import React from 'react';
import { View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { PaymentMethod } from '../../services/completionApi';
import { methodNames } from './CompletionKit';
import { useZippyTheme } from './theme';

export function PaymentMethodSelect({value,onChange,label}:{value:PaymentMethod;onChange:(method:PaymentMethod)=>void;label:string}) {
  const {colors}=useZippyTheme();
  return <View style={{height:47,borderRadius:13,borderWidth:1,borderColor:colors.line,backgroundColor:colors.soft,overflow:'hidden',marginBottom:12,justifyContent:'center'}}>
    <Picker accessibilityLabel={label} selectedValue={value} onValueChange={onChange} mode="dropdown" dropdownIconColor={colors.muted} style={{height:47,color:colors.ink,fontFamily:'Manrope',fontSize:12,backgroundColor:'transparent'}}>
      {(Object.keys(methodNames) as PaymentMethod[]).map(method=><Picker.Item key={method} label={methodNames[method]} value={method}/>) }
    </Picker>
  </View>;
}
