export type IfoodIdentity = {
  provider: string; merchantId: string; externalOrderId: string; displayNumber?: string | null;
  orderType: string; deliveredBy?: string | null; revision: number; remoteStatus?: string | null;
  preparationState?: string | null; synchronizationState?: string | null; cancellationState?: string | null;
  dataIsCurrent: boolean; orderAmount?: number | null; prepaidAmount?: number | null; pendingAmount?: number | null;
  canAssignDelivery?: boolean; canDepartDelivery?: boolean; deliveryBlockedCode?: string | null; departureBlockedCode?: string | null;
};
export type IfoodPayment = { value?: number | null; currency?: string | null; type?: string | null; method?: string | null; changeFor?: number | null };
export type IfoodOrder = {
  externalOrderId: string; merchantId: string; displayNumber?: string | null; orderType: string; deliveredBy?: string | null;
  orderAmount: number; prepaidAmount?: number | null; pendingAmount?: number | null; amountToCollect?: number | null;
  paymentState: string; requiresReview: boolean; currency?: string | null; payments: IfoodPayment[];
  items: IfoodOrderItem[];
};
// Campos do vínculo com o cardápio são opcionais (contrato antigo não manda) e só servem para exibir:
// nunca entram em preço, quantidade, total nem em decisão de bloqueio.
export type IfoodOrderItem = {
  name: string; quantity: number; unit?: string | null; unitPrice?: number | null; totalPrice?: number | null; observations?: string | null; options: unknown;
  produtoId?: string | null; imagemUrl?: string | null; categoriaNome?: string | null; atencaoMotoboy?: boolean; vinculado?: boolean; externalCode?: string | null;
};
export type IfoodOrderSource = { origem?: string; origin?: string; identidadeExterna?: IfoodIdentity | null; pedidoIfood?: IfoodOrder | null };
