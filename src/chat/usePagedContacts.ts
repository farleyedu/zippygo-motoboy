import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatContactPage, listChatContacts } from '../../services/communicationApi';

type Snapshot = ChatContactPage & { at: number };
const snapshots = new Map<string, Snapshot>();
const empty: Snapshot = { contacts: [], hasMore: false, at: 0 };

export function usePagedContacts(scope: string | null, search: string, active = true) {
  const key = `${scope}:${search.trim()}`;
  const current = useRef({ key, active }); current.current = { key, active };
  const [page, setPage] = useState(() => snapshots.get(key) ?? empty);
  const [ready, setReady] = useState(() => snapshots.has(key));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async (more: boolean) => {
    if (!scope || !current.current.active || current.current.key !== key || pending.current) return;
    const saved = snapshots.get(key);
    if (more ? !saved?.hasMore : saved && Date.now() - saved.at < 60000) return;
    const controller = new AbortController(); pending.current = controller;
    if (more) setLoadingMore(true);
    try {
      const result = await listChatContacts({ cursor: more ? saved?.cursor : undefined, search: search.trim(), signal: controller.signal });
      if (controller.signal.aborted || current.current.key !== key) return;
      // Atualizar a primeira página preserva colegas e posição já carregados.
      const contacts = Array.from(new Map([...(saved?.contacts ?? []), ...result.contacts].map(c => [c.motoboyId, c])).values());
      const snapshot: Snapshot = { ...result, contacts, at: Date.now(),
        ...(!more && saved && saved.contacts.length > 15 ? { cursor: saved.cursor, hasMore: saved.hasMore } : {}) };
      if (snapshots.size >= 40) snapshots.delete(snapshots.keys().next().value as string);
      snapshots.set(key, snapshot); setPage(snapshot); setReady(true); setError('');
    } catch (e) {
      if (!controller.signal.aborted && current.current.key === key) setError(e instanceof Error ? e.message : 'Não foi possível carregar os contatos.');
    } finally {
      if (pending.current === controller) { pending.current = null; setLoadingMore(false); }
    }
  }, [scope, key, search]);
  useEffect(() => {
    setPage(snapshots.get(key) ?? empty); setReady(snapshots.has(key)); setError(''); setLoadingMore(false);
    if (!active) return;
    const timer = setTimeout(() => void load(false), search.trim() ? 250 : 0);
    return () => { clearTimeout(timer); pending.current?.abort(); pending.current = null; };
  }, [key, active, load]);
  return { contacts: page.contacts, hasMore: page.hasMore, totalContacts: page.totalContacts, onlineContacts: page.onlineContacts, ready, loadingMore, error,
    refresh: useCallback(() => load(false), [load]), loadMore: useCallback(() => load(true), [load]) };
}
