// Ações de rota publicadas em tempo real pelo backend e o aviso que cada uma gera para o motoboy.
// `ifood_*` vêm da projeção oficial: cancelamento remove a parada; conclusão e atualização apenas mudam a rota.
export type RouteNoticeKind = 'cancelled' | 'changed';

const CANCELLED = ['canceled', 'auto_closed', 'ifood_canceled'];
const CHANGED = ['assigned', 'reordered', 'transferred', 'transfer_completed', 'ifood_closed', 'ifood_updated'];

export function routeNoticeKind(action?: string | null): RouteNoticeKind | null {
  if (!action) return null;
  if (CANCELLED.includes(action)) return 'cancelled';
  if (CHANGED.includes(action)) return 'changed';
  return null;
}
