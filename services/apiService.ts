// Serviço para comunicação com a API do ZippyGo
import axios, { AxiosInstance, AxiosResponse, AxiosAdapter } from 'axios';
import { API_CONFIG, getApiUrl, validateApiConfig } from '../config/apiConfig';
import { Pedido, PedidosResponse, BuscarPedidosParams } from '../types/pedido';
import { getSecureItem } from '../utils/secureStorage';

// Detectar ambiente
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
const isDev = APP_ENV === 'dev' || APP_ENV === 'development';
// Removendo imports do adapter - agora usamos dados diretos da API
// import { 
//   adaptPedidoRawToPedido, 
//   adaptPedidosRawToPedidosResumo, 
//   filterPedidosByStatus, 
//   paginatePedidos,
//   PedidoRaw 
// } from './pedidoAdapter';

// Validar configuração da API
if (!validateApiConfig()) {
  console.warn('⚠️ Configuração da API inválida. Verifique a URL base em config/apiConfig.ts');
}

// Fetch Adapter customizado para React Native
const fetchAdapter: AxiosAdapter = async (config) => {
  const url = config.baseURL ? `${config.baseURL}${config.url}` : config.url!;
  const method = config.method?.toUpperCase() || 'GET';
  
  // Log detalhado em desenvolvimento
  if (isDev) {
    console.log(`🔗 [API][REQ] ${method} ${url}`);
    if (config.data) {
      console.log('📤 [API][DATA]:', config.data);
    }
  }
  
  // Verificar CLEARTEXT em desenvolvimento
  if (isDev && url.startsWith('http://')) {
    console.warn(`⚠️ [CLEARTEXT] Chamada HTTP não segura detectada: ${url}`);
    console.warn('📍 [STACK]:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
  }
  
  try {
    const response = await fetch(url, {
      method,
      headers: config.headers as Record<string, string>,
      body: config.data ? JSON.stringify(config.data) : undefined,
      signal: config.signal as AbortSignal | undefined,
    });
    
    const data = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = data;
    }
    
    if (isDev) {
      console.log(`✅ [API][RES] ${method} ${url} - ${response.status}`);
    }
    
    return {
      data: parsedData,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config,
      request: {}
    };
  } catch (error) {
    if (isDev) {
      console.error(`❌ [API][ERR] ${method} ${url}:`, error);
    }
    throw error;
  }
};

// Criar instância do Axios
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    ...API_CONFIG.DEFAULT_HEADERS,
    'User-Agent': 'ZippyMotoboy/1.0.0',
  },
  // Usar fetchAdapter customizado
  adapter: fetchAdapter,
  // Configurações adicionais para resolver problemas de rede
  validateStatus: (status) => status < 500, // Aceitar códigos de status < 500
  maxRedirects: 5,
});

// Interceptor para adicionar token de autenticação JWT
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getSecureItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log da requisição apenas em desenvolvimento
      if (isDev) {
        console.log('🔗 [AXIOS][REQ]:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          fullURL: `${config.baseURL}${config.url}`,
          hasAuth: !!token
        });
        
        // Verificar CLEARTEXT no interceptor também
        const fullUrl = `${config.baseURL}${config.url}`;
        if (fullUrl.startsWith('http://')) {
          console.warn(`⚠️ [CLEARTEXT][AXIOS] URL HTTP detectada: ${fullUrl}`);
        }
      }
      
      return config;
    } catch (error) {
      console.error('❌ Erro ao configurar requisição:', error);
      return config;
    }
  },
  (error) => {
    if (isDev) {
      console.error('❌ [AXIOS][REQ][ERR]:', error);
    }
    return Promise.reject(error);
  }
);

// Interceptor de resposta para tratamento de erros
apiClient.interceptors.response.use(
  (response) => {
    // Log da resposta apenas em desenvolvimento
    if (isDev) {
      console.log('✅ [AXIOS][RES]:', {
        status: response.status,
        url: response.config.url,
        method: response.config.method?.toUpperCase()
      });
    }
    return response;
  },
  async (error) => {
    if (isDev) {
      console.error('❌ [AXIOS][RES][ERR]:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase()
      });
    }

    // Se o erro for 401 (não autorizado), limpar sessão
    if (error.response?.status === 401) {
      console.log('🔄 Token expirado, limpando sessão...');
      // Aqui você pode adicionar lógica para limpar o token e redirecionar para login
      // await clearSecureItem('userToken');
    }

    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros
apiClient.interceptors.response.use(
  (response) => {
    console.log('📡 API Response:', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      dataSize: JSON.stringify(response.data).length
    });
    return response;
  },
  (error) => {
    const errorInfo = {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      fullUrl: `${error.config?.baseURL}${error.config?.url}`,
      status: error.response?.status,
      message: error.message,
      code: error.code,
      baseURL: error.config?.baseURL,
      timeout: error.config?.timeout,
      headers: error.config?.headers,
      isNetworkError: error.message === 'Network Error',
      isTimeoutError: error.code === 'ECONNABORTED',
    };
    
    console.error('❌ ERRO DETALHADO NA API:', JSON.stringify(errorInfo, null, 2));
    
    // Log específico para Network Error
    if (error.message === 'Network Error') {
      console.error('🚨 NETWORK ERROR DETECTADO!');
      console.error('🔍 Possíveis causas:');
      console.error('   1. Problema de conectividade');
      console.error('   2. CORS bloqueado');
      console.error('   3. Certificado SSL inválido');
      console.error('   4. Firewall/Proxy bloqueando');
      console.error('   5. URL incorreta:', errorInfo.fullUrl);
    }
    
    // Sugestões para erros 404
    if (error.response?.status === 404) {
      console.warn('💡 Sugestão: Verifique se o endpoint está correto. Endpoints disponíveis:', {
        'Listar Pedidos': 'GET /api/Pedido',
        'Buscar Pedido': 'GET /api/Pedido/{id}',
        'Listar Motoboys': 'GET /api/Motoboy',
        'Confirmar Entrega': 'POST /api/Entregas/confirmar'
      });
    }
    
    return Promise.reject(error);
  }
);



// Função para buscar lista de pedidos com filtros
export const fetchPedidos = async (params?: BuscarPedidosParams): Promise<PedidosResponse> => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.status) queryParams.append('status', params.status);
    if (params?.estabelecimentoId) queryParams.append('estabelecimentoId', params.estabelecimentoId.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const url = `${API_CONFIG.ENDPOINTS.PEDIDOS}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    
    // Logs detalhados para debug
    console.log('🔍 DEBUG: URL da API:', url);
    console.log('🔍 DEBUG: Tipo de response.data:', typeof response.data);
    console.log('🔍 DEBUG: É array?', Array.isArray(response.data));
    console.log('🔍 DEBUG: Quantidade de itens:', response.data?.length || 'N/A');
    console.log('📡 Dados brutos da API para pedidos:', JSON.stringify(response.data, null, 2));
    
    // Log detalhado do primeiro pedido para debug
    if (response.data && response.data.length > 0) {
      console.log('🔍 PRIMEIRO PEDIDO COMPLETO:', JSON.stringify(response.data[0], null, 2));
    console.log('🔍 CAMPOS DISPONÍVEIS:', Object.keys(response.data[0]));
    console.log('🔍 CAMPO ITEMS:', response.data[0].items);
    console.log('🔍 CAMPO ITENS:', response.data[0].itens);
    console.log('🔍 TIPO DO CAMPO ITEMS:', typeof response.data[0].items);
    console.log('🔍 TIPO DO CAMPO ITENS:', typeof response.data[0].itens);
    }
    
    if (response.data && response.data.length > 0) {
      console.log('🔍 DEBUG: Primeiro pedido completo:', JSON.stringify(response.data[0], null, 2));
      console.log('🔍 DEBUG: Campos do primeiro pedido:', Object.keys(response.data[0]));
      if (response.data[0].items) {
        console.log('🔍 DEBUG: Campo items encontrado:', response.data[0].items);
      }
      if (response.data[0].itens) {
        console.log('🔍 DEBUG: Campo itens encontrado:', response.data[0].itens);
      }
    }
    
    // Usar dados diretos da API sem adapter
    const pedidosRaw = Array.isArray(response.data) ? response.data : [];
    
    // Simular dados de distância que viriam do JOIN com tabela distancia_pedido
    const pedidosComDistancia = pedidosRaw.map(pedido => ({
      ...pedido,
      // Simular distancia_km que viria do banco via JOIN
      distancia_km: pedido.distancia_km || (Math.random() * 20 + 1).toFixed(2)
    }));
    
    // Aplicar filtros diretamente nos dados da API
    // Como os dados da API têm statusPedido null, vamos considerar todos como 'disponivel'
    const pedidosFiltrados = params?.status 
      ? pedidosComDistancia.filter(pedido => {
          const status = pedido.statusPedido || 'disponivel';
          return status === params.status;
        })
      : pedidosComDistancia;
    
    // Aplicar paginação diretamente
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = pedidosFiltrados.slice(startIndex, endIndex);
    
    return {
      pedidos: paginatedItems,
      total: pedidosFiltrados.length,
      page: page,
      limit: limit,
      hasMore: endIndex < pedidosFiltrados.length
    };
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    throw error;
  }
};

// Função para buscar um pedido específico por ID
export const fetchPedidoById = async (id: number): Promise<Pedido> => {
  try {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.PEDIDOS_BY_ID(id));
    
    // Simular distancia_km que viria do banco via JOIN
    const pedidoComDistancia = {
      ...response.data,
      distancia_km: response.data.distancia_km || (Math.random() * 20 + 1).toFixed(2)
    };
    
    return pedidoComDistancia;
  } catch (error) {
    console.error(`Erro ao buscar pedido ${id}:`, error);
    throw error;
  }
};

// Função para criar um novo pedido (opcional)
export const createPedido = async (pedidoData: Partial<Pedido>): Promise<Pedido> => {
  try {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.PEDIDOS, pedidoData);
    return response.data;
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    throw error;
  }
};



// Função para confirmar entrega
export const confirmarEntrega = async (pedidoId: number, dados: any): Promise<any> => {
  try {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.CONFIRMAR_ENTREGA, {
      pedidoId,
      ...dados,
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao confirmar entrega:', error);
    throw error;
  }
};

// Função para atualizar localização
export const atualizarLocalizacao = async (latitude: number, longitude: number): Promise<any> => {
  try {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.LOCALIZACAO, {
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar localização:', error);
    throw error;
  }
};

// Função para testar conexão com a base de dados
// Função para testar conectividade da API
export const pingAPI = async (): Promise<{ success: boolean; message: string; endpoint: string }> => {
  try {
    console.log('🏓 Testando conectividade da API...');
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.HEALTH_CHECK);
    
    const result = {
      success: true,
      message: 'API está online e respondendo!',
      endpoint: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH_CHECK}`
    };
    
    console.log('✅ Ping API bem-sucedido:', result);
    return result;
  } catch (error: any) {
    const result = {
      success: false,
      message: `API indisponível: ${error.response?.status || error.message}`,
      endpoint: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH_CHECK}`
    };
    
    console.error('❌ Ping API falhou:', result);
    return result;
  }
};

export const testDatabaseConnection = async (): Promise<{ success: boolean; message: string }> => {
  const pingResult = await pingAPI();
  return {
    success: pingResult.success,
    message: pingResult.success 
      ? 'Conexão com a API estabelecida com sucesso!' 
      : 'Falha na conexão com a API'
  };
};

// Função para testar conectividade da API
export const testApiHealth = async (): Promise<boolean> => {
  try {
    console.log('🏥 [HEALTHZ] Testando conectividade da API...');
    
    const response = await apiClient.get('/api/Motoboy', {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ZippyMotoboy-HealthCheck/1.0.0'
      }
    });
    
    if (response.status === 200) {
      console.log(`✅ [HEALTHZ] API respondeu com status ${response.status}`);
      console.log('✅ [HEALTHZ] Conectividade OK!');
      return true;
    } else {
      console.warn(`⚠️ [HEALTHZ] API respondeu com status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ [HEALTHZ] Erro ao testar API:', error);
    return false;
  }
};

export default apiClient;
export { apiClient };