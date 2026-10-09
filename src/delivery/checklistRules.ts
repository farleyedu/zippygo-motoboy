export type ChecklistItem = { key: string; name: string; parentName?: string | null; quantity: number; imageUrl?: string | null; note?: string | null; extra: boolean };
export type OrderChecklist = { version: string; detailsUnavailable: boolean; items: ChecklistItem[] };
export type ChecklistConfirmation = { pedidoId: number; version: string; confirmedKeys: string[]; recheckedExtraKeys: string[] };
export type ChecklistOrder = { id: number; nomeCliente?: string | null; checklist: OrderChecklist };
export function checklistItems(checklist: OrderChecklist): ChecklistItem[] {
  return checklist.detailsUnavailable ? [{ key: 'manual', name: 'Conteúdo e volumes conferidos com a loja', quantity: 1, extra: true, note: 'Este pedido não tem itens detalhados. Confirme também bebidas, sobremesas e sacolas separadas.' }] : checklist.items;
}
export function checklistReady(checklist: OrderChecklist, confirmation?: ChecklistConfirmation): boolean {
  if (!confirmation || confirmation.version !== checklist.version) return false;
  const items = checklistItems(checklist);
  return confirmation.confirmedKeys.length === items.length && items.every(i => confirmation.confirmedKeys.includes(i.key)) &&
    confirmation.recheckedExtraKeys.length === items.filter(i => i.extra).length && items.filter(i => i.extra).every(i => confirmation.recheckedExtraKeys.includes(i.key));
}
export const itemSignature = (item: ChecklistItem) => JSON.stringify([item.key, item.name, item.parentName, item.quantity, item.note]);
