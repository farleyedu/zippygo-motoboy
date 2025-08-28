import { motion } from 'framer-motion';
import React from 'react';

type Props = {
  amount: number;
  method: string;
};

export default function DeliveryReleasedCard({ amount, method }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col items-center text-center gap-4 w-full max-w-md"
    >
      <div className="bg-green-600 rounded-full p-3">
        <i className="fa-solid fa-check text-white" />
      </div>
      <div className="text-green-700 font-semibold text-lg">Entrega Liberada! ✨</div>
      <div className="text-gray-700 text-sm">
        Código validado e pagamento registrado com sucesso.
      </div>
      <div className="bg-white border border-green-200 rounded-lg px-4 py-2">
        <div className="text-black font-medium">R$ {amount.toFixed(2)}</div>
        <div className="text-gray-500 text-sm">{method}</div>
      </div>
    </motion.div>
  );
}
