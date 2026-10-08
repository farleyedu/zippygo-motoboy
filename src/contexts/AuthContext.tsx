import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../../utils/secureStorage';
import { API_CONFIG } from '../../config/apiConfig';
import { requestOperationalLogout } from '../../services/sessionEvents';
import {
  EstablishmentLink,
  listMotoboyLinks,
  MobileApiError,
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
  restoreError: string | null;
  didSignOut: boolean;
  signIn: (email: string, senha: string, remember?: boolean) => Promise<{ success: boolean; error?: string; requiresEstablishmentSelection?: boolean; requiresLinkRequest?: boolean }>;
  updateOwnIdentity: (data: { nome: string; email: string; telefone?: string }) => Promise<void>;
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
  const firstRestore = useRef(true);
  const restoreRequest = useRef<{ epoch: number; promise: Promise<void> } | null>(null);
  const selecting = useRef(false);
  const signingOut = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [estabelecimentos, setEstabelecimentos] = useState<EstablishmentLink[]>([]);
  const [estabelecimentoAtual, setEstabelecimentoAtual] = useState<SelectedEstablishment | EstablishmentLink | null>(null);
  const [needsEstablishmentSelection, setNeedsEstablishmentSelection] = useState(false);
  const [needsLinkRequest, setNeedsLinkRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [didSignOut, setDidSignOut] = useState(false);

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const clearIdentityState = (signedOut: boolean) => {
    setUser(null);
    setAccessToken(null);
    setEstabelecimentos([]);
    setEstabelecimentoAtual(null);
    setNeedsEstablishmentSelection(false);
    setNeedsLinkRequest(false);
    setRestoreError(null);
    setDidSignOut(signedOut);
  };

  const loadUserFromStorage = (): Promise<void> => {
    if (restoreRequest.current?.epoch === authEpoch.current) return restoreRequest.current.promise;
    const epoch = ++authEpoch.current;
    const isFirstRestore = firstRestore.current; firstRestore.current = false;
    const pending = (async () => {
    try {
      setIsLoading(true);
      setRestoreError(null);
      const storedUser = await getSecureItem('zippygo.user');
      const storedToken = await getSecureItem('authToken')
        ?? await getSecureItem('zippygo.token');
      const storedEstablishment = await getSecureItem(ACTIVE_ESTABLISHMENT_KEY);
      if (epoch !== authEpoch.current) return;

      const remember = isFirstRestore ? await getSecureItem('zippygo.rememberLogin') : null;
      if (epoch !== authEpoch.current) return;
      if (isFirstRestore && remember === 'false') {
        await Promise.all(['authToken', 'zippygo.token', 'refreshToken'].map(deleteSecureItem));
        clearIdentityState(true); return;
      }

      if (!storedUser || !storedToken) {
        clearIdentityState(!!storedUser);
        return;
      }

      // Compatibilidade com versoes antigas que salvavam apenas zippygo.token.
      await setSecureItem('authToken', storedToken);

      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      setAccessToken(storedToken);

      const links = await refreshEstabelecimentos();
      if (epoch !== authEpoch.current) return;
      const effectiveToken = await getSecureItem('authToken');
      if (epoch !== authEpoch.current) return;
      setAccessToken(effectiveToken ?? storedToken);
      const persisted = storedEstablishment ? JSON.parse(storedEstablishment) : null;
      const current = persisted && links.some((item) => item.estabelecimentoId === persisted.id || item.estabelecimentoId === persisted.estabelecimentoId)
        ? persisted
        : null;

      if (current) {
        setEstabelecimentoAtual(current);
        setNeedsEstablishmentSelection(false);
        setNeedsLinkRequest(false);
      } else if (links.length === 1) {
        const selected = await selectEstablishment(links[0]);
        if (!selected.success) throw new Error(selected.error);
      } else if (links.length === 0) {
        setNeedsEstablishmentSelection(false);
        setNeedsLinkRequest(true);
      } else {
        setNeedsEstablishmentSelection(true);
        setNeedsLinkRequest(false);
      }
    } catch (error) {
      if (epoch !== authEpoch.current) return;
      if (error instanceof MobileApiError && error.status === 401) {
        // A API já tentou renovar o acesso. Não encerrar pedidos nem apagar GPS
        // para solicitar novo login; conservar o contexto para o mesmo usuário.
        await Promise.all(['authToken', 'zippygo.token', 'refreshToken'].map(deleteSecureItem));
        if (epoch === authEpoch.current) clearIdentityState(true);
      } else {
        setRestoreError('Não foi possível conferir seu acesso e seus vínculos. Reconecte e tente novamente.');
      }
    } finally {
      if (epoch === authEpoch.current) setIsLoading(false);
    }
    })();
    restoreRequest.current = { epoch, promise: pending };
    const release = () => { if (restoreRequest.current?.promise === pending) restoreRequest.current = null; };
    void pending.then(release, release);
    return pending;
  };

  const refreshEstabelecimentos = async (): Promise<EstablishmentLink[]> => {
    const epoch = authEpoch.current;
    // O backend já devolve só vínculos de motoboy ativos em lojas ativas; não refiltrar aqui.
    const motoboyLinks = await listMotoboyLinks();
    if (epoch !== authEpoch.current) throw new Error('A sessão mudou. Atualize os vínculos.');
    setEstabelecimentos(motoboyLinks);
    return motoboyLinks;
  };

  const signIn = async (email: string, senha: string, remember = true) => {
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
      await setSecureItem('zippygo.rememberLogin', String(remember));

      const tokenData = body.data;
      const apiUser = tokenData.user ?? {};
      const userData: User = {
        id: String(apiUser.id ?? ''),
        nome: apiUser.nome ?? email,
        email: apiUser.email ?? email,
        role: 'motoboy',
        telefone: apiUser.telefone,
      };

      let previousUserId: string | null = null;
      try {
        const previous = await getSecureItem('zippygo.user');
        previousUserId = previous ? String(JSON.parse(previous).id) : null;
      } catch { /* Um perfil ilegível não pode restaurar a seleção anterior. */ }
      await setSecureItem('zippygo.user', JSON.stringify(userData));
      await setSecureItem('zippygo.token', tokenData.accessToken);
      await setSecureItem('authToken', tokenData.accessToken);
      if (tokenData.refreshToken) await setSecureItem('refreshToken', tokenData.refreshToken);
      else await deleteSecureItem('refreshToken');

      setUser(userData);
      setDidSignOut(false);
      setRestoreError(null);
      setAccessToken(tokenData.accessToken);
      // Novo login do mesmo usuário pode recuperar seu turno salvo. Apagar a
      // seleção aqui impediria a própria guarda de permitir essa recuperação.
      if (previousUserId !== userData.id) await deleteSecureItem(ACTIVE_ESTABLISHMENT_KEY);
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
        const [token, session, tracking, attempt] = await Promise.all([
          getSecureItem('operationalAccessToken'), getSecureItem('operationalSession'), getSecureItem('trackingMode'), getSecureItem('operationalStartAttempt'),
        ]);
        if (token || session || tracking || attempt) return { success: false, error: 'Encerre ou recupere seu turno atual antes de trocar de estabelecimento.' };
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
    if (signingOut.current) throw new Error('Aguarde a saída em andamento.');
    signingOut.current = true;
    try {
      // A guarda encerra o turno no servidor antes de apagar qualquer credencial.
      if (!(await requestOperationalLogout())) throw new Error('O turno ainda está sendo preparado. Tente sair novamente.');
      authEpoch.current += 1;
      setIsLoading(true);
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
      setRestoreError(null);
      setDidSignOut(true);
    } finally {
      signingOut.current = false;
      setIsLoading(false);
    }
  };

  const updateOwnIdentity = async (data: { nome: string; email: string; telefone?: string }) => {
    const epoch = authEpoch.current, raw = await getSecureItem('zippygo.user');
    const saved = raw ? JSON.parse(raw) as User : null;
    if (!user || String(saved?.id) !== String(user.id) || epoch !== authEpoch.current) throw new Error('O acesso mudou. Confira seu cadastro novamente.');
    const next = { ...user, nome: data.nome, email: data.email, telefone: data.telefone };
    await setSecureItem('zippygo.user', JSON.stringify(next));
    if (epoch === authEpoch.current) setUser(next);
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
      restoreError,
      didSignOut,
      signIn,
      updateOwnIdentity,
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
