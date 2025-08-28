import { motion } from 'framer-motion';
import React from 'react';

type Props = {
  amount: number;
  method: string;
  onEdit(): void;
};

export default function PaymentConfirmedRow({ amount, method, onEdit }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between w-full max-w-md"
    >
      <div className="flex items-center gap-3">
        <div className="bg-green-500 rounded-full p-1 flex items-center justify-center">
          <i className="fa-solid fa-check text-white text-xs" />
        </div>
        <div>
          <div className="text-green-700 font-semibold text-base">Pagamento Confirmado</div>
          <div className="text-black text-sm">R$ {amount.toFixed(2)} — {method}</div>
        </div>
      </div>
      <button
        onClick={onEdit}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Editar"
      >
        <i className="fa-solid fa-pen" />
      </button>
    </motion.div>
  );
}
