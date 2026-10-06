import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '../../config/apiConfig';
import { pararMonitoramentoLocalizacao } from '../../components/locationSetup';
import { clearTrackingMode } from '../../services/trackingService';
import {
  clearOperationalSession,
  endOperationalSession,
  EstablishmentLink,
  listEstablishments,
  selectEstablishment as selectEstablishmentApi,
  SelectedEstablishment,
} from '../../services/mobileApi';

export interface User {
  id: string;
  nome: string;
  email: string;
  role: 'pizzaria' | 'motoboy';
  telefone?: string;
}

interface AuthContextData {
  user: User | null;
  accessToken: string | null;
  estabelecimentos: EstablishmentLink[];
  estabelecimentoAtual: SelectedEstablishment | EstablishmentLink | null;
  needsEstablishmentSelection: boolean;
  isLoading: boolean;
  signIn: (email: string, senha: string) => Promise<{ success: boolean; error?: string; requiresEstablishmentSelection?: boolean }>;
  selectEstablishment: (estabelecimento: EstablishmentLink) => Promise<{ success: boolean; error?: string }>;
  refreshEstabelecimentos: () => Promise<EstablishmentLink[]>;
  signOut: () => Promise<void>;
  loadUserFromStorage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

interface AuthProviderProps {
  children: ReactNode;
}

const ACTIVE_ESTABLISHMENT_KEY = 'zippygo.estabelecimentoAtual';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [estabelecimentos, setEstabelecimentos] = useState<EstablishmentLink[]>([]);
  const [estabelecimentoAtual, setEstabelecimentoAtual] = useState<SelectedEstablishment | EstablishmentLink | null>(null);
  const [needsEstablishmentSelection, setNeedsEstablishmentSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      setIsLoading(true);
      const storedUser = await SecureStore.getItemAsync('zippygo.user');
      const storedToken = await SecureStore.getItemAsync('authToken');
      const storedEstablishment = await SecureStore.getItemAsync(ACTIVE_ESTABLISHMENT_KEY);

      if (!storedUser || !storedToken) return;

      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      setAccessToken(storedToken);

      const links = await refreshEstabelecimentos();
      const persisted = storedEstablishment ? JSON.parse(storedEstablishment) : null;
      const current = persisted && links.some((item) => item.estabelecimentoId === persisted.id || item.estabelecimentoId === persisted.estabelecimentoId)
        ? persisted
        : null;

      if (current) {
        setEstabelecimentoAtual(current);
        setNeedsEstablishmentSelection(false);
      } else if (links.length === 1) {
        await selectEstablishment(links[0]);
      } else {
        setNeedsEstablishmentSelection(true);
      }
    } catch (error) {
      console.log('Erro ao carregar usuario:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshEstabelecimentos = async (): Promise<EstablishmentLink[]> => {
    const links = await listEstablishments();
    const motoboyLinks = links.filter((item) => {
      const access = String(item.tipoAcesso ?? '').toLowerCase();
      const vinculo = String(item.statusVinculo ?? '').toLowerCase();
      const estabelecimento = String(item.statusEstabelecimento ?? '').toLowerCase();
      const activeLink = !vinculo || ['ativo', 'active', 'super_admin'].includes(vinculo);
      const activeEstablishment = !estabelecimento || ['ativo', 'active'].includes(estabelecimento);
      return access === 'motoboy' && activeLink && activeEstablishment;
    });
    setEstabelecimentos(motoboyLinks);
    return motoboyLinks;
  };

  const signIn = async (email: string, senha: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
        method: 'POST',
        headers: API_CONFIG.DEFAULT_HEADERS,
        body: JSON.stringify({ email, senha }),
      });
      const body = await response.json();
      if (!response.ok || !body?.success || !body?.data?.accessToken) {
        return { success: false, error: body?.error || 'Email ou senha invalidos' };
      }

      const tokenData = body.data;
      const apiUser = tokenData.user ?? {};
      const userData: User = {
        id: String(apiUser.id ?? ''),
        nome: apiUser.nome ?? email,
        email: apiUser.email ?? email,
        role: 'motoboy',
        telefone: apiUser.telefone,
      };

      await SecureStore.setItemAsync('zippygo.user', JSON.stringify(userData));
      await SecureStore.setItemAsync('zippygo.token', tokenData.accessToken);
      await SecureStore.setItemAsync('authToken', tokenData.accessToken);
      if (tokenData.refreshToken) await SecureStore.setItemAsync('refreshToken', tokenData.refreshToken);

      setUser(userData);
      setAccessToken(tokenData.accessToken);
      await SecureStore.deleteItemAsync(ACTIVE_ESTABLISHMENT_KEY);
      setEstabelecimentoAtual(null);

      const links = await refreshEstabelecimentos();
      if (links.length === 0) {
        setNeedsEstablishmentSelection(true);
        return { success: true, requiresEstablishmentSelection: true };
      }
      if (links.length === 1) {
        const selected = await selectEstablishment(links[0]);
        if (!selected.success) return selected;
        return { success: true, requiresEstablishmentSelection: false };
      }

      setNeedsEstablishmentSelection(true);
      return { success: true, requiresEstablishmentSelection: true };
    } catch (error) {
      console.log('Erro no login:', error);
      return { success: false, error: 'Não foi possível carregar os restaurantes vinculados.' };
    } finally {
      setIsLoading(false);
    }
  };

  const selectEstablishment = async (estabelecimento: EstablishmentLink) => {
    try {
      setIsLoading(true);
      const selected = await selectEstablishmentApi(estabelecimento.estabelecimentoId);
      await SecureStore.setItemAsync('authToken', selected.accessToken);
      await SecureStore.setItemAsync('zippygo.token', selected.accessToken);
      if (selected.refreshToken) await SecureStore.setItemAsync('refreshToken', selected.refreshToken);

      const current = selected.estabelecimentoSelecionado ?? {
        id: estabelecimento.estabelecimentoId,
        nome: estabelecimento.nome,
        tipoEstabelecimento: estabelecimento.tipoEstabelecimento,
      };
      await SecureStore.setItemAsync(ACTIVE_ESTABLISHMENT_KEY, JSON.stringify(current));
      setAccessToken(selected.accessToken);
      setEstabelecimentoAtual(current);
      setNeedsEstablishmentSelection(false);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message ?? 'Não foi possível selecionar o restaurante.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      try {
        await endOperationalSession('logout');
      } catch {
        await clearOperationalSession();
      }
      await pararMonitoramentoLocalizacao();
      await clearTrackingMode();
      await SecureStore.deleteItemAsync('zippygo.user');
      await SecureStore.deleteItemAsync('zippygo.token');
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync(ACTIVE_ESTABLISHMENT_KEY);
      setUser(null);
      setAccessToken(null);
      setEstabelecimentos([]);
      setEstabelecimentoAtual(null);
      setNeedsEstablishmentSelection(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      estabelecimentos,
      estabelecimentoAtual,
      needsEstablishmentSelection,
      isLoading,
      signIn,
      selectEstablishment,
      refreshEstabelecimentos,
      signOut,
      loadUserFromStorage,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
}

export default AuthContext;
