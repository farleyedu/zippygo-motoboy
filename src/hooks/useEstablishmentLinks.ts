import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { EstablishmentLink, listAvailableEstablishments, listMotoboyLinkRequests, MotoboyAvailableEstablishment, MotoboyLinkRequest } from '../../services/mobileApi';

export function useEstablishmentLinks(scope = '') {
  const auth = useAuth();
  const router = useRouter();
  const authRef = useRef(auth); authRef.current = auth;
  const generation = useRef(0);
  const focused = useRef(false);
  const locked = useRef(false);
  const [links, setLinks] = useState<EstablishmentLink[]>([]);
  const [stores, setStores] = useState<MotoboyAvailableEstablishment[]>([]);
  const [requests, setRequests] = useState<MotoboyLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!focused.current || !authRef.current.user || locked.current) return;
    const ticket = ++generation.current;
    setLoading(true); setError('');
    try {
      const [available, mine, active] = await Promise.all([listAvailableEstablishments(), listMotoboyLinkRequests(), authRef.current.refreshEstabelecimentos()]);
      if (ticket !== generation.current || !focused.current) return;
      setStores(available.filter(store => (store.modulosAtivos ?? []).some(module => module.toUpperCase() === 'DELIVERY')));
      setRequests([...mine].sort((a, b) => (Date.parse(b.requestedAtUtc) || 0) - (Date.parse(a.requestedAtUtc) || 0)));
      setLinks(active);
    } catch (caught: unknown) {
      if (ticket === generation.current && focused.current) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os vínculos.');
    } finally {
      if (ticket === generation.current && focused.current) setLoading(false);
    }
  }, []);

  // Recarrega ao voltar às telas; respostas de uma tela anterior não substituem a atual.
  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (!authRef.current.user) {
      if (!authRef.current.isLoading) router.replace('/(auth)/login');
    } else void reload();
    return () => { focused.current = false; generation.current += 1; };
  }, [auth.user?.id, router, reload, scope]));
  useEffect(() => { if (focused.current && !auth.isLoading && !auth.user) router.replace('/(auth)/login'); }, [auth.isLoading, auth.user, router]);

  const act = async (operation: () => Promise<void>, onSuccess?: () => void) => {
    if (locked.current || loading || !focused.current || !authRef.current.user) return;
    locked.current = true; setBusy(true); setError('');
    const ticket = generation.current;
    try {
      await operation();
      if (ticket === generation.current && focused.current) onSuccess?.();
    } catch (caught: unknown) {
      if (ticket === generation.current && focused.current) setError(caught instanceof Error ? caught.message : 'Não foi possível concluir. Atualize e tente novamente.');
    } finally {
      locked.current = false;
      if (focused.current) {
        setBusy(false);
        if (ticket !== generation.current) void reload();
      }
    }
  };
  return { ...auth, links, stores, requests, loading, busy, error, reload, act };
}
