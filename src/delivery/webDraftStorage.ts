/**
 * Rascunhos de conclusão na Web. localStorage sobrevive ao fechamento da aba e do PWA; sessionStorage só
 * entra como reserva (navegação privada/cota) e para ler rascunhos gravados por versões anteriores.
 */
export type WebDraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type WebDraftStores = { durable: WebDraftStore | null; session: WebDraftStore | null };

function access(read: () => Storage): WebDraftStore | null {
  try { const store = read(); store.getItem('__zippygo_probe__'); return store; }
  catch { return null; }
}
export function browserDraftStores(): WebDraftStores {
  return { durable: access(() => window.localStorage), session: access(() => window.sessionStorage) };
}

export function readWebDraft(key: string, stores: WebDraftStores = browserDraftStores()): string | null {
  return stores.durable?.getItem(key) ?? stores.session?.getItem(key) ?? null;
}

export function writeWebDraft(key: string, json: string, stores: WebDraftStores = browserDraftStores()): void {
  let saved = false;
  try { stores.durable?.setItem(key, json); saved = !!stores.durable; } catch { /* cota ou modo privado: tenta a reserva */ }
  if (saved) { try { stores.session?.removeItem(key); } catch { /* cópia antiga inofensiva: o durável tem prioridade na leitura */ } return; }
  if (!stores.session) throw new Error('Este navegador não permite guardar a conferência. Não feche a página até concluir a entrega.');
  stores.session.setItem(key, json);
}

export function deleteWebDraft(key: string, stores: WebDraftStores = browserDraftStores()): void {
  for (const store of [stores.durable, stores.session]) { try { store?.removeItem(key); } catch { /* ignora */ } }
}
