// Configurações da API
const getBaseUrl = () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://zippy-api.onrender.com';
  
  // LOG: Debug da configuração da URL
  console.log('🔧 ENV EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
  console.log('🔧 Base URL final:', baseUrl);
  
  // Normalizar URL para evitar // duplos
  const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  console.log('🔧 URL normalizada:', normalizedUrl);
  
  return normalizedUrl;
};

export const API_CONFIG = {
  // 🚀 CONFIGURAÇÃO OFICIAL - API ZIPPY NO RENDER
  BASE_URL: `${getBaseUrl()}/api`,
  
  // Timeout para requisições (em milissegundos)
  TIMEOUT: 10000,
  // Sincronização do turno tolera picos breves, com espera ainda limitada.
  OPERATIONAL_SYNC_TIMEOUT: 20000,
  
  // Headers padrão
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  
  // Endpoints da API (baseados no swagger real)
  ENDPOINTS: {
    // Teste de conexão - usando endpoint válido
    HEALTH_CHECK: '/Motoboy',
    
    // Pedidos (corrigido para maiúsculo conforme swagger)
    PEDIDOS: '/Pedido',
    PEDIDOS_BY_ID: (id: number) => `/Pedido/${id}`,
    
    // Entregas
    ENTREGAS: '/Entregas',
    CONFIRMAR_ENTREGA: '/Entregas/confirmar',
    
    // Localização
    LOCALIZACAO: '/Localizacao',
    
    // Motoboy
    MOTOBOY: '/Motoboy',
    MOTOBOY_COM_PEDIDOS: '/Motoboy/com-pedidos',
    MOTOBOY_CONVIDAR: '/Motoboy/convidar',
    
    // Autenticação (mantido para compatibilidade)
    LOGIN: '/auth/login',
    REFRESH_TOKEN: '/auth/refresh',
    ESTABLISHMENTS: '/me/estabelecimentos',
    SELECT_ESTABLISHMENT: '/auth/definir-estabelecimento',
    MOTOBOY_REGISTER: '/motoboys/cadastro',
    MOTOBOY_AVAILABLE_ESTABLISHMENTS: '/motoboys/me/estabelecimentos-disponiveis',
    MOTOBOY_LINKS: '/motoboys/me/vinculos',
    MOTOBOY_LINK_REQUESTS: '/motoboys/me/vinculos/solicitacoes',
    MOTOBOY_REQUEST_LINK: '/motoboys/me/vinculos/solicitar',
    MOTOBOY_ACCEPT_INVITE: (id: string) => `/motoboys/me/vinculos/convites/${id}/aceitar`,
    MOTOBOY_REJECT_INVITE: (id: string) => `/motoboys/me/vinculos/convites/${id}/recusar`,

    OPERATIONAL_START: '/v2/motoboys/me/session/start',
    OPERATIONAL_SESSION: '/v2/motoboys/me/session',
    OPERATIONAL_QUEUE: '/v2/motoboys/me/session/queue',
    OPERATIONAL_HEARTBEAT: '/v2/motoboys/me/session/heartbeat',
    OPERATIONAL_LOCATION: '/v2/motoboys/me/session/location',
    OPERATIONAL_LOCATION_BATCH: '/v2/motoboys/me/session/location/batch',
    ACCEPT_OFFER: '/v2/motoboys/me/session/queue/offer/accept',
    REJECT_OFFER: '/v2/motoboys/me/session/queue/offer/reject',
    REORDER_QUEUE: '/v2/motoboys/me/session/queue/reorder',
    RESUME_QUEUE: '/v2/motoboys/me/session/queue/resume',
    ARRIVED_AT_STORE: '/v2/motoboys/me/session/queue/arrived-at-store',
    PICKUP_CURRENT: '/v2/motoboys/me/session/stops/current/pickup',
    ARRIVE_CURRENT: '/v2/motoboys/me/session/stops/current/arrive',
    DELIVER_CURRENT: '/v2/motoboys/me/session/stops/current/deliver',
    FAIL_CURRENT: '/v2/motoboys/me/session/stops/current/fail',
  },
  
  // Configurações de retry
  RETRY_CONFIG: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 segundo
  },
};

// Função para obter a URL completa de um endpoint
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Função para validar se a configuração da API está correta
export const validateApiConfig = (): boolean => {
  try {
    new URL(API_CONFIG.BASE_URL);
    return true;
  } catch {
    return false;
  }
};
