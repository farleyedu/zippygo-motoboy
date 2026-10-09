import type { CompletionContext, PaymentPart } from '../../services/completionApi';
import { checklistReady, type ChecklistConfirmation } from './checklistRules';
export function parseCents(text: string): number | null {
  const value=text.trim().replace(/\s/g,'');
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [whole,fraction='']=value.replace(',','.').split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(cents) && cents<=100_000_000 ? cents : null;
}
export function paymentError(total: number | undefined,parts: PaymentPart[]): string | null {
  const due=Math.round((total ?? 0)*100);
  if(!due || total==null || Math.abs(total*100-due)>.00001) return 'Peça à loja para conferir o valor do pedido.';
  if(parts.length<1 || parts.length>2 || parts.reduce((sum,p)=>sum+Math.round(p.amount*100),0)!==due) return 'As partes precisam somar exatamente o total do pedido.';
  for(const p of parts) {
    if(p.amount<=0 || Math.abs(p.amount*100-Math.round(p.amount*100))>.00001 || !p.receivedConfirmed) return 'Confira o recebimento de cada parte.';
    if(p.method==='dinheiro' && (p.cashReceived==null || p.cashReceived<p.amount)) return 'Confira o dinheiro recebido e entregue o troco.';
  }
  return null;
}
export function readyToComplete(context: CompletionContext,codeChecked: boolean,payments: PaymentPart[],proofId?: string,checklist?: ChecklistConfirmation) {
  return (!context.checklist || checklistReady(context.checklist,checklist)) && (!context.requiresCode || codeChecked) && (!context.requiresPayment || !paymentError(context.total,payments)) && (!context.requiresProof || !!proofId);
}
