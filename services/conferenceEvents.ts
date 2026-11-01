// 6C6: a loja confirmou (ou corrigiu) um lote com pedidos do motoboy. O aviso não traz valores: quem ouve relê a conferência.
export type ConferenceEvent = { estabelecimentoId?: string; motoboyId?: number; loteId?: string; pedidoIds?: number[]; reconnected?: boolean };
const listeners = new Set<(event: ConferenceEvent) => void>();
export const emitConferenceEvent = (event: ConferenceEvent) => listeners.forEach(listener => listener(event));
export const subscribeConferenceEvents = (listener: (event: ConferenceEvent) => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
