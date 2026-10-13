import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import { getOwnAccount, OwnAccount } from '../../services/accountApi';
import { useAuth } from '../contexts/AuthContext';
import { peekResource, putResource } from './resourceCache';

export function useOwnAccount() {
  const { user } = useAuth();
  const accountKey = 'account:' + user?.id;
  const [account, setAccount] = useState<OwnAccount | null>(() => peekResource<OwnAccount>(accountKey) ?? null), [loading, setLoading] = useState(!account), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    if (!user) { setAccount(null); setLoading(false); return; }
    setLoading(!peekResource(accountKey)); setError('');
    try { const data = await getOwnAccount(controller.signal); if (!controller.signal.aborted) { const same = JSON.stringify(peekResource(accountKey)) === JSON.stringify(data); putResource(accountKey, data); if (!same) setAccount(data); } }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Seu cadastro não carregou. Tente novamente.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { void reload(); return () => request.current?.abort(); }, [reload]));
  return { account, setAccount, loading, error, reload };
}
