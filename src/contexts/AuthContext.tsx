import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { validateUser, MockUser } from '../mocks/users';

interface User {
  id: string;
  nome: string;
  email: string;
  role: 'pizzaria' | 'motoboy';
  telefone?: string;
}

interface AuthContextData {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  signIn: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  loadUserFromStorage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar usuário do storage ao inicializar
  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      setIsLoading(true);
      const storedUser = await SecureStore.getItemAsync('zippygo.user');
      const storedToken = await SecureStore.getItemAsync('zippygo.token');

      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setAccessToken(storedToken);
      }
    } catch (error) {
      console.log('Erro ao carregar usuário do storage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, senha: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);

      // Validar usuário com mock
      const mockUser = validateUser(email, senha);
      
      if (!mockUser) {
        return { success: false, error: 'Email ou senha inválidos' };
      }

      // Simular token JWT (em produção virá do backend)
      const mockToken = `mock-jwt-token-${mockUser.id}-${Date.now()}`;

      // Preparar dados do usuário (sem senha)
      const userData: User = {
        id: mockUser.id,
        nome: mockUser.nome,
        email: mockUser.email,
        role: mockUser.role,
        telefone: mockUser.telefone,
      };

      // Salvar no SecureStore
      await SecureStore.setItemAsync('zippygo.user', JSON.stringify(userData));
      await SecureStore.setItemAsync('zippygo.token', mockToken);

      // Atualizar estado
      setUser(userData);
      setAccessToken(mockToken);

      return { success: true };
    } catch (error) {
      console.log('Erro no login:', error);
      return { success: false, error: 'Erro interno. Tente novamente.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);

      // Limpar SecureStore
      await SecureStore.deleteItemAsync('zippygo.user');
      await SecureStore.deleteItemAsync('zippygo.token');

      // Limpar estado
      setUser(null);
      setAccessToken(null);
    } catch (error) {
      console.log('Erro no logout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        signIn,
        signOut,
        loadUserFromStorage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

export default AuthContext;