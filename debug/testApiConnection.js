// Script para testar conectividade com a API
import { API_CONFIG } from '../config/apiConfig';

console.log('🔍 === TESTE DE CONECTIVIDADE API ===');
console.log('📡 URL Base:', API_CONFIG.BASE_URL);
console.log('🔒 Protocolo:', API_CONFIG.BASE_URL.startsWith('https') ? 'HTTPS ✅' : 'HTTP ❌');

// Função para testar conectividade
export const testApiConnection = async () => {
  try {
    console.log('🌐 Testando conectividade com:', API_CONFIG.BASE_URL);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    
    console.log('✅ Status da resposta:', response.status);
    console.log('✅ Headers:', response.headers);
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ Resposta da API:', data);
      return { success: true, data };
    } else {
      console.error('❌ Erro na resposta:', response.status, response.statusText);
      return { success: false, error: `${response.status} ${response.statusText}` };
    }
  } catch (error) {
    console.error('❌ Erro de conectividade:', error);
    console.error('❌ Tipo do erro:', error.name);
    console.error('❌ Mensagem:', error.message);
    
    if (error.message.includes('CLEARTEXT')) {
      console.error('🚨 ERRO CLEARTEXT DETECTADO!');
      console.error('🚨 Verifique se a URL está usando HTTPS');
    }
    
    return { success: false, error: error.message };
  }
};

// Testar automaticamente quando importado
testApiConnection().then(result => {
  console.log('🔍 Resultado do teste:', result);
}).catch(error => {
  console.error('🔍 Erro no teste:', error);
});