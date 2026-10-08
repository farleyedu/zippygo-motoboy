import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import { AppState,Platform } from 'react-native';
import { createIdentifier,getOperationalQueue,MobileApiError } from '../../services/mobileApi';
import { checkDeliveryCode,completeDelivery,CompletionContext,CompletionRequest,DeliveryReceipt,findDeliveryReceipt,getCompletionContext,PaymentPart,uploadDeliveryProof } from '../../services/completionApi';
import { secureStorage } from '../../utils/secureStorage';
import { registerLogoutPrecondition } from '../../services/sessionEvents';
import { readyToComplete } from '../delivery/completionRules';
import { useAuth } from './AuthContext';
import { useOperationalSession } from './OperationalSessionContext';
import { assertRealProof } from '../../services/browserNativeTest';

export type CompletionDraft={userId:string;storeId:string;sessionId:string;epoch:number;phase:'draft'|'sending'|'pending'|'completed';context:CompletionContext;request:CompletionRequest;codeChecked:boolean;receipt?:DeliveryReceipt};
type Value={draft:CompletionDraft|null;busy:boolean;loading:boolean;error:string;assertRouteMutationAllowed:()=>void;prepare:(id:number)=>Promise<void>;discardUnsent:()=>Promise<boolean>;validateCode:(code:string)=>Promise<void>;preparePayment:(parts:PaymentPart[])=>Promise<void>;uploadProof:(base64:string)=>Promise<boolean>;submit:()=>Promise<DeliveryReceipt|null>;recover:(retry?:boolean)=>Promise<DeliveryReceipt|null>;clearError:()=>void};
const Context=createContext<Value|null>(null);
export function DeliveryCompletionProvider({children}:{children:React.ReactNode}) {
  const auth=useAuth(),turn=useOperationalSession(),[draft,setDraft]=useState<CompletionDraft|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const current=useRef<CompletionDraft|null>(null),owner=useRef(''),restoredOwner=useRef<string|null>(null),running=useRef(false),writes=useRef(Promise.resolve()),generation=useRef(0);
  owner.current=String(auth.user?.id||'');
  const key=(user:string)=>`zippygo.completion.${user}`;
  const persist=async(next:CompletionDraft)=>{
    if(owner.current!==next.userId) throw new Error('Seu acesso mudou. Recupere a conta desta entrega.');
    const write=writes.current.catch(()=>{}).then(async()=>{
      // Web conserva rascunhos na sessão do navegador; Android usa SecureStore.
      if(Platform.OS==='web') sessionStorage.setItem(key(next.userId),JSON.stringify(next));
      else await secureStorage.setItemAsync(key(next.userId),JSON.stringify(next));
      if(owner.current!==next.userId) return;
      current.current=next;setDraft(next);
    });
    writes.current=write;await write;
  };
  useEffect(()=>{
    const user=owner.current,epoch=++generation.current;restoredOwner.current=null;current.current=null;setDraft(null);setError('');setLoading(true);
    if(!user){restoredOwner.current=user;setLoading(false);return;}
    (async()=>{
      try{
        const raw=Platform.OS==='web'?sessionStorage.getItem(key(user)):await secureStorage.getItemAsync(key(user));
        if(epoch!==generation.current) return;
        if(raw){const saved=JSON.parse(raw) as CompletionDraft;if(saved.userId!==user || !saved.request?.operationId || !saved.context?.pedidoId)throw new Error('O registro salvo precisa de revisão.');
          if(saved.phase==='sending')saved.phase='pending';current.current=saved;setDraft(saved);
        }
        restoredOwner.current=user;
      }catch{if(epoch===generation.current)setError('Não foi possível recuperar a conferência salva. Não conclua de novo antes de consultar a loja.');}
      finally{if(epoch===generation.current)setLoading(false);}
    })();
  },[auth.user?.id]);
  const scope=(d:CompletionDraft)=>{const state=turn.store.getSnapshot(),s=state.session;return owner.current===d.userId && s?.sessionId===d.sessionId && s.epoch===d.epoch && state.queue?.estabelecimentoId===d.storeId;};
  const assertRouteMutationAllowed=()=>{
    if(restoredOwner.current!==owner.current)throw new Error('A conferência salva ainda não pôde ser verificada. Consulte a loja antes de alterar a rota ou encerrar o turno.');
    if(current.current && ['pending','sending'].includes(current.current.phase))throw new Error('Consulte a conclusão pendente antes de alterar a rota ou encerrar o turno.');
  };
  const run=async<T,>(task:()=>Promise<T>):Promise<T|null>=>{
    if(running.current)return null;running.current=true;setBusy(true);setError('');const user=owner.current;
    try{return await task();}catch(e){if(owner.current===user)setError(e instanceof Error?e.message:'A conferência não foi confirmada.');return null;}finally{running.current=false;setBusy(false);}
  };
  const prepare=async(id:number)=>{await run(async()=>{
    const s=turn.store.getSnapshot().session,user=owner.current,old=current.current;
    if(!s || !user)throw new Error('Recupere o turno para conferir a entrega.');
    if(restoredOwner.current!==user)throw new Error('A conferência salva não pôde ser verificada. Não sobrescreva esse registro; peça orientação à loja.');
    if(old && ['pending','sending'].includes(old.phase))throw new Error('Existe uma conclusão aguardando confirmação. Consulte o resultado antes de continuar.');
    if(old?.phase==='draft' && old.context.pedidoId!==id)throw new Error('Há uma conferência de outro pedido. Confira a rota e peça orientação à loja.');
    const context=await getCompletionContext(id);
    if(owner.current!==user || turn.store.getSnapshot().session?.sessionId!==s.sessionId)throw new Error('Seu acesso mudou.');
    const preserve=old?.phase==='draft' && scope(old) && old.context.pedidoId===id && old.context.version===context.version;
    const storeId=turn.store.getSnapshot().queue?.estabelecimentoId;if(!storeId)throw new Error('Atualize a fila antes de conferir a entrega.');
    const next:CompletionDraft=preserve?{...old!,context}:{userId:user,storeId,sessionId:s.sessionId,epoch:s.epoch,phase:'draft',context,request:{operationId:createIdentifier(),expectedPedidoId:id,expectedVersion:context.version,payments:[]},codeChecked:false};
    await persist(next);
  });};
  const validateCode=async(code:string)=>{await run(async()=>{
    const d=current.current;if(!d || d.phase!=='draft' || !scope(d))throw new Error('Confira sua entrega atual.');
    if(!await checkDeliveryCode(d.context.pedidoId,code))throw new Error('O código não foi confirmado.');
    if(!scope(d))throw new Error('O turno mudou durante a conferência.');
    await persist({...d,codeChecked:true,request:{...d.request,codigo:code}});
  });};
  const preparePayment=async(parts:PaymentPart[])=>{const d=current.current;if(!d || d.phase!=='draft' || !scope(d))throw new Error('Confira sua entrega atual.');await persist({...d,request:{...d.request,payments:parts}});};
  const uploadProof=async(base64:string)=>!!await run(async()=>{
    const d=current.current;if(!d || d.phase!=='draft' || !scope(d))throw new Error('Confira sua entrega atual.');
    const proofId=await uploadDeliveryProof(d.context.pedidoId,base64);if(!scope(d))throw new Error('O turno mudou durante o envio.');
    await persist({...d,request:{...d.request,proofId}});
    return true;
  });
  const discardUnsent=async()=>!!await run(async()=>{
    const d=current.current;
    if(!d || d.phase!=='draft') throw new Error('Uma conclusão enviada precisa ser consultada; não pode ser descartada.');
    // Conferir novamente no serviço impede descartar um envio com recibo existente.
    try { await findDeliveryReceipt(d.request.operationId); throw new Error('Há um recibo desta conclusão. Consulte o resultado.'); }
    catch(e) { if(!(e instanceof MobileApiError) || e.status!==404) throw e; }
    const write=writes.current.catch(()=>{}).then(async()=>{
      if(Platform.OS==='web') sessionStorage.removeItem(key(d.userId)); else await secureStorage.deleteItemAsync(key(d.userId));
      if(owner.current===d.userId){current.current=null;setDraft(null);}
    });writes.current=write;await write;return true;
  });
  const acknowledge=async(d:CompletionDraft,receipt:DeliveryReceipt)=>{
    if(receipt.operationId!==d.request.operationId || receipt.pedidoId!==d.context.pedidoId)throw new Error('Resposta de conclusão incompatível. Consulte a loja.');
    await persist({...d,phase:'completed',receipt,request:{...d.request,codigo:undefined}});return receipt;
  };
  const send=async(d:CompletionDraft)=>{
    assertRealProof(d.request.proofId);
    if(!scope(d))throw new Error('A sessão desta conferência mudou. Consulte o recibo; recupere o turno antes de reenviar.');
    if(turn.store.getSnapshot().queue?.current?.pedidoId!==d.context.pedidoId)throw new Error('Este pedido não é mais sua entrega atual. Consulte o resultado antes de seguir.');
    const sending={...d,phase:'sending' as const};await persist(sending);
    try{const result=await completeDelivery(sending.request);if(!scope(d))throw new Error('Seu acesso mudou após o envio. Consulte o resultado ao recuperar essa conta.');
      const receipt=await acknowledge(d,result.receipt);turn.store.updateQueue(result.queue,d.sessionId);return receipt;
    }catch(e){
      const status=e instanceof MobileApiError?e.status:0;
      const uncertain=e instanceof MobileApiError && ['COMPLETION_CONFLICT','IDEMPOTENCY_CONFLICT'].includes(e.code||'');
      if(owner.current===d.userId)await persist({...d,phase:!uncertain&&(status===422 || status===409)?'draft':'pending',codeChecked:e instanceof MobileApiError && e.code==='DELIVERY_CODE_INVALID'?false:d.codeChecked});
      throw e;
    }
  };
  const submit=()=>run(async()=>{
    const d=current.current;if(!d || d.phase!=='draft' || !readyToComplete(d.context,d.codeChecked,d.request.payments,d.request.proofId))throw new Error('Conclua as conferências antes de arrastar.');
    return send(d);
  });
  const recover=(retry=false)=>run(async()=>{
    const d=current.current;if(!d)return null;if(d.phase==='completed')return d.receipt!;
    try{
      const receipt=await acknowledge(d,await findDeliveryReceipt(d.request.operationId));
      if(scope(d))try{const queue=await getOperationalQueue();if(scope(d))turn.store.updateQueue(queue,d.sessionId);}catch{/* O recibo é confirmado; a fila pode ser atualizada depois. */}
      return receipt;
    }
    catch(e){if(!(e instanceof MobileApiError) || e.status!==404)throw e;}
    if(retry)return send(d);
    throw new Error('O servidor ainda não confirmou esta conclusão. Você pode reenviar a mesma conferência.');
  });
  useEffect(()=>{if(!loading && draft?.phase==='pending')void recover(false);},[loading,auth.user?.id]);
  useEffect(()=>{
    if(loading || draft?.phase!=='pending') return;
    let alive=true,attempt=0,timer:ReturnType<typeof setTimeout>;
    const retry=async()=>{
      if(!alive || current.current?.phase!=='pending')return;
      if(AppState.currentState==='active')await recover(true);
      if(alive && current.current?.phase==='pending')timer=setTimeout(()=>void retry(),Math.min(60000,15000*2**Math.min(attempt++,2)));
    };
    timer=setTimeout(()=>void retry(),15000);
    return()=>{alive=false;clearTimeout(timer);};
  },[loading,draft?.phase==='pending',auth.user?.id,turn.session?.sessionId]);
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='active' && current.current?.phase==='pending')void recover(false);});return()=>listener.remove();},[turn.store]);
  useEffect(()=>registerLogoutPrecondition(()=>{
    if(owner.current && restoredOwner.current!==owner.current)throw new Error('A conferência salva ainda não pôde ser verificada. Aguarde a recuperação antes de sair da conta.');
    if(current.current && ['pending','sending'].includes(current.current.phase))throw new Error('Consulte a conclusão pendente antes de sair da conta. Seu acesso foi mantido.');
  }),[]);
  return <Context.Provider value={{draft,busy,loading,error,assertRouteMutationAllowed,prepare,discardUnsent,validateCode,preparePayment,uploadProof,submit,recover,clearError:()=>setError('')}}>{children}</Context.Provider>;
}
export function useDeliveryCompletion(){const value=useContext(Context);if(!value)throw new Error('Use DeliveryCompletionProvider.');return value;}
