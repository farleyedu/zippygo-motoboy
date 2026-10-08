import { apiClient } from './apiService';
import { MobileApiError, MotoboyQueue } from './mobileApi';

const base = '/v2/motoboys/me/session';
export type TransferTarget = { motoboyId: number; nome: string; avatar?: string; hasCurrentDelivery: boolean; queueSize: number };
export type Transfer = { id: number; pedidoId: number; fromMotoboyId: number; toMotoboyId: number; toMotoboyNome?: string; status: 'pending_approval' | 'completed' | 'rejected' | 'cancelled'; policy: string; reason?: string; decisionNote?: string; requestedAtUtc: string };
export type StoreDestination = { nome: string; latitude?: string | number; longitude?: string | number; rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string };
function unwrap<T>(response: { status: number; data: { success?: boolean; data: T; error?: string; code?: string } }): T {
  if (response.status >= 400 || response.data.success === false) throw new MobileApiError(response.data.error || 'Não foi possível atualizar a operação.', response.status, response.data.code);
  return response.data.data;
}
export async function setTurnPaused(paused: boolean): Promise<MotoboyQueue> { return unwrap(await apiClient.patch(`${base}/pause`, { paused })); }
export async function getStoreDestination(signal?: AbortSignal): Promise<StoreDestination> { return unwrap(await apiClient.get(`${base}/store`, { signal })); }
export async function getSharing(signal?: AbortSignal): Promise<{ compartilharLocalizacaoCliente: boolean }> { return unwrap(await apiClient.get(`${base}/preferences`, { signal })); }
export async function setSharing(compartilharLocalizacaoCliente: boolean): Promise<{ compartilharLocalizacaoCliente: boolean }> { return unwrap(await apiClient.patch(`${base}/preferences`, { compartilharLocalizacaoCliente })); }
export async function getTransferTargets(signal?: AbortSignal): Promise<TransferTarget[]> { return unwrap(await apiClient.get(`${base}/transfer-targets`, { signal })); }
export async function getTransfers(signal?: AbortSignal): Promise<Transfer[]> { const result = unwrap<Transfer[] | { items: Transfer[] }>(await apiClient.get(`${base}/transfers`, { signal })); return Array.isArray(result) ? result : result.items; }
export async function requestTransfer(pedidoId: number, paraMotoboyId: number, motivo: string): Promise<{ transfer: Transfer; sourceQueue?: MotoboyQueue }> { return unwrap(await apiClient.post(`${base}/stops/${pedidoId}/transfer`, { paraMotoboyId, motivo })); }
export async function cancelTransfer(id: number): Promise<{ transfer: Transfer; sourceQueue?: MotoboyQueue }> { return unwrap(await apiClient.delete(`${base}/transfers/${id}`)); }
export async function refuseStop(id: number, motivo: string): Promise<MotoboyQueue> { return unwrap(await apiClient.post(`${base}/stops/${id}/refuse`, { motivo })); }
