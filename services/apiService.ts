// Serviço para testar conexão com a base de dados
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { API_CONFIG, getApiUrl, validateApiConfig } from '../config/apiConfig';

// Validar configuração da API
if (!validateApiConfig()) {
  console.warn('⚠️ Configuração da API inválida. Verifique a URL base em config/apiConfig.ts');
}

// Criar instância do Axios
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.DEFAULT_HEADERS,
});

// Interceptor para adicionar token de autenticação se necessário
apiClient.interceptors.request.use(
  (config) => {
    // Adicione aqui o token de autenticação se necessário
    // const token = await SecureStore.getItemAsync('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Erro na API:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);



// Função para buscar pedidos
export const fetchPedidos = async (): Promise<any[]> => {
  try {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.PEDIDOS);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
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
export const testDatabaseConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.HEALTH_CHECK);
    return {
      success: true,
      message: 'Conexão com a base de dados estabelecida com sucesso'
    };
  } catch (error) {
    console.error('Erro ao testar conexão com a base de dados:', error);
    return {
      success: false,
      message: 'Falha na conexão com a base de dados'
    };
  }
};

export default apiClient;