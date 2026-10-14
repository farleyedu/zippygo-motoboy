import { apiClient } from './apiService';
import type { OrderChecklist, ChecklistConfirmation } from '../src/delivery/checklistRules';
import type { IfoodIdentity, IfoodPayment } from '../src/delivery/ifoodContracts';
import { createIdentifier, MobileApiError, MotoboyQueue } from './mobileApi';
import { assertRealProof, browserMockProofPrefix, browserNativeTest, isBrowserMockPhoto, isBrowserMockProof, reportBrowserMock } from './browserNativeTest';
export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito';
export type PaymentPart = { method: PaymentMethod; amount: number; cashReceived?: number; receivedConfirmed: boolean };
export type CompletionContext = { pedidoId: number; version: number; nomeCliente?: string; total?: number; requiresCode: boolean; requiresPayment: boolean; requiresProof: boolean; checklist?: OrderChecklist;
  origin?: string; identidadeExterna?: IfoodIdentity | null; requiresOfficialConfirmation?: boolean; completionBlockedCode?: string | null; externalOperation?: IfoodCompletionOperation | null;
  // Snapshot da fila, vinculado à identidade/revisão do contexto. Não é um campo presumido da API de conclusão.
  officialPayments?: IfoodPayment[];
};
export type CompletionRequest = { operationId: string; expectedPedidoId: number; expectedVersion: number; codigo?: string; proofId?: string; payments: PaymentPart[]; checklist?: ChecklistConfirmation };
export type DeliveryReceipt = { operationId: string; pedidoId: number; nomeCliente?: string; total?: number; completedAtUtc: string; codeChecked: boolean; paidBeforeDelivery: boolean; payments: PaymentPart[]; proofId?: string;
  origin?: string; externalDisplayNumber?: string | null; officialConfirmationEvidence?: string | null; officialOrderTotal?: number | null;
};
export type IfoodCompletionOperation = { operationId: string; pedidoId: number; kind: string; state: string; lastErrorCode?: string | null; codeChecked: boolean; receipt?: DeliveryReceipt | null };
function unwrap<T>(r: { status: number; data: { success?: boolean; data: T; error?: string; code?: string } }): T {
  if (r.status >= 400 || r.data.success === false) throw new MobileApiError(r.data.error || 'A conferência não foi confirmada.',r.status,r.data.code);
  return r.data.data;
}
const base='/v2/motoboys/me/session/completion';
export async function getCompletionContext(id: number) { return unwrap<CompletionContext>(await apiClient.get(`${base}/${id}`)); }
export async function checkDeliveryCode(id: number,codigo: string) { return unwrap<boolean>(await apiClient.post(`${base}/${id}/code`,{codigo})); }
export async function uploadDeliveryProof(id: number,base64: string) {
  if (isBrowserMockPhoto(base64)) {
    if (!browserNativeTest) throw new Error('Foto mock nao pode ser enviada ao servidor.');
    const proofId = `${browserMockProofPrefix}${id}:${createIdentifier()}`;
    sessionStorage.setItem(proofId, `data:image/jpeg;base64,${base64}`);
    reportBrowserMock('Comprovante MOCK anexado apenas no navegador. Nao foi enviado a loja.');
    return proofId;
  }
  return unwrap<string>(await apiClient.post(`${base}/${id}/proof`,{base64},{timeout:45000}));
}
export async function readPendingDeliveryProof(id:number, proofId?:string) {
  if (isBrowserMockProof(proofId)) return browserNativeTest ? sessionStorage.getItem(proofId!) : null;
  return unwrap<string|null>(await apiClient.get(`${base}/${id}/proof`));
}
export async function completeDelivery(request: CompletionRequest) { assertRealProof(request.proofId); return unwrap<{receipt:DeliveryReceipt;queue:MotoboyQueue}>(await apiClient.post(base,request,{timeout:20000})); }
export async function completeIfoodDelivery(request: CompletionRequest) { assertRealProof(request.proofId); return unwrap<IfoodCompletionOperation>(await apiClient.post(`${base}/ifood`,request,{timeout:20000})); }
export async function findIfoodCompletion(operation: string) { return unwrap<IfoodCompletionOperation>(await apiClient.get(`/motoboys/me/ifood-completions/${operation}`)); }
export async function findDeliveryReceipt(operation: string) { return unwrap<DeliveryReceipt>(await apiClient.get(`/motoboys/me/receipts/${operation}`)); }
export async function readDeliveryProof(operation: string) { return unwrap<string>(await apiClient.get(`/motoboys/me/receipts/${operation}/proof`)); }
