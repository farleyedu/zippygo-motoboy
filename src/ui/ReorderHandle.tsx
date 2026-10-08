import React,{useRef} from 'react';
import { Animated,PanResponder,View } from 'react-native';
import { GripVertical } from 'lucide-react-native';
import { useZippyTheme } from './theme';

// Apenas a alça captura o gesto; o conteúdo continua disponível para abrir o pedido.
export function ReorderHandle({onDrop,label}:{onDrop:(delta:number)=>void;label:string}) {
  const {colors,reducedMotion}=useZippyTheme(),y=useRef(new Animated.Value(0)).current,latest=useRef(onDrop);latest.current=onDrop;
  const reset=()=>Animated.timing(y,{toValue:0,duration:reducedMotion?0:160,useNativeDriver:true}).start();
  const responder=useRef(PanResponder.create({onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dy)>5,onPanResponderMove:(_,g)=>y.setValue(Math.max(-150,Math.min(150,g.dy))),onPanResponderRelease:(_,g)=>{latest.current(g.dy);reset();},onPanResponderTerminate:reset})).current;
  return <Animated.View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityHint="Arraste para cima ou para baixo para mudar a ordem" accessibilityActions={[{name:'increment',label:'Descer'},{name:'decrement',label:'Subir'}]} onAccessibilityAction={e=>latest.current(e.nativeEvent.actionName==='increment'?90:-90)} style={{width:44,minHeight:44,alignItems:'center',justifyContent:'center',transform:[{translateY:y}],backgroundColor:colors.soft,borderRadius:13}}><GripVertical size={19} color={colors.accent}/></Animated.View>;
}
