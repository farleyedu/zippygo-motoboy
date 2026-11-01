// 6C6: conferência dos pedidos pela loja (lotes do Caixa), só leitura. Não é a remuneração do motoboy: é a loja dizendo que recebeu e
// conferiu o dinheiro e os comprovantes de cada pedido. Nada aqui é presumido: só o que o servidor já gravou.

export type StoreConferenceStatus = 'pendente' | 'conferido' | 'corrigido';
export type StoreConference = {
  pedidoId: number; situacao: StoreConferenceStatus; valor: number; dinheiro: number;
  loteId?: string | null; lote?: string | null; loteSituacao?: 'conferido' | 'parcial' | null;
  conferidoEm?: string | null; conferidoPor?: string | null; diferenca: number; corrigidoEm?: string | null; motivo?: string | null;
};
export type StoreConferences = { estabelecimentoId: string; motoboyId: number; lidoEm: string; pedidos: StoreConference[] };

export const conferenceFor = (data: StoreConferences | undefined, pedidoId: number) => data?.pedidos.find(p => p.pedidoId === pedidoId);

/** Selo discreto do histórico. Pendente só aparece quando o servidor diz que o pedido ainda está com você. */
export function conferenceBadge(c: StoreConference | undefined): string | null {
  if (!c) return null;
  if (c.situacao === 'pendente') return 'Aguardando conferência da loja';
  if (c.situacao === 'corrigido') return 'Conferido pela loja · corrigido';
  return c.diferenca ? 'Conferido pela loja · com diferença' : 'Conferido pela loja';
}

const brl = (v: number) => `R$ ${Math.abs(v).toFixed(2).replace('.', ',')}`;

/** Linhas do recibo: situação, horário, lote, quem conferiu e a diferença (faltou/sobrou) quando houve. */
export function conferenceDetails(c: StoreConference, when: (iso: string) => string): Array<[string, string]> {
  if (c.situacao === 'pendente') return [['Conferência da loja', 'Pendente · o pedido ainda está com você até a loja conferir']];
  const rows: Array<[string, string]> = [['Conferência da loja', c.situacao === 'corrigido' ? 'Conferido · corrigido depois' : 'Conferido pela loja']];
  if (c.conferidoEm) rows.push(['Conferido em', when(c.conferidoEm)]);
  if (c.lote) rows.push(['Lote', `${c.lote}${c.loteSituacao === 'parcial' ? ' · parcial (outros pedidos seguiram pendentes)' : ''}`]);
  if (c.conferidoPor) rows.push(['Conferido por', c.conferidoPor]);
  rows.push(['Diferença no lote', c.diferenca === 0 ? 'Bateu' : `${c.diferenca < 0 ? 'Faltou' : 'Sobrou'} ${brl(c.diferenca)}${c.motivo ? ` · ${c.motivo}` : ''}`]);
  if (c.corrigidoEm) rows.push(['Correção registrada', when(c.corrigidoEm)]);
  return rows;
}
