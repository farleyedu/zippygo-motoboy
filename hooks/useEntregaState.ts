import { useEffect, useState } from 'react';

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
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('entregaState');
    if (stored) {
      try {
        setState(JSON.parse(stored));
      } catch {
        localStorage.removeItem('entregaState');
      }
    }
  }, []);

  const update = (partial: Partial<EntregaState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== 'undefined') {
        localStorage.setItem('entregaState', JSON.stringify(next));
      }
      return next;
    });
  };

  return { state, update } as const;
}
