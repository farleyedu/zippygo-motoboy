// Configurações da API
const getBaseUrl = () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://zippy-api.onrender.com';
  // Normalizar URL para evitar // duplos
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
};

export const API_CONFIG = {
  // 🚀 CONFIGURAÇÃO OFICIAL - API ZIPPY NO RENDER
  BASE_URL: `${getBaseUrl()}/api`,
  
  // Timeout para requisições (em milissegundos)
  TIMEOUT: 10000,
  
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