import { useEffect, useState } from 'react';
import { getSecureItem, setSecureItem } from '../utils/secureStorage';

export type EntregaState = {
  codeStatus: 'pending' | 'validated';
  paymentStatus: 'pending' | 'confirmed';
  paymentMethod: 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito' | null;
  amount: number;
};

const defaultState: EntregaState = {
  codeStatus: 'pending',
  paymentStatus: 'pending',
  paymentMethod: null,
  amount: 20,
};

export default function useEntregaState() {
  const [state, setState] = useState<EntregaState>(defaultState);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSecureItem('entregaState');
        if (stored) {
          setState(JSON.parse(stored));
        }
      } catch {
        // ignora erros de leitura
      }
    })();
  }, []);

  const update = (partial: Partial<EntregaState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      // persistência assíncrona (fire-and-forget)
      setSecureItem('entregaState', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return { state, update } as const;
}
