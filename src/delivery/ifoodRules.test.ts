import { describe, expect, it } from '@jest/globals';
import {
  amountToCollect, assertOfficialOperation, bindIfoodContext, enrichIfoodDetail, isIfood, officialCompletion,
  officialOperationMessage, officialPaymentPlan, officialPaymentsMatch, orderLabel, preparedOfficialCode, receiptLabel,
} from './ifoodRules';
import { readyToComplete } from './completionRules';

const identity = (over: Record<string, unknown> = {}) => ({
  provider: 'ifood', merchantId: 'm-1', externalOrderId: 'o-1', displayNumber: '7183', orderType: 'DELIVERY', deliveredBy: 'MERCHANT',
  revision: 4, remoteStatus: 'DISPATCHED', preparationState: 'ready', synchronizationState: 'synced', cancellationState: 'none',
  dataIsCurrent: true, orderAmount: 27, prepaidAmount: 0, pendingAmount: 27, ...over,
}) as any;
const order = (over: Record<string, unknown> = {}) => ({
  externalOrderId: 'o-1', merchantId: 'm-1', displayNumber: '7183', orderType: 'DELIVERY', deliveredBy: 'MERCHANT', orderAmount: 27,
  prepaidAmount: 0, pendingAmount: 27, amountToCollect: 27, paymentState: 'pendente', requiresReview: false, currency: 'BRL',
  payments: [{ value: 27, currency: 'BRL', type: 'OFFLINE', method: 'CASH', changeFor: 50 }],
  items: [{ name: 'PRODUTO 2 (COMBO)', quantity: 1, unit: 'UN', unitPrice: 5, totalPrice: 16, observations: null, options: [
    { name: 'Complemento 1', quantity: 1, price: 2 },
    { name: 'Complemento 4', quantity: 1, price: 2, customizations: [
      { name: 'Customização 1 do Complemento 4', quantity: 1, price: 1 },
      { name: 'Customização 2 do Complemento 4', quantity: 1, price: 1 },
    ] },
  ] }], ...over,
}) as any;
const source = (over: Record<string, unknown> = {}) => ({ origem: 'ifood', identidadeExterna: identity(), pedidoIfood: order(), ...over }) as any;
const context = (over: Record<string, unknown> = {}) => ({
  pedidoId: 104, version: 7, total: 27, requiresCode: true, requiresPayment: true, requiresProof: false,
  origin: 'ifood', identidadeExterna: identity(), requiresOfficialConfirmation: true, completionBlockedCode: null, ...over,
}) as any;

describe('identidade do pedido iFood no app', () => {
  it('reconhece o iFood por origem, identidade ou pedido oficial', () => {
    expect(isIfood({ origem: 'IFOOD' })).toBe(true);
    expect(isIfood({ origin: 'ifood' })).toBe(true);
    expect(isIfood({ identidadeExterna: identity() })).toBe(true);
    expect(isIfood({ pedidoIfood: order() })).toBe(true);
    expect(isIfood({ origem: 'cardapio_web' })).toBe(false);
    expect(isIfood(null)).toBe(false);
    expect(isIfood(undefined)).toBe(false);
  });
  it('usa o número oficial e nunca o ID interno como se fosse do iFood', () => {
    expect(orderLabel(source(), 104)).toBe('iFood #7183');
    expect(orderLabel(source({ identidadeExterna: identity({ displayNumber: null }), pedidoIfood: null }), 104)).toBe('iFood · número indisponível');
    expect(orderLabel({ origem: 'cardapio_web' }, 104)).toBe('#104');
    expect(orderLabel(null, 104)).toBe('#104');
  });
  it('rotula o recibo pelo número oficial', () => {
    expect(receiptLabel({ origin: 'ifood', externalDisplayNumber: '0042', pedidoId: 9 } as any)).toBe('iFood #0042');
    expect(receiptLabel({ origin: 'ifood', externalDisplayNumber: null, pedidoId: 9 } as any)).toBe('iFood · número indisponível');
    expect(receiptLabel({ origin: 'local', pedidoId: 9 } as any)).toBe('#9');
  });
});

describe('código oficial do cliente', () => {
  it('aceita códigos de tamanho livre até 32 caracteres, sem fixar quatro dígitos', () => {
    expect(preparedOfficialCode('1234')).toBe(true);
    expect(preparedOfficialCode('A1B2C3D4E5')).toBe(true);
    expect(preparedOfficialCode('x'.repeat(32))).toBe(true);
  });
  it('recusa vazio, longo demais e caracteres de controle', () => {
    expect(preparedOfficialCode('')).toBe(false);
    expect(preparedOfficialCode('   ')).toBe(false);
    expect(preparedOfficialCode(undefined)).toBe(false);
    expect(preparedOfficialCode('x'.repeat(33))).toBe(false);
    expect(preparedOfficialCode('12\n34')).toBe(false);
    expect(preparedOfficialCode('12\u0000')).toBe(false);
  });
});

describe('saldo a cobrar', () => {
  it('pedido próprio: pago não cobra, pendente cobra o valor', () => {
    expect(amountToCollect({ origem: 'cardapio_web', statusPagamento: 'pago', value: 40 } as any)).toBe(0);
    expect(amountToCollect({ origem: 'cardapio_web', statusPagamento: 'pendente', value: 40 } as any)).toBe(40);
    expect(amountToCollect({ origem: 'cardapio_web' } as any)).toBeNull();
  });
  it('iFood pago online não cobra nada', () => {
    const paid = source({ identidadeExterna: identity({ pendingAmount: 0, prepaidAmount: 27 }), pedidoIfood: order({ amountToCollect: 0, pendingAmount: 0 }) });
    expect(amountToCollect(paid)).toBe(0);
  });
  it('iFood com saldo parcial cobra o saldo e não o total bruto', () => {
    const partial = source({ identidadeExterna: identity({ pendingAmount: 10, prepaidAmount: 17 }), pedidoIfood: order({ amountToCollect: 10, pendingAmount: 10 }) });
    expect(amountToCollect(partial)).toBe(10);
  });
  it('não afirma valor quando o snapshot está desatualizado, cancelado, concluído ou em revisão', () => {
    expect(amountToCollect(source({ identidadeExterna: identity({ dataIsCurrent: false }) }))).toBeNull();
    expect(amountToCollect(source({ identidadeExterna: identity({ synchronizationState: 'review' }) }))).toBeNull();
    expect(amountToCollect(source({ identidadeExterna: identity({ remoteStatus: 'CANCELLED' }) }))).toBeNull();
    expect(amountToCollect(source({ identidadeExterna: identity({ remoteStatus: 'CONCLUDED' }) }))).toBeNull();
    expect(amountToCollect(source({ pedidoIfood: order({ requiresReview: true }) }))).toBeNull();
    expect(amountToCollect({ origem: 'ifood' } as any)).toBeNull();
  });
});

describe('plano de pagamento oficial', () => {
  it('usa só os meios OFFLINE do iFood, com o troco informado', () => {
    const plan = officialPaymentPlan(context({ officialPayments: order().payments }));
    expect(plan.error).toBeNull();
    expect(plan.parts).toEqual([{ method: 'dinheiro', amount: 27, changeFor: 50 }]);
  });
  it('ignora parcela online e soma meios repetidos', () => {
    const plan = officialPaymentPlan(context({ total: 10, officialPayments: [
      { value: 17, currency: 'BRL', type: 'ONLINE', method: 'CREDIT' },
      { value: 4, currency: 'BRL', type: 'OFFLINE', method: 'PIX' },
      { value: 6, currency: 'BRL', type: 'OFFLINE', method: 'PIX' },
    ] }));
    expect(plan.error).toBeNull();
    expect(plan.parts).toEqual([{ method: 'pix', amount: 10, changeFor: undefined }]);
  });
  it('pedido todo pago online não gera cobrança', () => {
    const plan = officialPaymentPlan(context({ total: 0, officialPayments: [{ value: 27, currency: 'BRL', type: 'ONLINE', method: 'CREDIT' }] }));
    expect(plan.error).toBeNull();
    expect(plan.parts).toEqual([]);
  });
  it('recusa total divergente, moeda estrangeira, meio desconhecido, valor inválido e mais de dois meios', () => {
    const bad = (payments: unknown[], total = 27) => officialPaymentPlan(context({ total, officialPayments: payments })).error;
    expect(bad([{ value: 20, currency: 'BRL', type: 'OFFLINE', method: 'CASH' }])).not.toBeNull();
    expect(bad([{ value: 27, currency: 'USD', type: 'OFFLINE', method: 'CASH' }])).not.toBeNull();
    expect(bad([{ value: 27, currency: 'BRL', type: 'OFFLINE', method: 'VOUCHER' }])).not.toBeNull();
    expect(bad([{ value: 27.005, currency: 'BRL', type: 'OFFLINE', method: 'CASH' }])).not.toBeNull();
    expect(bad([{ value: 0, currency: 'BRL', type: 'OFFLINE', method: 'CASH' }])).not.toBeNull();
    expect(bad([
      { value: 9, currency: 'BRL', type: 'OFFLINE', method: 'CASH' }, { value: 9, currency: 'BRL', type: 'OFFLINE', method: 'PIX' },
      { value: 9, currency: 'BRL', type: 'OFFLINE', method: 'DEBIT' },
    ])).not.toBeNull();
    expect(officialPaymentPlan(context({ officialPayments: undefined })).error).not.toBeNull();
    expect(officialPaymentPlan(context({ total: null, officialPayments: [] })).error).not.toBeNull();
  });
  it('só confere recebimento igual ao plano oficial', () => {
    const ctx = context({ officialPayments: order().payments });
    expect(officialPaymentsMatch(ctx, [{ method: 'dinheiro', amount: 27, receivedConfirmed: true }])).toBe(true);
    expect(officialPaymentsMatch(ctx, [{ method: 'pix', amount: 27, receivedConfirmed: true }])).toBe(false);
    expect(officialPaymentsMatch(ctx, [{ method: 'dinheiro', amount: 26.99, receivedConfirmed: true }])).toBe(false);
    expect(officialPaymentsMatch(ctx, [])).toBe(false);
  });
});

describe('vínculo do contexto de conclusão com a fila', () => {
  const base = () => context({ officialPayments: undefined, requiresCode: false });
  it('com contexto e fila na mesma revisão, libera o pagamento oficial e exige código', () => {
    const bound = bindIfoodContext(base(), source({ identidadeExterna: identity({ pendingAmount: 27 }), pedidoIfood: order({ amountToCollect: 27 }) }));
    expect(bound.origin).toBe('ifood');
    expect(bound.requiresCode).toBe(true);
    expect(bound.completionBlockedCode).toBeNull();
    expect(bound.officialPayments).toHaveLength(1);
  });
  it('bloqueia quando a fila está em outra revisão, outro pedido ou outra loja', () => {
    const blocked = (src: any) => bindIfoodContext(base(), src).completionBlockedCode;
    expect(blocked(source({ identidadeExterna: identity({ revision: 5 }) }))).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
    expect(blocked(source({ identidadeExterna: identity({ externalOrderId: 'outro' }) }))).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
    expect(blocked(source({ identidadeExterna: identity({ merchantId: 'outra' }) }))).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
    expect(blocked(source({ pedidoIfood: order({ requiresReview: true }) }))).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
    expect(blocked(null)).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
  });
  it('bloqueia quando o pedido ainda não foi despachado pelo iFood ou não é entrega do estabelecimento', () => {
    // O estado remoto é conferido no contexto devolvido pelo servidor; a fila só precisa ser a mesma revisão.
    const blocked = (id: any) => bindIfoodContext(context({ officialPayments: undefined, identidadeExterna: id }), source()).completionBlockedCode;
    expect(blocked(identity({ remoteStatus: 'CONFIRMED' }))).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
    expect(blocked(identity({ deliveredBy: 'IFOOD' }))).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
    expect(blocked(identity({ orderType: 'TAKEOUT' }))).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
    expect(blocked(identity({ synchronizationState: 'review' }))).toBe('IFOOD_COMPLETION_CONTEXT_UNAVAILABLE');
  });
  it('não altera pedido próprio', () => {
    const own = { pedidoId: 9, version: 1, requiresCode: true, requiresPayment: true, requiresProof: false } as any;
    expect(bindIfoodContext(own, null)).toBe(own);
    expect(officialCompletion(own)).toBe(false);
  });
});

describe('operação oficial de conclusão', () => {
  const receipt = (over: Record<string, unknown> = {}) => ({ operationId: 'op-1', pedidoId: 104, origin: 'ifood', officialConfirmationEvidence: 'verify_delivery_code', ...over }) as any;
  const operation = (over: Record<string, unknown> = {}) => ({ operationId: 'op-1', pedidoId: 104, kind: 'delivery', state: 'queued', codeChecked: false, ...over }) as any;
  it('aceita operação coerente e recibo oficial com evidência', () => {
    expect(() => assertOfficialOperation(operation(), 'op-1', 104)).not.toThrow();
    expect(() => assertOfficialOperation(operation({ state: 'succeeded', receipt: receipt() }), 'op-1', 104)).not.toThrow();
    expect(() => assertOfficialOperation(operation({ state: 'succeeded', receipt: receipt({ officialConfirmationEvidence: 'concluded_event' }) }), 'op-1', 104)).not.toThrow();
  });
  it('recusa resposta de outra operação, outro pedido ou outro tipo', () => {
    expect(() => assertOfficialOperation(operation({ operationId: 'op-2' }), 'op-1', 104)).toThrow();
    expect(() => assertOfficialOperation(operation({ pedidoId: 105 }), 'op-1', 104)).toThrow();
    expect(() => assertOfficialOperation(operation({ kind: 'pickup' }), 'op-1', 104)).toThrow();
  });
  it('recusa sucesso sem recibo, sem evidência oficial ou com recibo de outro pedido ou origem', () => {
    expect(() => assertOfficialOperation(operation({ state: 'succeeded' }), 'op-1', 104)).toThrow();
    expect(() => assertOfficialOperation(operation({ state: 'succeeded', receipt: receipt({ officialConfirmationEvidence: null }) }), 'op-1', 104)).toThrow();
    expect(() => assertOfficialOperation(operation({ state: 'succeeded', receipt: receipt({ pedidoId: 9 }) }), 'op-1', 104)).toThrow();
    expect(() => assertOfficialOperation(operation({ state: 'succeeded', receipt: receipt({ origin: 'local' }) }), 'op-1', 104)).toThrow();
  });
  it('mostra uma instrução clara para cada estado e nunca manda cobrar de novo', () => {
    expect(officialOperationMessage(operation({ state: 'review' }))).toContain('revisão');
    expect(officialOperationMessage(operation({ state: 'uncertain' }))).toContain('não cobre novamente');
    expect(officialOperationMessage(operation({ state: 'verified' }))).toContain('confirmou');
    expect(officialOperationMessage(operation({ state: 'rejected', lastErrorCode: 'IFOOD_DELIVERY_CODE_INVALID' }))).toContain('código');
    expect(officialOperationMessage(operation({ state: 'rejected' }))).toContain('recusada');
    expect(officialOperationMessage(null)).toContain('pendente');
  });
});

describe('detalhe do pedido iFood na rota', () => {
  const detail = (over: Record<string, unknown> = {}) => ({ id: 104, queueVersion: 3, itens: [{ itemId: 'x', nome: 'legado', quantidade: 9, total: 1 }], ...over }) as any;
  it('mostra os itens oficiais com complementos e customizações de terceiro nível', () => {
    const result = enrichIfoodDetail(detail(), source(), 3);
    expect(result.itens).toHaveLength(1);
    expect(result.itens[0].nome).toBe('PRODUTO 2 (COMBO)');
    expect(result.itens[0].total).toBe(16);
    expect(result.itens[0].adicionais.map((a: any) => a.nome)).toEqual([
      'Complemento 1', 'Complemento 4', 'Customização 1 do Complemento 4', 'Customização 2 do Complemento 4',
    ]);
    expect(result.itens[0].adicionais.reduce((sum: number, a: any) => sum + a.preco, 0)).toBe(6);
    expect(result.total).toBe(27);
    expect(result.formaPagamento).toBe('CASH');
    expect(result.requerCodigoEntrega).toBe(true);
  });
  it('sem a mesma versão da fila, não usa nem itens legados nem valores', () => {
    const result = enrichIfoodDetail(detail(), source(), 99);
    expect(result.itens).toEqual([]);
    expect(result.total).toBeNull();
    expect(result.pedidoIfood).toBeUndefined();
  });
  it('não mexe em pedido próprio', () => {
    const own = detail({ origem: 'cardapio_web' });
    expect(enrichIfoodDetail(own, null, 3)).toBe(own);
  });
});

describe('prontidão para concluir (iFood)', () => {
  const ready = (ctx: any, code: string | undefined, payments: any[] = [{ method: 'dinheiro', amount: 27, receivedConfirmed: true, cashReceived: 30 }]) =>
    readyToComplete(ctx, false, payments, undefined, undefined, code);
  const ctx = (over: Record<string, unknown> = {}) => context({ officialPayments: order().payments, ...over });
  it('exige código válido, recebimento oficial e contexto sem bloqueio', () => {
    expect(ready(ctx(), '1234')).toBe(true);
    expect(ready(ctx(), undefined)).toBe(false);
    expect(ready(ctx(), '')).toBe(false);
    expect(ready(ctx({ completionBlockedCode: 'IFOOD_COMPLETION_CONTEXT_UNAVAILABLE' }), '1234')).toBe(false);
    expect(ready(ctx({ requiresOfficialConfirmation: false }), '1234')).toBe(false);
    expect(ready(ctx(), '1234', [{ method: 'pix', amount: 27, receivedConfirmed: true }])).toBe(false);
  });
  it('o código preenchido não basta como "conferido": o servidor é quem confirma', () => {
    expect(readyToComplete(ctx(), true, [], undefined, undefined, undefined)).toBe(false);
  });
});
