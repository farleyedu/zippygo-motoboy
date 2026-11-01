import { describe, expect, it } from '@jest/globals';
import { conferenceBadge, conferenceDetails, conferenceFor, type StoreConference } from './storeConference';

const base: StoreConference = { pedidoId: 23, situacao: 'conferido', valor: 86.9, dinheiro: 66.9, lote: 'L-0001', loteSituacao: 'conferido',
  conferidoEm: '2026-11-22T17:20:00Z', conferidoPor: 'Marina', diferenca: 0 };
const when = (iso: string) => iso.slice(11, 16);

describe('conferência da loja no app', () => {
  it('selo só com o que o servidor gravou', () => {
    expect(conferenceBadge(undefined)).toBeNull();
    expect(conferenceBadge(base)).toBe('Conferido pela loja');
    expect(conferenceBadge({ ...base, diferenca: -6.9 })).toBe('Conferido pela loja · com diferença');
    expect(conferenceBadge({ ...base, situacao: 'corrigido' })).toBe('Conferido pela loja · corrigido');
    expect(conferenceBadge({ ...base, situacao: 'pendente', lote: null })).toBe('Aguardando conferência da loja');
  });

  it('recibo mostra horário, lote parcial, diferença e correção', () => {
    const parcial = conferenceDetails({ ...base, loteSituacao: 'parcial', diferenca: -6.9, motivo: 'faltou troco' }, when);
    expect(parcial).toContainEqual(['Conferido em', '17:20']);
    expect(parcial).toContainEqual(['Lote', 'L-0001 · parcial (outros pedidos seguiram pendentes)']);
    expect(parcial).toContainEqual(['Diferença no lote', 'Faltou R$ 6,90 · faltou troco']);
    const corrigido = conferenceDetails({ ...base, situacao: 'corrigido', corrigidoEm: '2026-11-22T18:05:00Z' }, when);
    expect(corrigido[0]).toEqual(['Conferência da loja', 'Conferido · corrigido depois']);
    expect(corrigido).toContainEqual(['Correção registrada', '18:05']);
    expect(conferenceDetails({ ...base, situacao: 'pendente' }, when)).toHaveLength(1);
  });

  it('acha o pedido pelo id', () => {
    expect(conferenceFor({ estabelecimentoId: 'x', motoboyId: 1, lidoEm: '', pedidos: [base] }, 23)).toBe(base);
    expect(conferenceFor(undefined, 23)).toBeUndefined();
  });
});
