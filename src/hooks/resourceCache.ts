// Cache em memória para "mostrar o último dado e atualizar em segundo plano".
// As chaves já carregam usuário e loja; sair da conta limpa tudo.
const store = new Map<string, unknown>();
export const peekResource = <T,>(key: string) => store.get(key) as T | undefined;
export function putResource(key: string, value: unknown) {
  if (store.size >= 120) store.delete(store.keys().next().value as string);
  store.delete(key); store.set(key, value);
}
export const clearResources = () => store.clear();
