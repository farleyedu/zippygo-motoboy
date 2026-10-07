import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../../utils/secureStorage';
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
  needsLinkRequest: boolean;
  isLoading: boolean;
  signIn: (email: string, senha: string) => Promise<{ success: boolean; error?: string; requiresEstablishmentSelection?: boolean; requiresLinkRequest?: boolean }>;
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
  const authEpoch = useRef(0);
  const selecting = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [estabelecimentos, setEstabelecimentos] = useState<EstablishmentLink[]>([]);
  const [estabelecimentoAtual, setEstabelecimentoAtual] = useState<SelectedEstablishment | EstablishmentLink | null>(null);
  const [needsEstablishmentSelection, setNeedsEstablishmentSelection] = useState(false);
  const [needsLinkRequest, setNeedsLinkRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    authEpoch.current += 1;
    try {
      setIsLoading(true);
      const storedUser = await getSecureItem('zippygo.user');
      const storedToken = await getSecureItem('authToken')
        ?? await getSecureItem('zippygo.token');
      const storedEstablishment = await getSecureItem(ACTIVE_ESTABLISHMENT_KEY);

      if (!storedUser || !storedToken) return;

      // Compatibilidade com versoes antigas que salvavam apenas zippygo.token.
      await setSecureItem('authToken', storedToken);

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
        setNeedsLinkRequest(false);
      } else if (links.length === 1) {
        await selectEstablishment(links[0]);
      } else if (links.length === 0) {
        setNeedsEstablishmentSelection(false);
        setNeedsLinkRequest(true);
      } else {
        setNeedsEstablishmentSelection(true);
        setNeedsLinkRequest(false);
      }
    } catch (error) {
      console.log('Erro ao carregar usuario:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshEstabelecimentos = async (): Promise<EstablishmentLink[]> => {
    const epoch = authEpoch.current;
    const links = await listEstablishments();
    if (epoch !== authEpoch.current) throw new Error('A sessão mudou. Atualize os vínculos.');
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
    authEpoch.current += 1;
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

      await setSecureItem('zippygo.user', JSON.stringify(userData));
      await setSecureItem('zippygo.token', tokenData.accessToken);
      await setSecureItem('authToken', tokenData.accessToken);
      if (tokenData.refreshToken) await setSecureItem('refreshToken', tokenData.refreshToken);

      setUser(userData);
      setAccessToken(tokenData.accessToken);
      await deleteSecureItem(ACTIVE_ESTABLISHMENT_KEY);
      setEstabelecimentoAtual(null);
      setNeedsLinkRequest(false);

      const links = await refreshEstabelecimentos();
      if (links.length === 0) {
        setNeedsEstablishmentSelection(false);
        setNeedsLinkRequest(true);
        return { success: true, requiresLinkRequest: true };
      }
      if (links.length === 1) {
        const selected = await selectEstablishment(links[0]);
        if (!selected.success) return selected;
        return { success: true, requiresEstablishmentSelection: false };
      }

      setNeedsEstablishmentSelection(true);
      setNeedsLinkRequest(false);
      return { success: true, requiresEstablishmentSelection: true };
    } catch (error) {
      console.log('Erro no login:', error);
      return { success: false, error: 'Não foi possível carregar os restaurantes vinculados.' };
    } finally {
      setIsLoading(false);
    }
  };

  const selectEstablishment = async (estabelecimento: EstablishmentLink) => {
    if (selecting.current) return { success: false, error: 'Aguarde a seleção em andamento.' };
    selecting.current = true;
    const epoch = authEpoch.current;
    try {
      setIsLoading(true);
      // Não substitui o contexto de um turno nem descarta seus dados para trocar loja.
      const stored = await getSecureItem(ACTIVE_ESTABLISHMENT_KEY);
      const currentStored = stored ? JSON.parse(stored) as SelectedEstablishment & Partial<EstablishmentLink> : null;
      const currentId = currentStored?.estabelecimentoId ?? currentStored?.id;
      if (currentId !== estabelecimento.estabelecimentoId) {
        const [token, session, tracking] = await Promise.all([
          getSecureItem('operationalAccessToken'), getSecureItem('operationalSession'), getSecureItem('trackingMode'),
        ]);
        if (token || session || tracking) return { success: false, error: 'Encerre ou recupere seu turno atual antes de trocar de estabelecimento.' };
      }
      if (epoch !== authEpoch.current) return { success: false, error: 'A sessão mudou. Entre novamente.' };
      const selected = await selectEstablishmentApi(estabelecimento.estabelecimentoId);
      if (epoch !== authEpoch.current) return { success: false, error: 'A sessão mudou. Entre novamente.' };
      if (!selected.accessToken || selected.estabelecimentoSelecionado?.id !== estabelecimento.estabelecimentoId) {
        return { success: false, error: 'A seleção não foi confirmada pelo servidor. Atualize os vínculos e tente novamente.' };
      }
      await setSecureItem('authToken', selected.accessToken);
      await setSecureItem('zippygo.token', selected.accessToken);
      if (selected.refreshToken) await setSecureItem('refreshToken', selected.refreshToken);

      const current = selected.estabelecimentoSelecionado ?? {
        id: estabelecimento.estabelecimentoId,
        nome: estabelecimento.nome,
        tipoEstabelecimento: estabelecimento.tipoEstabelecimento,
      };
      await setSecureItem(ACTIVE_ESTABLISHMENT_KEY, JSON.stringify(current));
      setAccessToken(selected.accessToken);
      setEstabelecimentoAtual(current);
      setNeedsEstablishmentSelection(false);
      setNeedsLinkRequest(false);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Não foi possível selecionar o restaurante.' };
    } finally {
      selecting.current = false;
      if (epoch === authEpoch.current) setIsLoading(false);
    }
  };

  const signOut = async () => {
    authEpoch.current += 1;
    try {
      setIsLoading(true);
      try {
        await endOperationalSession('logout');
      } catch {
        await clearOperationalSession();
      }
      await pararMonitoramentoLocalizacao();
      await clearTrackingMode();
      await deleteSecureItem('zippygo.user');
      await deleteSecureItem('zippygo.token');
      await deleteSecureItem('authToken');
      await deleteSecureItem('refreshToken');
      await deleteSecureItem(ACTIVE_ESTABLISHMENT_KEY);
      setUser(null);
      setAccessToken(null);
      setEstabelecimentos([]);
      setEstabelecimentoAtual(null);
      setNeedsEstablishmentSelection(false);
      setNeedsLinkRequest(false);
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
      needsLinkRequest,
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
