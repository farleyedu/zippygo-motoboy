import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// URL fictícia para o backend (será substituída quando o backend estiver pronto)
const BASE_URL = 'http://localhost:5000';

// Criar instância do axios
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autorização
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('zippygo.token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Erro ao recuperar token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Se receber 401 (Unauthorized), limpar sessão
    if (error.response?.status === 401) {
      try {
        await SecureStore.deleteItemAsync('zippygo.token');
        await SecureStore.deleteItemAsync('zippygo.user');
        // Aqui você pode adicionar lógica para redirecionar para login
        // Por exemplo, usando um event emitter ou context
      } catch (clearError) {
        console.log('Erro ao limpar sessão:', clearError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;