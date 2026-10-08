import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getOwnAccount, OwnAccount } from '../../services/accountApi';
import { useAuth } from '../contexts/AuthContext';

export function useOwnAccount() {
  const { user } = useAuth();
  const [account, setAccount] = useState<OwnAccount | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    if (!user) { setAccount(null); setLoading(false); return; }
    setLoading(true); setError('');
    try { const data = await getOwnAccount(controller.signal); if (!controller.signal.aborted) setAccount(data); }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Seu cadastro não carregou. Tente novamente.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { setAccount(null); void reload(); return () => request.current?.abort(); }, [reload]));
  return { account, setAccount, loading, error, reload };
}
