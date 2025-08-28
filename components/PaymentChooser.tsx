import { motion } from 'framer-motion';
import React, { useRef, useState } from 'react';

type Method = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito';

type Props = {
  amount: number;
  method: Method | null;
  onChange(method: Method): void;
  onCharge(): void;
};

export default function PaymentChooser({ amount, method, onChange, onCharge }: Props) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    if (!method) return;
    const start = Date.now();
    timer.current = setInterval(() => {
      const pct = Math.min((Date.now() - start) / 800, 1);
      setProgress(pct);
      if (pct === 1) {
        clearInterval(timer.current!);
        onCharge();
        setTimeout(() => setProgress(0), 300);
      }
    }, 16);
  };

  const cancelHold = () => {
    if (timer.current) clearInterval(timer.current);
    setProgress(0);
  };

  const btnClass = (m: Method) =>
    `px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
      method === m
        ? 'border-green-500 bg-green-50 text-green-700'
        : 'border-gray-300 text-gray-700'
    }`;

  return (
    <div className="w-full max-w-md">
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button className={btnClass('Dinheiro')} onClick={() => onChange('Dinheiro')}>Dinheiro</button>
        <button className={btnClass('PIX')} onClick={() => onChange('PIX')}>PIX</button>
        <button className={btnClass('Débito')} onClick={() => onChange('Débito')}>Débito</button>
        <button className={btnClass('Crédito')} onClick={() => onChange('Crédito')}>Crédito</button>
      </div>
      <div className="relative">
        <button
          disabled={!method}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          className={`w-full py-3 rounded-lg font-medium transition-transform active:scale-95 ${
            method
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Cobrar R$ {amount.toFixed(2)}
        </button>
        <motion.div
          className="absolute left-0 bottom-0 h-1 bg-green-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
