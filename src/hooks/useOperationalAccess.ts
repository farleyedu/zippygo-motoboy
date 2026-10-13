import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useAuth } from '../contexts/AuthContext';

export function useOperationalAccess() {
  const auth = useAuth(), router = useRouter(), focused = useIsFocused();
  useEffect(() => {
    if (!focused || auth.isLoading) return;
    if (!auth.user) router.replace('/(auth)/login');
    else if (!auth.estabelecimentos.length) router.replace('/');
    else if (!auth.estabelecimentoAtual) router.replace('/selecionarRestaurante');
  }, [focused, auth.isLoading, auth.user?.id, auth.estabelecimentos.length, auth.estabelecimentoAtual, router]);
  return !auth.isLoading && !!auth.user && !!auth.estabelecimentoAtual;
}
