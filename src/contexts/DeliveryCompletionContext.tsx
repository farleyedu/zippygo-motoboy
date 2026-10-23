import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import { AppState,Platform } from 'react-native';
import { createIdentifier,getOperationalQueue,MobileApiError } from '../../services/mobileApi';
import { checkDeliveryCode,completeDelivery,completeIfoodDelivery,findIfoodCompletion,CompletionContext,CompletionRequest,DeliveryReceipt,IfoodCompletionOperation,findDeliveryReceipt,getCompletionContext,PaymentPart,uploadDeliveryProof } from '../../services/completionApi';
import { secureStorage } from '../../utils/secureStorage';
import { registerLogoutPrecondition } from '../../services/sessionEvents';
import { readyToComplete } from '../delivery/completionRules';
import { useAuth } from './AuthContext';
import { useOperationalSession } from './OperationalSessionContext';
import { assertRealProof } from '../../services/browserNativeTest';
import { checklistReady, type ChecklistConfirmation } from '../delivery/checklistRules';
import { canConcludeOperationalOrder } from '../delivery/operationalDestination';
import { assertOfficialOperation, bindIfoodContext, officialCompletion, officialOperationMessage, officialPaymentsMatch, preparedOfficialCode } from '../delivery/ifoodRules';
import { deleteCompletionRecord, readCompletionRecord, writeCompletionRecord } from '../delivery/completionStorage';

export type CompletionDraft={userId:string;storeId:string;sessionId:string;epoch:number;phase:'draft'|'sending'|'pending'|'completed';context:CompletionContext;request:CompletionRequest;codeChecked:boolean;receipt?:DeliveryReceipt;externalOperation?:IfoodCompletionOperation};
type Value={draft:CompletionDraft|null;busy:boolean;loading:boolean;error:string;notice:DeliveryReceipt|null;clearNotice:()=>void;assertRouteMutationAllowed:()=>void;prepare:(id:number)=>Promise<void>;discardUnsent:()=>Promise<boolean>;validateCode:(code:string)=>Promise<boolean>;preparePayment:(parts:PaymentPart[])=>Promise<void>;confirmItems:(confirmation:ChecklistConfirmation)=>Promise<boolean>;uploadProof:(base64:string)=>Promise<boolean>;submit:()=>Promise<DeliveryReceipt|null>;recover:(retry?:boolean)=>Promise<DeliveryReceipt|null>;clearError:()=>void};
const Context=createContext<Value|null>(null);
export function DeliveryCompletionProvider({children}:{children:React.ReactNode}) {
  const auth=useAuth(),turn=useOperationalSession(),[draft,setDraft]=useState<CompletionDraft|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [notice,setNotice]=useState<DeliveryReceipt|null>(null);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),6500);return()=>clearTimeout(timer);},[notice?.operationId]);
  const current=useRef<CompletionDraft|null>(null),owner=useRef(''),restoredOwner=useRef<string|null>(null),running=useRef(false),writes=useRef(Promise.resolve()),generation=useRef(0);
  owner.current=String(auth.user?.id||'');
  const key=(user:string)=>`zippygo.completion.${user}`;
  const persist=async(update:CompletionDraft|((latest:CompletionDraft|null)=>CompletionDraft))=>{
    const expectedOwner=owner.current;
    const write=writes.current.catch(()=>{}).then(async()=>{
      const next=typeof update==='function'?update(current.current):update;
      if(owner.current!==expectedOwner || owner.current!==next.userId) throw new Error('Seu acesso mudou. Recupere a conta desta entrega.');
      // Web conserva rascunhos na sessão do navegador; Android usa SecureStore.
      const saved = officialCompletion(next.context) && (Platform.OS === 'web' || next.phase !== 'draft')
        ? {...next,request:{...next.request,codigo:undefined}} : next;
      if(Platform.OS==='web') sessionStorage.setItem(key(next.userId),JSON.stringify(saved));
      else await writeCompletionRecord(secureStorage,key(next.userId),JSON.stringify(saved),createIdentifier());
      if(owner.current!==next.userId) return;
      current.current=next;setDraft(next);
    });
    writes.current=write;await write;
  };
  useEffect(()=>{
    const user=owner.current,epoch=++generation.current;restoredOwner.current=null;current.current=null;setDraft(null);setNotice(null);setError('');setLoading(true);
    if(!user){restoredOwner.current=user;setLoading(false);return;}
    (async()=>{
      try{
        const raw=Platform.OS==='web'?sessionStorage.getItem(key(user)):await readCompletionRecord(secureStorage,key(user));
        if(epoch!==generation.current) return;
        if(raw){const saved=JSON.parse(raw) as CompletionDraft;if(saved.userId!==user || !saved.request?.operationId || !saved.context?.pedidoId)throw new Error('O registro salvo precisa de revisão.');
          if(saved.phase==='sending')saved.phase='pending';
          if(officialCompletion(saved.context)) {
            saved.codeChecked=false;
            if(saved.phase==='completed') { saved.phase='pending'; saved.receipt=undefined; }
          }
          current.current=saved;setDraft(saved);
        }
        restoredOwner.current=user;
      }catch{if(epoch===generation.current)setError('Não foi possível recuperar a conferência salva. Não conclua de novo antes de consultar a loja.');}
      finally{if(epoch===generation.current)setLoading(false);}
    })();
  },[auth.user?.id]);
  const scope=(d:CompletionDraft)=>{const state=turn.store.getSnapshot(),s=state.session;return owner.current===d.userId && s?.sessionId===d.sessionId && s.epoch===d.epoch && state.queue?.estabelecimentoId===d.storeId;};
  const assertCompletionStage=(pedidoId:number)=>{
    if(!canConcludeOperationalOrder(turn.store.getSnapshot().queue,pedidoId))throw new Error('Confirme a saída da loja e a chegada ao cliente antes de conferir esta entrega.');
  };
  const patchDraft=(original:CompletionDraft,request:Partial<CompletionRequest>,codeChecked?:boolean)=>persist(latest=>{
    if(!latest || latest.phase!=='draft' || latest.request.operationId!==original.request.operationId || !scope(latest)) throw new Error('Sua conferência mudou. Confira o pedido atual.');
    assertCompletionStage(latest.context.pedidoId);
    return {...latest,request:{...latest.request,...request},...(codeChecked===undefined?{}:{codeChecked})};
  });
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
    assertCompletionStage(id);
    if(restoredOwner.current!==user)throw new Error('A conferência salva não pôde ser verificada. Não sobrescreva esse registro; peça orientação à loja.');
    const rejected=old?.externalOperation?.state==='rejected';
    if(old && ['pending','sending'].includes(old.phase) && !rejected)throw new Error('Existe uma conclusão aguardando confirmação. Consulte o resultado antes de continuar.');
    if(old?.phase==='draft' && old.context.pedidoId!==id)throw new Error('Há uma conferência de outro pedido. Confira a rota e peça orientação à loja.');
    const bind=async()=>bindIfoodContext(await getCompletionContext(id),turn.store.getSnapshot().queue?.current?.pedido);
    let context=await bind();
    // O bind compara com a fila local; se ela estiver atrasada, o servidor está certo. Atualiza e confere uma vez de novo.
    if(context.completionBlockedCode==='IFOOD_COMPLETION_CONTEXT_UNAVAILABLE'){await turn.store.refreshQueue();context=await bind();}
    if(owner.current!==user || turn.store.getSnapshot().session?.sessionId!==s.sessionId)throw new Error('Seu acesso mudou.');
    assertCompletionStage(id);
    const preserve=old?.phase==='draft' && scope(old) && old.context.pedidoId===id && old.context.version===context.version;
    const storeId=turn.store.getSnapshot().queue?.estabelecimentoId;if(!storeId)throw new Error('Atualize a fila antes de conferir a entrega.');
    const next:CompletionDraft=preserve?{...old!,context}:{userId:user,storeId,sessionId:s.sessionId,epoch:s.epoch,phase:'draft',context,request:{operationId:createIdentifier(),expectedPedidoId:id,expectedVersion:context.version,payments:[]},codeChecked:false};
    if(officialCompletion(context))next.codeChecked=false;
    if(rejected && old && officialPaymentsMatch(context,old.request.payments)) { next.request.payments=old.request.payments; next.externalOperation=old.externalOperation; }
    if(officialCompletion(context) && context.externalOperation && context.externalOperation.state!=='rejected') {
      next.phase='pending'; next.request={...next.request,operationId:context.externalOperation.operationId,codigo:undefined}; next.externalOperation=context.externalOperation; next.codeChecked=false;
    }
    await persist(latest=>preserve && next.phase==='draft' && latest?.request.operationId===old?.request.operationId && latest.phase==='draft' && scope(latest)?{...latest,context,codeChecked:officialCompletion(context)?false:latest.codeChecked}:next);
  });};
  const validateCode=async(code:string)=>!!await run(async()=>{
    const d=current.current;if(!d || d.phase!=='draft' || !scope(d))throw new Error('Confira sua entrega atual.');
    assertCompletionStage(d.context.pedidoId);
    if(officialCompletion(d.context)) {
      if(code==='') { await patchDraft(d,{codigo:undefined},false); return false; }
      if(!preparedOfficialCode(code)) throw new Error('Informe o código do cliente, com até 32 caracteres.');
      await patchDraft(d,{codigo:code},false); return true;
    }
    if(!await checkDeliveryCode(d.context.pedidoId,code))throw new Error('O código não foi confirmado.');
    if(!scope(d))throw new Error('O turno mudou durante a conferência.');
    await patchDraft(d,{codigo:code},true);
    return true;
  });
  const preparePayment=async(parts:PaymentPart[])=>{const d=current.current;if(!d || d.phase!=='draft' || !scope(d))throw new Error('Confira sua entrega atual.');
    if(officialCompletion(d.context) && parts.length && !officialPaymentsMatch(d.context,parts))throw new Error('Confira o recebimento conforme os meios e valores oficiais do iFood.');
    await patchDraft(d,{payments:parts});};
  const uploadProof=async(base64:string)=>!!await run(async()=>{
    const d=current.current;if(!d || d.phase!=='draft' || !scope(d))throw new Error('Confira sua entrega atual.');
    assertCompletionStage(d.context.pedidoId);
    const proofId=await uploadDeliveryProof(d.context.pedidoId,base64);if(!scope(d))throw new Error('O turno mudou durante o envio.');
    await patchDraft(d,{proofId});
    return true;
  });
  const confirmItems=async(confirmation:ChecklistConfirmation)=>!!await run(async()=>{
    const d=current.current;
    if(!d || d.phase!=='draft' || !scope(d) || confirmation.pedidoId!==d.context.pedidoId || !d.context.checklist || !checklistReady(d.context.checklist,confirmation))
      throw new Error('Os itens mudaram. Volte e confira a entrega atual.');
    await patchDraft(d,{checklist:confirmation});
    return true;
  });
  const discardUnsent=async()=>!!await run(async()=>{
    const d=current.current;
    if(!d || d.phase!=='draft') throw new Error('Uma conclusão enviada precisa ser consultada; não pode ser descartada.');
    // Conferir novamente no serviço impede descartar um envio com recibo existente.
    try { if(officialCompletion(d.context))await findIfoodCompletion(d.request.operationId);else await findDeliveryReceipt(d.request.operationId); throw new Error('Há um registro desta conclusão. Consulte o resultado.'); }
    catch(e) { if(!(e instanceof MobileApiError) || e.status!==404) throw e; }
    const write=writes.current.catch(()=>{}).then(async()=>{
      if(Platform.OS==='web') sessionStorage.removeItem(key(d.userId)); else await deleteCompletionRecord(secureStorage,key(d.userId));
      if(owner.current===d.userId){current.current=null;setDraft(null);}
    });writes.current=write;await write;return true;
  });
  const acknowledge=async(d:CompletionDraft,receipt:DeliveryReceipt)=>{
    if(receipt.operationId!==d.request.operationId || receipt.pedidoId!==d.context.pedidoId)throw new Error('Resposta de conclusão incompatível. Consulte a loja.');
    await persist({...d,phase:'completed',receipt,codeChecked:receipt.codeChecked,request:{...d.request,codigo:undefined}});
    if(owner.current===d.userId && current.current?.request.operationId===d.request.operationId)setNotice(receipt);
    return receipt;
  };
  const acceptOfficial=async(d:CompletionDraft,operation:IfoodCompletionOperation)=>{
    assertOfficialOperation(operation,d.request.operationId,d.context.pedidoId);
    const next={...d,externalOperation:operation};
    if(operation.state==='succeeded')return acknowledge(next,operation.receipt!);
    await persist({...next,phase:'pending',codeChecked:false,request:{...d.request,codigo:undefined}});
    setError(officialOperationMessage(operation)); return null;
  };
  const refreshQueue=async(d:CompletionDraft)=>{if(scope(d))try{const queue=await getOperationalQueue();if(scope(d))turn.store.updateQueue(queue,d.sessionId);}catch{/* O recibo é confirmado; a fila pode ser atualizada depois. */}};
  const send=async(d:CompletionDraft)=>{
    assertRealProof(d.request.proofId);
    if(!scope(d))throw new Error('A sessão desta conferência mudou. Consulte o recibo; recupere o turno antes de reenviar.');
    if(d.phase==='draft')assertCompletionStage(d.context.pedidoId);
    if(turn.store.getSnapshot().queue?.current?.pedidoId!==d.context.pedidoId)throw new Error('Este pedido não é mais sua entrega atual. Consulte o resultado antes de seguir.');
    const sending={...d,phase:'sending' as const};await persist(sending);
    const requestGeneration=generation.current;
    try{
      if(officialCompletion(d.context)) {
        const operation=await completeIfoodDelivery(sending.request);
        if(owner.current!==d.userId || requestGeneration!==generation.current)throw new Error('Seu acesso mudou. Consulte a confirmação ao recuperar essa conta.');
        const receipt=await acceptOfficial(d,operation); if(receipt)await refreshQueue(d); return receipt;
      }
      const result=await completeDelivery(sending.request);if(!scope(d))throw new Error('Seu acesso mudou após o envio. Consulte o resultado ao recuperar essa conta.');
      const receipt=await acknowledge(d,result.receipt);turn.store.updateQueue(result.queue,d.sessionId);return receipt;
    }catch(e){
      const status=e instanceof MobileApiError?e.status:0;
      const uncertain=e instanceof MobileApiError && ['COMPLETION_CONFLICT','IDEMPOTENCY_CONFLICT'].includes(e.code||'');
      if(owner.current===d.userId && requestGeneration===generation.current) {
        const official=officialCompletion(d.context);
        // Resposta incerta, conflito ou ausência de registro nunca cria um novo POST oficial automático.
        await persist({...d,phase:!official&&!uncertain&&(status===422 || status===409)?'draft':'pending',request:official?{...d.request,codigo:undefined}:d.request,codeChecked:official||e instanceof MobileApiError && e.code==='DELIVERY_CODE_INVALID'?false:d.codeChecked});
      }
      throw e;
    }
  };
  const submit=()=>run(async()=>{
    await writes.current;
    const d=current.current;if(!d || d.phase!=='draft' || !readyToComplete(d.context,d.codeChecked,d.request.payments,d.request.proofId,d.request.checklist,d.request.codigo))throw new Error('Conclua as conferências antes de arrastar.');
    return send(d);
  });
  const recover=(retry=false)=>run(async()=>{
    const d=current.current;if(!d)return null;if(d.phase==='completed')return d.receipt!;
    if(officialCompletion(d.context)) {
      const requestGeneration=generation.current;
      try {
        const operation=await findIfoodCompletion(d.request.operationId);
        if(owner.current!==d.userId || requestGeneration!==generation.current) return null;
        const receipt=await acceptOfficial(d,operation); if(receipt)await refreshQueue(d); return receipt;
      } catch(e) {
        if(e instanceof MobileApiError && e.status===404)throw new Error('A operação iFood não foi localizada. Não reenvie nem cobre de novo; peça à loja para conferir.');
        throw e;
      }
    }
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
      if(alive && current.current?.phase==='pending' && !['rejected','review'].includes(current.current.externalOperation?.state || ''))timer=setTimeout(()=>void retry(),Math.min(60000,15000*2**Math.min(attempt++,2)));
    };
    timer=setTimeout(()=>void retry(),15000);
    return()=>{alive=false;clearTimeout(timer);};
  },[loading,draft?.phase==='pending',auth.user?.id,turn.session?.sessionId]);
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='active' && current.current?.phase==='pending')void recover(false);});return()=>listener.remove();},[turn.store]);
  useEffect(()=>registerLogoutPrecondition(()=>{
    if(owner.current && restoredOwner.current!==owner.current)throw new Error('A conferência salva ainda não pôde ser verificada. Aguarde a recuperação antes de sair da conta.');
    if(current.current && ['pending','sending'].includes(current.current.phase))throw new Error('Consulte a conclusão pendente antes de sair da conta. Seu acesso foi mantido.');
  }),[]);
  return <Context.Provider value={{draft,busy,loading,error,notice,clearNotice:()=>setNotice(null),assertRouteMutationAllowed,prepare,discardUnsent,validateCode,preparePayment,confirmItems,uploadProof,submit,recover,clearError:()=>setError('')}}>{children}</Context.Provider>;
}
export function useDeliveryCompletion(){const value=useContext(Context);if(!value)throw new Error('Use DeliveryCompletionProvider.');return value;}
