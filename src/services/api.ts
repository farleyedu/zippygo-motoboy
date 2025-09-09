// ARQUIVO DESABILITADO - CAUSAVA CONFLITO COM CLEARTEXT HTTP
// Este arquivo estava tentando conectar via HTTP em localhost:5000
// O que causava o erro "CLEARTEXT communication not permitted"
// A configuração correta está em config/apiConfig.ts usando HTTPS

/*
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Configuração da API
const BASE_URL = 'http://localhost:5000';

// Criar instância do axios
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
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
*/

// ARQUIVO COMPLETAMENTE DESABILITADO
// Use services/apiService.ts que está configurado corretamente

/*
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
*/