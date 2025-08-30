// Utilitário para armazenamento seguro compatível com web e mobile
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Fallback para web usando localStorage
const webSecureStore = {
  async setItemAsync(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },

  async getItemAsync(key: string): Promise<string | null> {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
};

// Exportar a implementação correta baseada na plataforma
export const secureStorage = Platform.OS === 'web' ? webSecureStore : SecureStore;

// Funções de conveniência
export const setSecureItem = async (key: string, value: string): Promise<void> => {
  try {
    await secureStorage.setItemAsync(key, value);
  } catch (error) {
    console.warn('Erro ao salvar item seguro:', error);
  }
};

export const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    return await secureStorage.getItemAsync(key);
  } catch (error) {
    console.warn('Erro ao recuperar item seguro:', error);
    return null;
  }
};

export const deleteSecureItem = async (key: string): Promise<void> => {
  try {
    await secureStorage.deleteItemAsync(key);
  } catch (error) {
    console.warn('Erro ao deletar item seguro:', error);
  }
};