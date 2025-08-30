// Exemplo de configurações para diferentes ambientes

// 🏠 DESENVOLVIMENTO LOCAL
export const LOCAL_CONFIG = {
  BASE_URL: 'http://localhost:5000/api', // ou sua porta local
  TIMEOUT: 10000,
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// 🚂 RAILWAY PRODUCTION
export const RAILWAY_CONFIG = {
  BASE_URL: 'https://seu-projeto.railway.app/api', // Substitua pela URL real
  TIMEOUT: 15000, // Maior timeout para produção
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// 🧪 TESTE COM API MOCK
export const MOCK_CONFIG = {
  BASE_URL: 'https://jsonplaceholder.typicode.com',
  TIMEOUT: 5000,
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  ENDPOINTS: {
    HEALTH_CHECK: '/posts/1', // Simula um health check
    PEDIDOS: '/posts',
    // ...
  },
};

// 📝 INSTRUÇÕES DE USO:
// 
// 1. Copie uma das configurações acima
// 2. Cole no arquivo apiConfig.ts
// 3. Ajuste a URL conforme necessário
// 4. Reinicie o Expo: npx expo start --clear
//
// Para Railway:
// - Faça deploy da sua API .NET Core
// - Copie a URL fornecida pelo Railway
// - Use RAILWAY_CONFIG como base
//
// Para teste local:
// - Certifique-se que sua API está rodando
// - Use LOCAL_CONFIG como base
//
// Para teste rápido:
// - Use MOCK_CONFIG para testar a conectividade