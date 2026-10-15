import type { CompletionContext, DeliveryReceipt, IfoodCompletionOperation, PaymentMethod, PaymentPart } from '../../services/completionApi';
import type { IfoodOrderSource } from './ifoodContracts';
import type { OperationalOrderDetail } from '../../services/mobileApi';

export function isIfood(source?: IfoodOrderSource | null): boolean {
  return source?.origem?.toLowerCase() === 'ifood' || source?.origin?.toLowerCase() === 'ifood' || source?.identidadeExterna?.provider?.toLowerCase() === 'ifood' || !!source?.pedidoIfood;
}
export function officialCompletion(context: CompletionContext): boolean { return isIfood(context) || context.requiresOfficialConfirmation === true; }
export function orderLabel(source: IfoodOrderSource | null | undefined, id: number): string {
  if (!isIfood(source)) return `#${id}`;
  const number = source?.identidadeExterna?.displayNumber ?? source?.pedidoIfood?.displayNumber;
  return number ? `iFood #${number}` : 'iFood · número indisponível';
}
export function receiptLabel(receipt: DeliveryReceipt): string {
  return receipt.origin === 'ifood' ? receipt.externalDisplayNumber ? `iFood #${receipt.externalDisplayNumber}` : 'iFood · número indisponível' : `#${receipt.pedidoId}`;
}
export function preparedOfficialCode(code?: string): boolean { return !!code?.trim() && code.length <= 32 && !/[\u0000-\u001f\u007f]/.test(code); }
export function amountToCollect(source: IfoodOrderSource & { value?: number | null; statusPagamento?: string | null }): number | null {
  if (!isIfood(source)) return source.statusPagamento === 'pago' ? 0 : source.value ?? null;
  const identity = source.identidadeExterna;
  if (!identity || !identity.dataIsCurrent || identity.synchronizationState !== 'synced' || ['CANCELLED','CONCLUDED'].includes(identity.remoteStatus || '') || source.pedidoIfood?.requiresReview) return null;
  return source.pedidoIfood?.amountToCollect ?? identity.pendingAmount ?? null;
}
const localMethod = (method?: string | null): PaymentMethod | undefined => ({ CASH:'dinheiro', PIX:'pix', DEBIT:'debito', CREDIT:'credito' } as Record<string, PaymentMethod>)[method || ''];
export function officialPaymentPlan(context: CompletionContext): { parts: { method: PaymentMethod; amount: number; changeFor?: number | null }[]; error: string | null } {
  const parts: { method: PaymentMethod; amount: number; changeFor?: number | null }[] = [];
  const failed = () => ({ parts: [], error: 'Peça à loja para conferir os meios e valores oficiais do iFood.' });
  if (!context.officialPayments || context.total == null || !Number.isFinite(context.total)) return failed();
  for (const payment of context.officialPayments.filter(p => p.type === 'OFFLINE')) {
    const method = localMethod(payment.method), amount = payment.value;
    if (!method || payment.currency !== 'BRL' || amount == null || !Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > .00001) return failed();
    const same = parts.find(p => p.method === method);
    if (same) same.amount = (Math.round(same.amount * 100) + Math.round(amount * 100)) / 100;
    else parts.push({ method, amount, changeFor: payment.changeFor });
  }
  if (parts.length > 2 || parts.reduce((sum,p) => sum + Math.round(p.amount * 100),0) !== Math.round(context.total * 100)) return failed();
  return { parts, error: null };
}
export function officialPaymentsMatch(context: CompletionContext, payments: PaymentPart[]): boolean {
  const plan = officialPaymentPlan(context);
  return !plan.error && payments.length === plan.parts.length && plan.parts.every(p => payments.filter(a => a.method === p.method).reduce((sum,a) => sum + Math.round(a.amount * 100),0) === Math.round(p.amount * 100));
}
export function bindIfoodContext(context: CompletionContext, source: IfoodOrderSource | null | undefined): CompletionContext {
  if (!officialCompletion(context) && !isIfood(source)) return context;
  const identity = context.identidadeExterna, fromQueue = source?.identidadeExterna, order = source?.pedidoIfood;
  const compatible = context.requiresOfficialConfirmation === true && identity?.provider === 'ifood' && identity.orderType === 'DELIVERY' && identity.deliveredBy === 'MERCHANT' && identity.remoteStatus==='DISPATCHED' &&
    identity.dataIsCurrent && identity.synchronizationState === 'synced' && fromQueue?.externalOrderId === identity.externalOrderId && fromQueue.merchantId === identity.merchantId && fromQueue.revision === identity.revision &&
    order?.externalOrderId === identity.externalOrderId && order.merchantId === identity.merchantId && !order.requiresReview && context.total != null && context.total === identity.pendingAmount && context.total === order.amountToCollect;
  return { ...context, origin:'ifood', requiresCode:true, officialPayments:compatible ? order.payments : undefined,
    completionBlockedCode:compatible ? context.completionBlockedCode : 'IFOOD_COMPLETION_CONTEXT_UNAVAILABLE' };
}
export function assertOfficialOperation(operation: IfoodCompletionOperation, operationId: string, pedidoId: number): void {
  if (operation.operationId !== operationId || operation.pedidoId !== pedidoId || operation.kind !== 'delivery') throw new Error('A resposta não pertence a esta entrega. Consulte a loja.');
  if (operation.state === 'succeeded' && (!operation.receipt || operation.receipt.operationId !== operationId || operation.receipt.pedidoId !== pedidoId || operation.receipt.origin !== 'ifood' ||
    !['verify_delivery_code','concluded_event'].includes(operation.receipt.officialConfirmationEvidence || ''))) throw new Error('O recibo oficial ainda precisa ser conferido. Consulte a loja.');
}
export function enrichIfoodDetail(detail:OperationalOrderDetail,source:IfoodOrderSource|null|undefined,queueVersion?:number):OperationalOrderDetail {
  if(!isIfood(detail) && !isIfood(source))return detail;
  const identity=source?.identidadeExterna,order=source?.pedidoIfood;
  const compatible=queueVersion===detail.queueVersion && identity?.dataIsCurrent && identity.synchronizationState==='synced' && order?.externalOrderId===identity.externalOrderId && order?.merchantId===identity.merchantId && !order.requiresReview;
  return {...detail,origem:'ifood',identidadeExterna:identity,pedidoIfood:compatible?order:undefined,
    total:compatible?order.amountToCollect:null,formaPagamento:compatible?order.payments.filter(p=>p.type==='OFFLINE').map(p=>p.method).join(' + '):null,
    requerCodigoEntrega:true,itens:compatible?order.items.map((item,index)=>({itemId:`ifood-${index}`,nome:item.name,quantidade:item.quantity,precoUnitario:item.unitPrice,total:item.totalPrice,observacao:item.observations,official:true,
      adicionais:officialAdditions(item.options)})):[]};
}
// O iFood aninha o terceiro nível em `customizations` (e outros em `options`); todos entram na conferência.
function officialAdditions(raw:unknown,depth=0):{nome:string;preco:number;quantidade?:number}[] {
  if(!Array.isArray(raw)||depth>5)return [];
  return raw.flatMap((value:unknown)=>{
    if(!value||typeof value!=='object')return [];
    const p=value as Record<string,unknown>;
    return [...(typeof p.name==='string'?[{nome:p.name,preco:typeof p.price==='number'?p.price:0,quantidade:typeof p.quantity==='number'?p.quantity:undefined}]:[]),
      ...officialAdditions(p.options,depth+1),...officialAdditions(p.customizations,depth+1)];
  });
}
export const officialUnitPrice=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:6});
export function officialOperationMessage(operation?: IfoodCompletionOperation | null): string {
  if (operation?.state === 'review') return 'A confirmação precisa de revisão pela loja. Não cobre nem conclua novamente.';
  if (operation?.state === 'rejected') return operation.lastErrorCode === 'IFOOD_DELIVERY_CODE_INVALID' ? 'O iFood recusou o código. Confira com o cliente e revise a entrega.' : 'A confirmação foi recusada. Atualize a entrega e peça orientação à loja.';
  if (operation?.state === 'verified') return 'O iFood confirmou. Aguarde o registro final do recibo.';
  if (operation?.state === 'uncertain') return 'O resultado ainda não foi confirmado. Consulte a operação; não cobre novamente.';
  return 'Confirmação iFood pendente. Aguarde o resultado antes de seguir.';
}

// Motivos devolvidos pelo backend em `departureBlockedCode`/`deliveryBlockedCode` (ifood_delivery_blocked_code).
const DELIVERY_BLOCKED: Record<string, string> = {
  IFOOD_DELIVERY_DISABLED: 'A entrega deste pedido ainda não foi liberada para a Zippy.',
  IFOOD_DELIVERY_NOT_CONFIRMED: 'O pedido ainda não foi confirmado no iFood.',
  IFOOD_DELIVERY_NOT_READY: 'O pedido ainda não está pronto. Aguarde a loja.',
  IFOOD_DELIVERY_DISPATCH_PENDING: 'Aguarde o iFood confirmar o despacho do pedido pela loja.',
  IFOOD_DELIVERY_BEFORE_WINDOW: 'Este pedido é agendado e ainda não está na janela de entrega.',
  IFOOD_DELIVERY_CANCELLATION_PENDING: 'Há um cancelamento em andamento neste pedido. Aguarde a loja.',
  IFOOD_DELIVERY_REVIEW_REQUIRED: 'O pedido precisa de revisão pela loja.',
  IFOOD_DELIVERY_CONTEXT_UNAVAILABLE: 'Os dados do pedido estão desatualizados. Atualize a rota.',
  IFOOD_DELIVERY_LOCATION_REQUIRED: 'O pedido está sem localização de entrega. Fale com a loja.',
  IFOOD_DELIVERY_SCHEDULE_REQUIRED: 'Os horários do pedido agendado precisam de revisão pela loja.',
  IFOOD_DELIVERY_TENANT_CHANGE: 'O pedido pertence a outra loja. Atualize a rota.',
  IFOOD_DELIVERY_NOT_APPLICABLE: 'Este pedido não é uma entrega da loja.',
  IFOOD_ORDER_TERMINAL: 'O pedido já foi encerrado no iFood.',
  IFOOD_ORDER_MANAGED_EXTERNALLY: 'A entrega deste pedido é feita pelo iFood.',
  IFOOD_MERCHANT_NOT_AUTHORIZED: 'A loja precisa de autorização iFood.',
  IFOOD_COMMAND_ACTIVE_OPERATION: 'Há uma solicitação pendente deste pedido no iFood. Aguarde.',
};
export const ifoodBlockedMessage = (code?: string | null): string =>
  code ? DELIVERY_BLOCKED[code] ?? 'Aguarde a liberação do pedido pelo iFood.' : '';

// Primeiro motivo que impede a saída: o pedido iFood só sai depois do despacho oficial. Pedido próprio nunca é bloqueado aqui.
export function departureBlock(stops: { pedidoId: number; pedido?: IfoodOrderSource | null }[]): string | null {
  for (const stop of stops) {
    if (!isIfood(stop.pedido)) continue;
    const identity = stop.pedido?.identidadeExterna;
    if (identity?.canDepartDelivery === true) continue;
    const reason = identity ? ifoodBlockedMessage(identity.departureBlockedCode) || 'Aguarde a liberação do pedido pelo iFood.' : 'Os dados do pedido iFood não estão disponíveis. Atualize a rota.';
    return `${orderLabel(stop.pedido, stop.pedidoId)}: ${reason}`;
  }
  return null;
}
