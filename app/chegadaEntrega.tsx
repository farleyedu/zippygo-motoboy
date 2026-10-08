import React from 'react';
import { Text,View } from 'react-native';
import { browserNativeLinking as Linking } from '../services/browserNativeTest';
import { useRouter } from 'expo-router';
import { Check,HelpCircle,MapPin,MessageCircle,Phone } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button,Feedback,Header,Surface,type } from '../src/ui/Kit';
import { MiniRouteMap,RouteScreen } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';
export default function ArrivalScreen(){
  const turn=useOperationalSession(),auth=useAuth(),router=useRouter(),{colors}=useZippyTheme(),stop=turn.queue?.current,order=stop?.pedido;
  return <RouteScreen footer={<View style={{gap:10}}><Button icon={Check} disabled={!stop?.arrivedAtUtc} onPress={()=>router.push({pathname:'/confirmacaoEntrega',params:{id:String(stop?.pedidoId)}})}>Conferir e finalizar</Button><Button secondary icon={HelpCircle} onPress={()=>router.push('/clienteAusente')}>Cliente não apareceu</Button></View>}><Header title="Você chegou." subtitle={`Última etapa · #${stop?.pedidoId||''}`} onBack={()=>router.push('/mapa')}/><View style={{marginBottom:24}}><MiniRouteMap queue={turn.queue} caption="Última etapa, com o cliente."/></View><Text style={[type.eyebrow,{color:colors.muted}]}>AGORA É COM VOCÊ E O CLIENTE.</Text><Text style={{fontFamily:'ManropeExtraBold',fontSize:32,lineHeight:35,letterSpacing:-1.2,color:colors.ink,marginTop:12,marginBottom:22}}>Boa entrega,{ '\n' }<Text style={{color:colors.accent}}>{auth.user?.nome.split(' ')[0]}.</Text></Text><Surface><Text style={{fontFamily:'ManropeExtraBold',fontSize:18,color:colors.ink}}>{order?.nomeCliente||'Cliente'}</Text><Text style={[type.small,{color:colors.muted,marginTop:5}]}>{order?.enderecoEntrega}</Text></Surface>{order?.observacoes&&<AccountNotice icon={MapPin}>{order.observacoes}</AccountNotice>}<View style={{flexDirection:'row',gap:8,marginTop:15}}><View style={{flex:1}}><Button secondary icon={MessageCircle} onPress={()=>router.push({pathname:'/conversas',params:{channel:'client',pedidoId:String(stop?.pedidoId)}})}>Enviar mensagem</Button></View><View style={{flex:1}}><Button secondary icon={Phone} disabled={!order?.telefoneCliente} onPress={()=>{const number=order?.telefoneCliente?.replace(/\D/g,'');if(number)void Linking.openURL(`tel:${number}`).catch(()=>{});}}>Contato</Button></View></View>{!stop?.arrivedAtUtc&&<Feedback title="Confirme sua chegada" message="Abra o pedido atual para registrar a chegada antes de finalizar." onRetry={()=>router.push({pathname:'/pedido/[id]',params:{id:String(stop?.pedidoId)}})}/>}</RouteScreen>;
}
