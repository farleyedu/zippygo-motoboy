// Configurações da API
export const API_CONFIG = {
  // 🚀 CONFIGURAÇÃO OFICIAL - API ZIPPY NO RENDER
  BASE_URL: 'https://zippy-api.onrender.com/api',
  
  // Timeout para requisições (em milissegundos)
  TIMEOUT: 10000,
  
  // Headers padrão
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  
  // Endpoints da API
  ENDPOINTS: {
    // Teste de conexão
    HEALTH_CHECK: '/health',
    
    // Pedidos
    PEDIDOS: '/pedidos',
    PEDIDOS_BY_ID: (id: number) => `/pedidos/${id}`,
    
    // Entregas
    ENTREGAS: '/entregas',
    CONFIRMAR_ENTREGA: '/entregas/confirmar',
    
    // Localização do motorista
    LOCALIZACAO: '/motorista/localizacao',
    
    // Autenticação
    LOGIN: '/auth/login',
    REFRESH_TOKEN: '/auth/refresh',
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