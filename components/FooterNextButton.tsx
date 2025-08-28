import { motion } from 'framer-motion';
import React from 'react';

type Props = {
  enabled: boolean;
  onNext(): void;
};

export default function FooterNextButton({ enabled, onNext }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white">
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={onNext}
        disabled={!enabled}
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          enabled
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        Próxima entrega
      </motion.button>
    </div>
  );
}
