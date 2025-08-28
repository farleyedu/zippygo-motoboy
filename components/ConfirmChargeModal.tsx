import { motion } from 'framer-motion';
import React from 'react';

type Props = {
  open: boolean;
  amount: number;
  method: string;
  onConfirm(): void;
  onCancel(): void;
};

export default function ConfirmChargeModal({ open, amount, method, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl p-6 w-80"
      >
        <h2 className="text-lg font-semibold mb-4">Tem certeza que deseja cobrar?</h2>
        <p className="text-sm text-gray-700 mb-6">
          R$ {amount.toFixed(2)} — {method}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white"
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
