import React,{useEffect,useId,useRef,useState} from 'react';
import { AccessibilityInfo,ActivityIndicator,Animated,PanResponder,Platform,Pressable,StyleSheet,Text,View } from 'react-native';
import { ArrowRight,Check,LucideIcon,ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { AccountNotice } from './AccountKit';
import { Feedback,Screen,Surface,type,Gradient } from './Kit';
import { useZippyTheme } from './theme';
import Svg,{Defs,RadialGradient,Rect,Stop} from 'react-native-svg';

export const money=(value?:number)=>value==null?'Valor não informado':value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const methodNames={dinheiro:'Dinheiro',pix:'Pix',debito:'Débito',credito:'Crédito'};
export function CompletionScreen({children,footer}:{children:React.ReactNode;footer?:React.ReactNode}) {
  const completion=useDeliveryCompletion(),router=useRouter(),focused=useIsFocused();
  useEffect(()=>{if(focused && !completion.loading && ['sending','pending'].includes(completion.draft?.phase||''))router.replace('/entregaPendente');},[focused,completion.loading,completion.draft?.phase]);
  return <Screen footer={footer}>{completion.loading?<Feedback title="Recuperando sua conferência" loading/>:children}{completion.error&&<Feedback title="A conferência precisa de atenção" message={completion.error}/>}</Screen>;
}
export function StepCard({index,title,description,icon:Icon,verified,code,children}:{index:number;title:string;description:string;icon:LucideIcon;verified:boolean;code?:boolean;children?:React.ReactNode}) {
  const {colors,dark}=useZippyTheme();
  const protectedCode=verified&&code,glowId=useId().replace(/:/g,'');
  return <Surface style={{padding:16,borderRadius:18,marginBottom:10,backgroundColor:protectedCode?dark?'#1d382f':'#edf8f1':verified?dark?'#202b39':'#e4ecf7':colors.card,borderColor:protectedCode?dark?'#4b8467':'#a2ceb2':verified?dark?'#739acd6e':'#99b3d6':dark?'#43556d':colors.line,boxShadow:dark?'0 8px 18px #0003, inset 0 1px 0 #ffffff11':undefined}}>
    {dark&&!verified&&<Gradient colors={['#202b3a','#1b2531']} angle={145}/>}
    {dark&&verified&&!protectedCode&&<View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width="100%" height="100%"><Defs><RadialGradient id={glowId} cx="95%" cy="0%" rx="100%" ry="100%"><Stop offset="0" stopColor="#aecdf5" stopOpacity={22/255}/><Stop offset=".75" stopColor="#aecdf5" stopOpacity="0"/></RadialGradient></Defs><Rect width="100%" height="100%" fill={`url(#${glowId})`}/></Svg></View>}
    <View style={{flexDirection:'row',gap:12,alignItems:'flex-start'}}>
    <View style={{width:31,height:31,borderRadius:11,overflow:'hidden',alignItems:'center',justifyContent:'center',backgroundColor:protectedCode?dark?'#315d46':'#c2e5ce':verified?'#afcaed':dark?'#2b3b4f':colors.soft,boxShadow:verified?protectedCode?dark?'0 3px 0 #224a35':'0 3px 0 #91c5a3':dark?'0 3px 0 #43628b':'0 3px 0 #83a2cb':undefined}}>{dark&&verified&&!protectedCode&&<Gradient colors={['#a6c5ed','#6e94c6']} angle={180}/>}<View style={{zIndex:1}}>{verified?<Check size={15} color={protectedCode?dark?'#c1f0d1':'#205f3d':dark?'#283c57':'#375173'}/>:<Text style={{fontFamily:'ManropeExtraBold',fontSize:11,color:dark?'#b8cae1':colors.muted}}>0{index}</Text>}</View></View>
    <View style={{flex:1}}><Text style={{fontFamily:'ManropeExtraBold',fontSize:13,color:dark?'#e6ecf5':colors.ink,marginBottom:5}}>{title}</Text><Text style={{fontFamily:'Manrope',fontSize:11,lineHeight:16.5,color:dark?'#aebbcd':colors.muted}}>{description}</Text>{children}</View><Icon size={18} color={protectedCode?colors.success:dark?'#e6ecf5':colors.ink}/>
  </View></Surface>;
}
export function TextAction({children,onPress,danger,disabled,step,emphasis}:{children:string;onPress:()=>void;danger?:boolean;disabled?:boolean;step?:boolean;emphasis?:boolean}) {
  const {colors}=useZippyTheme();return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={step?8:4} style={{minHeight:step?27:36,marginTop:step?7:0,justifyContent:'center',opacity:disabled?.5:1}}><Text style={{fontFamily:'ManropeExtraBold',fontSize:emphasis?11:10,color:danger?colors.danger:colors.accent}}>{children}</Text></Pressable>;
}
export function ReceiptPair({label,value}:{label:string;value:string}){const {colors}=useZippyTheme();return <View style={{flexDirection:'row',justifyContent:'space-between',gap:12,paddingVertical:9}}><Text style={{fontFamily:'Manrope',fontSize:10,color:colors.muted}}>{label}</Text><Text style={{fontFamily:'ManropeExtraBold',fontSize:10,color:colors.ink,textAlign:'right',flexShrink:1}}>{value}</Text></View>;}
export function CheckReceived({label,checked,onChange}:{label:string;checked:boolean;onChange:()=>void}) {
  const {colors}=useZippyTheme();return <Pressable accessibilityRole="checkbox" accessibilityState={{checked}} onPress={onChange} style={{minHeight:52,flexDirection:'row',alignItems:'center',gap:10,marginVertical:9}}><View style={{width:21,height:21,borderRadius:6,borderWidth:1,borderColor:checked?colors.accent:colors.line,backgroundColor:checked?colors.accentSoft:colors.card,alignItems:'center',justifyContent:'center'}}>{checked&&<Check size={15} color={colors.accent}/>}</View><Text style={[type.small,{color:colors.ink,flex:1,fontSize:11}]}>{label}</Text></Pressable>;
}
export function SlideConfirm({enabled,busy,onConfirm}:{enabled:boolean;busy:boolean;onConfirm:()=>void}) {
  const {colors,dark,reducedMotion}=useZippyTheme(),position=useRef(new Animated.Value(0)).current,width=useRef(0),[screenReader,setScreenReader]=useState(false),confirmed=useRef(false);
  const latest=useRef({enabled,busy,onConfirm,reducedMotion});latest.current={enabled,busy,onConfirm,reducedMotion};
  useEffect(()=>{AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);const listener=AccessibilityInfo.addEventListener('screenReaderChanged',setScreenReader);return()=>listener.remove();},[]);
  useEffect(()=>{if(!busy){confirmed.current=false;position.setValue(0);}},[busy,enabled]);
  const reset=()=>Animated.timing(position,{toValue:0,duration:latest.current.reducedMotion?0:180,useNativeDriver:true}).start();
  const pan=useRef(PanResponder.create({onStartShouldSetPanResponder:()=>latest.current.enabled&&!latest.current.busy&&!confirmed.current,onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>4 && Math.abs(g.dx)>Math.abs(g.dy),onPanResponderMove:(_,g)=>position.setValue(Math.max(0,Math.min(width.current-61,g.dx))),onPanResponderRelease:(_,g)=>{const travel=width.current-61;if(latest.current.enabled && travel>60 && g.dx>=travel*.92 && !confirmed.current){confirmed.current=true;position.setValue(travel);latest.current.onConfirm();}else reset();},onPanResponderTerminate:reset})).current;
  return <View style={{marginTop:17}}><View onLayout={e=>{width.current=e.nativeEvent.layout.width;}} style={{height:61,borderRadius:19,borderWidth:1,borderColor:enabled?dark?'#7fa1ce77':'#26374d':dark?'#394d67':'#cbd4df',backgroundColor:enabled?dark?'#202c3b':'#1c2633':dark?'#243142':'#dae1e9',overflow:'hidden',boxShadow:enabled?'inset 0 3px 6px #0003':dark?'inset 0 1px 0 #ffffff09':undefined}}>
    <Text style={{position:'absolute',top:23,left:57,right:8,fontFamily:'Manrope',fontSize:11,color:enabled?'#c6dbf6':dark?'#a7b6c9':'#7289a8',textAlign:'center'}}>{busy?'Confirmando com a loja…':enabled?'Arraste para concluir':'Conclua as conferências acima'}</Text>
    <Animated.View testID="delivery-slide-handle" {...pan.panHandlers} style={{position:'absolute',left:5,top:5,width:51,height:49,borderRadius:15,overflow:'hidden',alignItems:'center',justifyContent:'center',transform:[{translateX:position}],opacity:enabled?1:.45,borderWidth:1,borderColor:dark?'#c7dffe':'#abcffd'}}><Gradient colors={dark?['#9abfef','#9abfef']:['#aed0fc','#639ae3']} angle={145}/><View style={{zIndex:1}}>{busy?<ActivityIndicator size="small" color="#344c23"/>:<ArrowRight size={22} color="#344c23"/>}</View></Animated.View>
  </View><Text style={{fontFamily:'Manrope',fontSize:8,color:colors.muted,textAlign:'center',marginVertical:9}}>Um gesto. Entrega e recebimento registrados juntos.</Text>
  {screenReader&&<Pressable accessibilityRole="button" accessibilityLabel="Confirmar entrega conferida" disabled={!enabled||busy} onPress={()=>{if(!confirmed.current){confirmed.current=true;onConfirm();}}} style={{minHeight:48,justifyContent:'center'}}><Text style={[type.small,{color:colors.accent,textAlign:'center'}]}>Confirmar entrega conferida</Text></Pressable>}</View>;
}
