// Serviço para comunicação com a API do ZippyGo
import axios, { AxiosInstance, AxiosResponse, AxiosAdapter, AxiosError, AxiosHeaders, CanceledError } from 'axios';
import { logApiFailure } from './apiErrors';
import { reportOperationalFailure } from './sessionEvents';
import { API_CONFIG, getApiUrl, validateApiConfig } from '../config/apiConfig';
import { Pedido, PedidosResponse, BuscarPedidosParams } from '../types/pedido';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../utils/secureStorage';

// Detectar ambiente
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
const isDev = APP_ENV === 'dev' || APP_ENV === 'development';
const verboseApi = isDev && process.env.EXPO_PUBLIC_API_DEBUG === 'true';
let authRefreshInFlight: Promise<string | null> | null = null;
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

function isOperationalEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/v2/motoboys/me/session') &&
    !endpoint.endsWith('/start') &&
    !endpoint.endsWith('/switch');
}

function isAuthEndpoint(endpoint: string): boolean {
  return endpoint === API_CONFIG.ENDPOINTS.LOGIN || endpoint === API_CONFIG.ENDPOINTS.REFRESH_TOKEN;
}

/** Renova o token principal uma vez e compartilha a mesma promessa entre requests simultaneas. */
async function refreshAuthToken(): Promise<string | null> {
  if (authRefreshInFlight) return authRefreshInFlight;

  authRefreshInFlight = (async () => {
    const refreshToken = await getSecureItem('refreshToken');
    if (!refreshToken) return null;
    const originalToken = await getSecureItem('authToken');
    const config = { method: 'POST', url: API_CONFIG.ENDPOINTS.REFRESH_TOKEN, timeout: API_CONFIG.TIMEOUT, headers: AxiosHeaders.from(API_CONFIG.DEFAULT_HEADERS) };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REFRESH_TOKEN}`, {
        method: 'POST',
        headers: API_CONFIG.DEFAULT_HEADERS,
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });
      const raw = await response.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      const data = payload?.data ?? payload;
      const [currentToken, currentRefresh] = await Promise.all([getSecureItem('authToken'), getSecureItem('refreshToken')]);
      if (currentToken !== originalToken || currentRefresh !== refreshToken) {
        throw new CanceledError('O acesso mudou durante a renovação.');
      }
      if (response.status === 401) {
        await deleteSecureItem('refreshToken');
        return null;
      }
      if (!response.ok || payload?.success === false || typeof data?.accessToken !== 'string' || !data.accessToken) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Não foi possível renovar o acesso. Tente novamente.';
        throw new AxiosError(message, AxiosError.ERR_BAD_RESPONSE, config, undefined, {
          data: payload, status: response.status, statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()), config,
        });
      }

      await setSecureItem('authToken', data.accessToken);
      await setSecureItem('zippygo.token', data.accessToken);
      if (data.refreshToken) await setSecureItem('refreshToken', data.refreshToken);
      return data.accessToken as string;
    } catch (error) {
      if (axios.isAxiosError(error)) throw error;
      throw new AxiosError(
        controller.signal.aborted ? 'A conexão demorou ao renovar seu acesso. Tente novamente.' : 'Não foi possível conectar para renovar seu acesso. Tente novamente.',
        controller.signal.aborted ? 'ECONNABORTED' : AxiosError.ERR_NETWORK, config,
      );
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    authRefreshInFlight = null;
  });

  return authRefreshInFlight;
}

// Fetch Adapter customizado para React Native
const fetchAdapter: AxiosAdapter = async (config) => {
  const url = axios.getUri(config);
  const method = config.method?.toUpperCase() || 'GET';
  const timedConfig = config as typeof config & { _startedAt?: number };
  timedConfig._startedAt = Date.now();
  
  // Log detalhado em desenvolvimento
  if (verboseApi) {
    console.log(`🔗 [API][REQ] ${method} ${url}`);
  }
  
  // Verificar CLEARTEXT em desenvolvimento
  if (isDev && url.startsWith('http://')) {
    console.warn(`⚠️ [CLEARTEXT] Chamada HTTP não segura detectada: ${url}`);
    console.warn('📍 [STACK]:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
  }
  
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (config.signal?.aborted) abort();
  config.signal?.addEventListener?.('abort', abort);
  const timer = config.timeout ? setTimeout(() => { timedOut = true; controller.abort(); }, config.timeout) : undefined;
  try {
    // O transformRequest padrao do Axios normalmente ja converte objetos para
    // JSON antes de chegar ao adapter. Serializar uma string novamente envia
    // um JSON duplamente codificado e quebra o model binding do ASP.NET.
    const requestBody = config.data == null
      ? undefined
      : typeof config.data === 'string'
        ? config.data
        : JSON.stringify(config.data);

    const response = await fetch(url, {
      method,
      headers: config.headers as Record<string, string>,
      body: requestBody,
      signal: controller.signal,
    });
    
    const data = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = data;
    }
    
    if (verboseApi) {
      console.log(`✅ [API][RES] ${method} ${url} - ${response.status} (${Date.now() - timedConfig._startedAt!} ms)`);
    }
    
    const result = {
      data: parsedData,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config,
      request: {}
    };
    if (config.validateStatus && !config.validateStatus(response.status)) {
      const message = typeof parsedData?.error === 'string' ? parsedData.error : typeof parsedData?.error?.message === 'string' ? parsedData.error.message : 'A API está temporariamente indisponível. Tente novamente.';
      throw new AxiosError(message, AxiosError.ERR_BAD_RESPONSE, config, undefined, result);
    }
    return result;
  } catch (error) {
    if (timedOut) throw new AxiosError('A conexão demorou mais que o esperado. Tente novamente.', 'ECONNABORTED', config);
    if (config.signal?.aborted) { const canceled = new CanceledError('Requisição cancelada.'); canceled.config = config; throw canceled; }
    if (axios.isAxiosError(error)) throw error;
    throw new AxiosError('Não foi possível conectar à API. Confira sua conexão e tente novamente.', AxiosError.ERR_NETWORK, config);
  } finally {
    if (timer) clearTimeout(timer);
    config.signal?.removeEventListener?.('abort', abort);
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
      const endpoint = String(config.url ?? '');
      const token = await getSecureItem(isOperationalEndpoint(endpoint) ? 'operationalAccessToken' : 'authToken');
      if (token && !(isOperationalEndpoint(endpoint) && config.headers.Authorization)) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log da requisição apenas em desenvolvimento
      if (verboseApi) {
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
      logApiFailure(error, '[API][CONFIG]');
      return config;
    }
  },
  (error) => {
    if (verboseApi) {
      logApiFailure(error, '[API][REQ]');
    }
    return Promise.reject(error);
  }
);

// Interceptor de resposta para tratamento de erros
apiClient.interceptors.response.use(
  async (response) => {
    const endpoint = String(response.config.url ?? '');
    const requestConfig = response.config as typeof response.config & { _authRetry?: boolean };

    if (isOperationalEndpoint(endpoint) && (response.status === 401 || ['SESSION_CHANGED', 'LINK_FORBIDDEN'].includes(response.data?.code))) {
      reportOperationalFailure({ status: response.status, code: response.data?.code,
        message: typeof response.data?.error === 'string' ? response.data.error : 'Seu turno foi encerrado. Confira a sessão antes de continuar.',
        token: String(response.config.headers?.Authorization || '').replace(/^Bearer\s+/i, '') });
    }

    if (response.status === 401 && !requestConfig._authRetry && !isAuthEndpoint(endpoint) && !isOperationalEndpoint(endpoint)) {
      const newToken = await refreshAuthToken();
      if (newToken) {
        requestConfig._authRetry = true;
        if (requestConfig.headers && typeof (requestConfig.headers as any).set === 'function') {
          (requestConfig.headers as any).set('Authorization', `Bearer ${newToken}`);
        } else {
          requestConfig.headers = {
            ...(requestConfig.headers as any),
            Authorization: `Bearer ${newToken}`,
          } as typeof requestConfig.headers;
        }
        return apiClient.request(requestConfig);
      }
    }

    // Log da resposta apenas em desenvolvimento
    if (verboseApi) {
      console.log('✅ [AXIOS][RES]:', {
        status: response.status,
        url: response.config.url,
        method: response.config.method?.toUpperCase()
      });
    }
    return response;
  },
  async (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros
apiClient.interceptors.response.use(
  (response) => {
    if (verboseApi) console.log('📡 API Response:', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      elapsedMs: Date.now() - (response.config as typeof response.config & { _startedAt: number })._startedAt
    });
    return response;
  },
  (error) => {
    logApiFailure(error);
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
    
    if (verboseApi) console.log('[PEDIDOS] Leitura concluída:', { count: Array.isArray(response.data) ? response.data.length : 0 });
    
    // Usar dados diretos da API sem adapter
    const pedidosRaw = Array.isArray(response.data) ? response.data : [];
    
    // A distância só é exibida quando vier preenchida pelo backend.
    const pedidosComDistancia = pedidosRaw.map(pedido => ({
      ...pedido,
      distancia_km: pedido.distancia_km ?? undefined
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
    logApiFailure(error, '[PEDIDOS]');
    throw error;
  }
};

// Função para buscar um pedido específico por ID
export const fetchPedidoById = async (id: number): Promise<Pedido> => {
  try {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.PEDIDOS_BY_ID(id));
    
    const pedidoComDistancia = {
      ...response.data,
      distancia_km: response.data.distancia_km ?? undefined
    };
    
    return pedidoComDistancia;
  } catch (error) {
    logApiFailure(error, '[PEDIDO]');
    throw error;
  }
};

// Função para criar um novo pedido (opcional)
export const createPedido = async (pedidoData: Partial<Pedido>): Promise<Pedido> => {
  try {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.PEDIDOS, pedidoData);
    return response.data;
  } catch (error) {
    logApiFailure(error, '[PEDIDO][CRIAR]');
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
    logApiFailure(error, '[ENTREGA]');
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
    
    logApiFailure(error, '[PING]');
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
    
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.HEALTH_CHECK, {
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
    logApiFailure(error, '[HEALTHZ]');
    return false;
  }
};

export default apiClient;
export { apiClient };
