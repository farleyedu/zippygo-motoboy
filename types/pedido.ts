// Tipos TypeScript para o modelo de Pedido
// Estrutura baseada na especificação do usuário (fonte da verdade)

export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  endereco: string;
  bairro: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ItemPedido {
  id: number;
  nome: string;
  quantidade: number;
  valor: number;
  tipo: string;
  observacoes: string;
}

export interface TimelineEvent {
  id: number;
  evento: string;
  horario: string;
  local: string;
  status: string;
}

// Modelo principal do Pedido (estrutura real da API)
export interface Pedido {
  id: number;
  nomeCliente?: string | null;
  enderecoEntrega?: string | null;
  idIfood?: string | null;
  telefoneCliente?: string | null;
  dataPedido?: string;
  statusPedido?: string | null;
  motoboyResponsavel?: string | null;
  // Campos calculados para compatibilidade com interface atual
  cliente_nome?: string;
  total_valor?: number;
  status?: string;
  coordinates?: Coordinates;
  itens?: ItemPedido[];
  timeline?: TimelineEvent[];
  cliente?: Cliente;
  // Campos adicionais para compatibilidade com componentes
  horario_formatado?: string;
  valor?: number;
  endereco?: string;
  bairro?: string;
  statusPagamento?: string;
  horario?: string;
}

// Tipo para lista resumida de pedidos (estrutura real da API)
export interface PedidoResumo {
  id: number;
  nomeCliente?: string | null;
  enderecoEntrega?: string | null;
  idIfood?: string | null;
  telefoneCliente?: string | null;
  dataPedido?: string;
  statusPedido?: string | null;
  motoboyResponsavel?: string | null;
  // Campos calculados para compatibilidade com interface atual
  cliente_nome?: string;
  total_valor?: number;
  status?: string;
  coordinates?: Coordinates;
  itens?: ItemPedido[];
  horario?: string;
  distancia_km?: number;
  // Campos adicionais para compatibilidade com componentes
  horario_formatado?: string;
  valor?: number;
  endereco?: string;
  bairro?: string;
  statusPagamento?: string;
}

// Parâmetros para busca de pedidos
export interface BuscarPedidosParams {
  status?: string;
  estabelecimentoId?: number;
  page?: number;
  limit?: number;
}

// Resposta da API para lista de pedidos
export interface PedidosResponse {
  pedidos: PedidoResumo[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Estados de loading e erro
export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}