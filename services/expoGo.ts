// Expo Go nao tem localizacao em segundo plano nem push remoto. Este sinal serve
// apenas para percorrer os fluxos em teste; builds do app nunca entram aqui.
// Le o modulo nativo direto do global (mesma checagem de isRunningInExpoGo do
// pacote expo) para continuar carregavel nos testes de dominio em Node.
type ExpoGlobal = { expo?: { modules?: Record<string, unknown> } };

export const expoGo = !!(globalThis as ExpoGlobal).expo?.modules?.ExpoGo;
