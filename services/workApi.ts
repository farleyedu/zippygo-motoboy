import { apiClient } from './apiService';
import { MobileApiError } from './mobileApi';

export const payModes: Record<string, string> = { delivery: 'por entrega', distance: 'por km em linha reta', hour: 'por hora conferida', shift: 'por turno', day: 'por diária', week: 'por semana', fortnight: 'por quinzena', month: 'por mês' };
export type PayQuote = { planId: string; mode: string; rate: number; distanceKm?: number | null; amount?: number | null };
export type WorkEntry = { id: string; kind: 'delivery' | 'period'; mode?: string; amount?: number | null; storeCash: number; distanceKm?: number; pedidoId?: number; stopId?: number; settlementId?: string; fromUtc: string; toUtc: string; workedMinutes?: number; periodTotalSeconds?: number | null; periodWorkedSeconds?: number | null; backfilled?: boolean };
export type Settlement = { id: string; status: string; earnings: number; storeCash: number; cashReturned: boolean; reason?: string; method?: string; reference?: string; createdAtUtc: string };
export type HistoryEntry = { stopId: number; pedidoId: number; status: string; district?: string; amount?: number | null; mode?: string; distanceKm?: number; backfilled?: boolean; assignedAtUtc: string; pickedUpAtUtc?: string; arrivedAtUtc?: string; updatedAtUtc: string; operationId?: string; receipt?: string | { CodeChecked: boolean; PaidBeforeDelivery: boolean; Payments: { Method: string; Amount: number; CashReceived?: number }[] } };
export type Work = { plan?: { id: string; mode: string; rate: number; createdAtUtc: string }; entries: WorkEntry[]; settlementEntries: WorkEntry[]; settlements: Settlement[]; balance: { outstanding: number; cashToReturn: number }; history: HistoryEntry[]; earnings: number; unpricedDeliveries: number; unconfirmedReceipts: number; support: { id: string; category: string; message: string; createdAtUtc: string }[] };
function unwrap<T>(response: { status: number; data: { success?: boolean; data: T; error?: string; code?: string } }): T {
  if (response.status >= 400 || response.data.success !== true || response.data.data == null) throw new MobileApiError(response.data.error || 'Não foi possível confirmar os dados do seu trabalho.', response.status, response.data.code);
  return response.data.data;
}
export type WorkPeriod = 'today' | 'week' | '90' | { from: string; to: string };
export function historyWindow(from: string, to: string) {
  const start = new Date(`${from}T00:00:00-03:00`), end = new Date(`${to}T00:00:00-03:00`);
  const valid = [from, to].every(value => {
    const date = new Date(`${value}T00:00:00-03:00`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && new Date(date.getTime() - 3 * 3600000).toISOString().slice(0, 10) === value;
  });
  end.setTime(end.getTime() + 86400000);
  if (!valid || end <= start || end.getTime() - start.getTime() > 93 * 86400000) throw new Error('Informe datas existentes no formato AAAA-MM-DD, em um intervalo de até 93 dias.');
  return { from: start.toISOString(), to: end.toISOString() };
}
export function workWindow(period: WorkPeriod, now = new Date()) {
  if (typeof period === 'object') return period;
  const brazil = new Date(now.getTime() - 3 * 3600000);
  const midnight = Date.UTC(brazil.getUTCFullYear(), brazil.getUTCMonth(), brazil.getUTCDate(), 3);
  const days = period === 'week' ? (brazil.getUTCDay() + 6) % 7 : period === '90' ? 89 : 0;
  return { from: new Date(midnight - days * 86400000).toISOString(), to: now.toISOString() };
}
export async function getWork(store: string, period: WorkPeriod, signal?: AbortSignal): Promise<Work> {
  return unwrap(await apiClient.get('/motoboys/me/work', { params: { store, ...workWindow(period) }, signal }));
}
export async function settlementAction(store: string, id: string, action: 'review' | 'dispute' | 'receive', reason?: string): Promise<boolean> {
  return unwrap(await apiClient.post(`/motoboys/me/work/settlements/${encodeURIComponent(id)}/actions`, { action, reason }, { params: { store } }));
}
export async function sendSupport(store: string, operationId: string, category: string, message: string): Promise<string> {
  return unwrap(await apiClient.post('/motoboys/me/work/support', { operationId, category, message }, { params: { store } }));
}
