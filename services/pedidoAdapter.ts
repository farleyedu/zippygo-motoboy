// Adaptador para converter dados da estrutura atual do banco para a estrutura esperada pelo app
import { Pedido, PedidoResumo, Cliente, Coordinates, ItemPedido, TimelineEvent } from '../types/pedido';

// Interface para os dados brutos vindos do banco
export interface PedidoRaw {
  id: number;
  // Campos que vêm da API (formato camelCase)
  nomeCliente?: string;
  enderecoEntrega?: string;
  idIfood?: string;
  telefoneCliente?: string;
  dataPedido?: string;
  statusPedido?: string | number;
  motoboyResponsavel?: number;
  // Campos alternativos (formato snake_case) para compatibilidade
  nome_cliente?: string;
  endereco_entrega?: string;
  id_ifood?: string;
  telefone_cliente?: string;
  data_pedido?: string;
  status_pedido?: number;
  motoboy_responsavel?: number;
  horario_entrega?: string;
  items?: string;
  itens?: ItemPedido[];
  value?: string | number;
  total_valor?: number;
  region?: string;
  latitude?: string;
  longitude?: string;
  horario_pedido?: string;
  previsao_entrega?: string;
  horario_saida?: string;
  localizador?: string;
  entrega_rua?: string;
  entrega_numero?: string;
  entrega_bairro?: string;
  entrega_cidade?: string;
  entrega_estado?: string;
  entrega_cep?: string;
  documento_cliente?: string;
  tipo_pagamento?: string;
  cliente_nome?: string;
  coordinates?: Coordinates;
  status?: string;
}

// Mapeamento de status
const STATUS_MAP: { [key: number]: string } = {
  1: 'disponivel',
  2: 'aceito',
  3: 'em_entrega',
  4: 'entregue',
  5: 'cancelado'
};

/**
 * Converte coordenadas de string para números
 */
function parseCoordinates(lat?: string, lng?: string): Coordinates {
  const latitude = lat ? parseFloat(lat) : 0;
  const longitude = lng ? parseFloat(lng) : 0;
  
  return {
    lat: isNaN(latitude) ? 0 : latitude,
    lng: isNaN(longitude) ? 0 : longitude
  };
}

/**
 * Converte o campo items (string ou JSON) para array de ItemPedido
 * Agora também lida com arrays de itens vazios da API
 */
function parseItems(items?: string, valorTotal?: string | number, itensArray?: any[]): ItemPedido[] {
  // Primeiro, verifica se há um array de itens da API
  if (itensArray && Array.isArray(itensArray) && itensArray.length > 0) {
    return itensArray.map((item, index) => ({
      id: item.id || index + 1,
      nome: item.nome || item.Nome || item.name || 'Item não especificado',
      quantidade: item.quantidade || item.Quantidade || item.quantity || 1,
      valor: parseFloat(item.valor || item.PrecoUnitario || item.PrecoTotal || item.value || 0),
      tipo: item.tipo || item.type || 'comida',
      observacoes: item.observacoes || ''
    }));
  }

  // Se não há itens no array, tenta processar o campo items (string)
  if (items) {
    try {
      // Tenta fazer parse como JSON
      if (items.startsWith('[') || items.startsWith('{')) {
        const parsed = JSON.parse(items);
        
        // Se é um array
        if (Array.isArray(parsed)) {
          return parsed.map((item, index) => ({
            id: item.id || index + 1,
            nome: item.nome || item.Nome || 'Item não especificado',
            quantidade: item.quantidade || item.Quantidade || 1,
            valor: parseFloat(item.valor || item.PrecoUnitario || item.PrecoTotal || 0),
            tipo: item.tipo || 'comida',
            observacoes: item.observacoes || ''
          }));
        }
        
        // Se é um objeto único
        if (typeof parsed === 'object') {
          return [{
            id: 1,
            nome: parsed.nome || parsed.Nome || 'Item não especificado',
            quantidade: parsed.quantidade || parsed.Quantidade || 1,
            valor: parseFloat(parsed.valor || parsed.PrecoUnitario || parsed.PrecoTotal || valorTotal || 0),
            tipo: parsed.tipo || 'comida',
            observacoes: parsed.observacoes || ''
          }];
        }
      }
    } catch (error) {
      console.warn('Erro ao fazer parse dos items como JSON:', error);
    }

    // Se não conseguiu fazer parse como JSON, trata como string simples
    return [{
      id: 1,
      nome: items,
      quantidade: 1,
      valor: parseFloat(String(valorTotal || 0)),
      tipo: 'comida',
      observacoes: ''
    }];
  }

  // Se não há itens, cria um item padrão
  return [{
    id: 1,
    nome: 'Item Padrão',
    quantidade: 1,
    valor: parseFloat(String(valorTotal || 10)),
    tipo: 'comida',
    observacoes: ''
  }];
}

/**
 * Cria objeto Cliente a partir dos dados brutos
 */
function createCliente(pedidoRaw: PedidoRaw): Cliente {
  return {
    id: pedidoRaw.id,
    nome: pedidoRaw.nomeCliente || pedidoRaw.nome_cliente || pedidoRaw.cliente_nome || 'Cliente não informado',
    telefone: pedidoRaw.telefoneCliente || pedidoRaw.telefone_cliente || '',
    endereco: pedidoRaw.enderecoEntrega || pedidoRaw.endereco_entrega || '',
    bairro: pedidoRaw.entrega_bairro || '',
    // Removed statusPagamento as it's not defined in Cliente type
  };
}

/**
 * Cria timeline básica (pode ser expandida conforme necessário)
 */
function createTimeline(pedidoRaw: PedidoRaw): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  
  // Usa campos camelCase com fallback para snake_case
  const horarioPedido = pedidoRaw.dataPedido || pedidoRaw.horario_pedido;
  const statusPedido = pedidoRaw.statusPedido || pedidoRaw.status_pedido;
  
  if (horarioPedido && horarioPedido !== '0001-01-01T00:00:00') {
    timeline.push({
      id: 1,
      evento: 'Pedido criado',
      horario: horarioPedido,
      local: 'Sistema',
      status: 'criado'
    });
  }
  
  if (statusPedido && Number(statusPedido) > 1) {
    timeline.push({
      id: 2,
      evento: 'Pedido aceito',
      horario: new Date().toISOString(),
      local: 'Motoboy',
      status: 'aceito'
    });
  }
  
  if (pedidoRaw.horario_saida) {
    timeline.push({
      id: 3,
      evento: 'Saiu para entrega',
      horario: pedidoRaw.horario_saida,
      local: 'Estabelecimento',
      status: 'em_entrega'
    });
  }
  
  if (pedidoRaw.horario_entrega) {
    timeline.push({
      id: 4,
      evento: 'Pedido entregue',
      horario: pedidoRaw.horario_entrega,
      local: 'Cliente',
      status: 'entregue'
    });
  }
  
  return timeline;
}

/**
 * Converte PedidoRaw para Pedido (estrutura completa)
 */
export function adaptPedidoRawToPedido(pedidoRaw: PedidoRaw): Pedido {
  const itens = parseItems(pedidoRaw.items, pedidoRaw.value || pedidoRaw.total_valor, pedidoRaw.itens);
  const horarioEntrega = formatarHorarioEntrega(pedidoRaw.previsao_entrega);
  
  return {
    id: pedidoRaw.id,
    nomeCliente: pedidoRaw.nomeCliente || pedidoRaw.nome_cliente || pedidoRaw.cliente_nome,
    enderecoEntrega: pedidoRaw.enderecoEntrega || pedidoRaw.endereco_entrega,
    idIfood: pedidoRaw.idIfood || pedidoRaw.id_ifood,
    telefoneCliente: pedidoRaw.telefoneCliente || pedidoRaw.telefone_cliente,
    dataPedido: pedidoRaw.dataPedido || pedidoRaw.data_pedido,
    statusPedido: String(pedidoRaw.statusPedido) || pedidoRaw.status || STATUS_MAP[Number(pedidoRaw.status_pedido) || 1] || 'disponivel',
    motoboyResponsavel: pedidoRaw.motoboy_responsavel?.toString(),
    // Campos calculados para compatibilidade
    cliente_nome: pedidoRaw.nome_cliente || pedidoRaw.cliente_nome || 'Cliente não informado',
    total_valor: parseFloat(String(pedidoRaw.total_valor || pedidoRaw.value || 0)),
    status: pedidoRaw.status || STATUS_MAP[pedidoRaw.status_pedido || 1] || 'disponivel',
    coordinates: parseCoordinates(pedidoRaw.latitude, pedidoRaw.longitude),
    itens: itens,
    timeline: createTimeline(pedidoRaw),
    cliente: createCliente(pedidoRaw),
    // Campos adicionais para compatibilidade com componentes
    horario_formatado: horarioEntrega,
    valor: parseFloat(String(pedidoRaw.total_valor || pedidoRaw.value || 0)),
    endereco: pedidoRaw.endereco_entrega || pedidoRaw.entrega_rua || 'Endereço não informado',
    bairro: pedidoRaw.entrega_bairro,
    statusPagamento: 'pago', // Valor padrão
    horario: horarioEntrega
  };
}

/**
 * Formata horário de entrega prevista
 */
function formatarHorarioEntrega(previsaoEntrega?: string): string {
  if (!previsaoEntrega) return '20:00'; // fallback
  
  try {
    const data = new Date(previsaoEntrega);
    return data.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  } catch (error) {
    console.warn('⚠️ Erro ao formatar horário:', previsaoEntrega);
    return '20:00'; // fallback
  }
}

/**
 * Converte PedidoRaw para PedidoResumo (estrutura resumida para listagens)
 */
export function adaptPedidoRawToPedidoResumo(pedidoRaw: any): PedidoResumo {
  const itens = parseItems(pedidoRaw.items, pedidoRaw.value || pedidoRaw.total_valor, pedidoRaw.itens);
  const horarioEntrega = formatarHorarioEntrega(pedidoRaw.previsao_entrega);
  
  // Prioriza campos camelCase que vêm da API, com fallback para snake_case
  const nomeCliente = pedidoRaw.nomeCliente || pedidoRaw.cliente_nome || pedidoRaw.nome_cliente || 'Cliente não informado';
  const endereco = pedidoRaw.enderecoEntrega || pedidoRaw.endereco_entrega || pedidoRaw.entrega_rua || 'Endereço não informado';
  const telefone = pedidoRaw.telefoneCliente || pedidoRaw.telefone_cliente || '';
  const statusPedido = pedidoRaw.statusPedido || pedidoRaw.status_pedido || 1;
  
  return {
    id: pedidoRaw.id,
    nomeCliente: nomeCliente,
    enderecoEntrega: endereco,
    idIfood: pedidoRaw.idIfood || pedidoRaw.id_ifood,
    telefoneCliente: telefone,
    dataPedido: pedidoRaw.dataPedido || pedidoRaw.data_pedido,
    statusPedido: pedidoRaw.statusPedido || pedidoRaw.status || STATUS_MAP[Number(statusPedido)] || 'disponivel',
    motoboyResponsavel: pedidoRaw.motoboyResponsavel?.toString() || pedidoRaw.motoboy_responsavel?.toString(),
    // Campos calculados para compatibilidade
    cliente_nome: nomeCliente,
    total_valor: parseFloat(String(pedidoRaw.total_valor || pedidoRaw.value || 0)),
    valor: parseFloat(String(pedidoRaw.total_valor || pedidoRaw.value || 0)),
    status: pedidoRaw.status || STATUS_MAP[statusPedido] || 'disponivel',
    coordinates: pedidoRaw.coordinates || parseCoordinates(pedidoRaw.latitude, pedidoRaw.longitude),
    itens: itens,
    horario: horarioEntrega,
    horario_formatado: horarioEntrega,
    endereco: endereco,
    bairro: pedidoRaw.entrega_bairro || 'Bairro não informado',
    statusPagamento: pedidoRaw.tipo_pagamento || 'pago'
  };
}

/**
 * Converte array de PedidoRaw para array de PedidoResumo
 */
export function adaptPedidosRawToPedidosResumo(pedidosRaw: PedidoRaw[]): PedidoResumo[] {
  return pedidosRaw.map(adaptPedidoRawToPedidoResumo);
}

/**
 * Converte array de PedidoRaw para array de Pedido
 */
export function adaptPedidosRawToPedidos(pedidosRaw: PedidoRaw[]): Pedido[] {
  return pedidosRaw.map(adaptPedidoRawToPedido);
}

/**
 * Filtra pedidos por status
 */
export function filterPedidosByStatus(pedidos: PedidoResumo[], status?: string): PedidoResumo[] {
  if (!status) return pedidos;
  return pedidos.filter(pedido => pedido.status === status);
}

/**
 * Implementa paginação
 */
export function paginatePedidos<T>(items: T[], page: number = 1, limit: number = 10): {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
} {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedItems = items.slice(startIndex, endIndex);
  
  return {
    items: paginatedItems,
    total: items.length,
    page,
    limit,
    hasMore: endIndex < items.length
  };
}

// Exemplo de uso:
// const pedidoRaw = await fetchFromDatabase();
// const pedido = adaptPedidoRawToPedido(pedidoRaw);
// const pedidoResumo = adaptPedidoRawToPedidoResumo(pedidoRaw);

export default {
  adaptPedidoRawToPedido,
  adaptPedidoRawToPedidoResumo,
  adaptPedidosRawToPedidosResumo,
  adaptPedidosRawToPedidos,
  filterPedidosByStatus,
  paginatePedidos
};