import { Platform } from 'react-native';

/**
 * 🔍 DEBUG: Interceptação de requisições de rede
 * 
 * Este módulo intercepta todas as chamadas de rede (fetch, XMLHttpRequest)
 * para detectar comunicações HTTP não seguras (CLEARTEXT)
 * 
 * ⚠️ IMPORTANTE: Este arquivo deve ser removido em produção!
 */

// Verificar se estamos em ambiente web
const isWeb = Platform.OS === 'web';

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
const isDev = APP_ENV === 'dev' || APP_ENV === 'development';

if (isDev) {
  console.log('🔧 [NETWORK DEBUG] Iniciando interceptação de rede...');
  console.log('📱 [PLATFORM]:', Platform.OS);
  console.log('🌍 [ENV]:', process.env.NODE_ENV);
  console.log('🔒 [CLEARTEXT]:', process.env.EXPO_PUBLIC_USE_CLEARTEXT_TRAFFIC);
  
  if (isWeb) {
    console.log('🌐 [WEB] Modo web detectado - interceptação limitada');
  }
  
  // Salvar referência original do fetch
  const originalFetch = global.fetch;
  
  // Patch do fetch global
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    
    // Log da requisição
    console.log(`🌐 [FETCH][REQ] ${method} ${url}`);
    
    // Verificar se é HTTP não seguro
    if (typeof url === 'string' && url.startsWith('http://')) {
      console.warn(`⚠️ [CLEARTEXT] Detectada chamada HTTP não segura: ${url}`);
      console.warn('📍 [STACK TRACE]:', new Error().stack);
    }
    
    try {
      const startTime = Date.now();
      const response = await originalFetch(input, init);
      const duration = Date.now() - startTime;
      
      // Log da resposta
      console.log(`✅ [FETCH][RES] ${method} ${url} - ${response.status} (${duration}ms)`);
      
      return response;
    } catch (error) {
      console.error(`❌ [FETCH][ERR] ${method} ${url}:`, error);
      throw error;
    }
  };
  
  // Patch do XMLHttpRequest (usado por algumas libs) - apenas em plataformas nativas
   if (!isWeb && typeof XMLHttpRequest !== 'undefined') {
     const originalXHROpen = XMLHttpRequest.prototype.open;
     XMLHttpRequest.prototype.open = function(method: string, url: string, ...args: any[]) {
       const urlString = url;
       
       console.log(`🌐 [XHR][REQ] ${method} ${urlString}`);
       
       // Verificar se é HTTP não seguro
       if (urlString.startsWith('http://')) {
         console.warn(`⚠️ [CLEARTEXT] Detectada chamada XHR HTTP não segura: ${urlString}`);
         console.warn('📍 [STACK TRACE]:', new Error().stack);
       }
       
       return originalXHROpen.call(this, method, url, ...args);
     };
   } else if (isWeb) {
     console.log('🌐 [WEB] XMLHttpRequest patch desabilitado para web');
   } else {
     console.log('🔧 [NETWORK DEBUG] XMLHttpRequest não disponível');
   }
  
  console.log('✅ [NETWORK DEBUG] Interceptação de rede ativada!');
} else {
  console.log('🔧 [NETWORK DEBUG] Modo produção - interceptação desabilitada');
}

// Função para testar conectividade da API
export const testApiHealth = async (): Promise<void> => {
  try {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://zippy-api.onrender.com';
    const healthUrl = `${API_BASE_URL}/api/Motoboy`;
    
    console.log('🏥 [HEALTHZ] Testando conectividade da API...');
    console.log('🏥 [HEALTHZ] URL:', healthUrl);
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ZippyMotoboy-HealthCheck/1.0.0'
      }
    });
    
    if (response.ok) {
      console.log(`✅ [HEALTHZ] API respondeu com status ${response.status}`);
      console.log('✅ [HEALTHZ] Conectividade OK!');
    } else {
      console.warn(`⚠️ [HEALTHZ] API respondeu com status ${response.status}`);
    }
  } catch (error) {
    console.error('❌ [HEALTHZ] Erro ao testar API:', error);
  }
};

// Auto-executar teste de saúde em desenvolvimento
if (isDev) {
  // Aguardar um pouco para o app inicializar
  setTimeout(() => {
    testApiHealth();
  }, 2000);
}

export default {
  testApiHealth
};