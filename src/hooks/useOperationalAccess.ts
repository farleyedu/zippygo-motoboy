import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useAuth } from '../contexts/AuthContext';

export function useOperationalAccess() {
  const auth = useAuth(), router = useRouter(), focused = useIsFocused();
  useEffect(() => {
    if (!focused || auth.isLoading) return;
    if (!auth.user) router.replace('/(auth)/login');
    else if (auth.needsLinkRequest) router.replace('/solicitarRestaurante');
    else if (!auth.estabelecimentoAtual) router.replace('/selecionarRestaurante');
  }, [focused, auth.isLoading, auth.user?.id, auth.needsLinkRequest, auth.estabelecimentoAtual, router]);
  return !auth.isLoading && !!auth.user && !!auth.estabelecimentoAtual;
}
