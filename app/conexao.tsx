import React from 'react';
import { Text,View } from 'react-native';
import { useRouter } from 'expo-router';
import { Map,RefreshCw,ShieldCheck,WifiOff } from 'lucide-react-native';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useDeliveryCompletion } from '../src/contexts/DeliveryCompletionContext';
import { useTrackingDiagnostics } from '../src/hooks/useTrackingDiagnostics';
import { AccountNotice,AccountScreen } from '../src/ui/AccountKit';
import { Button,Header,Surface,type } from '../src/ui/Kit';
import { ReceiptPair } from '../src/ui/CompletionKit';
import { useZippyTheme } from '../src/ui/theme';
export default function ConnectionScreen(){
  const turn=useOperationalSession(),completion=useDeliveryCompletion(),gps=useTrackingDiagnostics(),router=useRouter(),{colors}=useZippyTheme();
  return <AccountScreen active="map"><Header title="Seu trabalho não se perde." subtitle="Conexão & sincronização" onBack={()=>router.back()}/><View style={{width:83,height:83,borderRadius:27,backgroundColor:colors.warningSoft,alignItems:'center',justifyContent:'center',marginVertical:27,boxShadow:'0 8px 0 #e0c6a055',transform:[{rotate:'-6deg'}]}}><WifiOff size={36} color={colors.warning}/></View><Text style={{fontFamily:'ManropeExtraBold',fontSize:32,lineHeight:35,letterSpacing:-1.2,color:colors.ink}}>O sinal muda.{ '\n' }O caminho <Text style={{color:colors.accent}}>continua.</Text></Text><Text style={[type.body,{fontSize:13,color:colors.muted,marginVertical:16}]}>Você pode consultar o percurso já carregado. Novos envios aguardam a internet voltar.</Text><Surface><ReceiptPair label="Turno" value={turn.session?'Sessão operacional salva':'Offline'}/><ReceiptPair label="Sincronização" value={turn.phase==='reconnecting'?'Aguardando conexão':turn.phase==='online'?'Conectado':'Confira o turno'}/><ReceiptPair label="Fila de localização" value={gps.pending==null?'Ainda não disponível':`${gps.pending} amostras guardadas`}/>{['pending','sending'].includes(completion.draft?.phase||'')&&<Button secondary onPress={()=>router.push('/entregaPendente')}>Conferir conclusão pendente</Button>}</Surface><AccountNotice icon={ShieldCheck} warning>Confirmar código e concluir definitivamente exigem resposta do serviço.</AccountNotice><View style={{gap:10}}><Button icon={RefreshCw} loading={turn.busy} onPress={()=>void turn.store.tick()}>Tentar reconectar</Button><Button secondary icon={Map} onPress={()=>router.push('/mapa')}>Voltar ao caminho</Button></View></AccountScreen>;
}
