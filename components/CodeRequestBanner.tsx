import { motion } from 'framer-motion';
import React from 'react';

type Props = {
  onRequest(): void;
  sameSizeAs?: React.ReactNode;
};

export default function CodeRequestBanner({ onRequest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between bg-yellow-50 border border-yellow-400 rounded-xl px-4 py-2.5 w-full max-w-md"
    >
      <div className="flex items-center gap-2.5">
        <i className="fa-solid fa-key text-red-500 text-lg" />
        <span className="text-gray-800 font-medium text-sm">Código de entrega</span>
      </div>
      <button
        onClick={onRequest}
        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
      >
        Solicitar
      </button>
    </motion.div>
  );
}
