"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import CodeRequestBanner from '../components/CodeRequestBanner';
import PaymentChooser from '../components/PaymentChooser';
import PaymentConfirmedRow from '../components/PaymentConfirmedRow';
import DeliveryReleasedCard from '../components/DeliveryReleasedCard';
import ConfirmChargeModal from '../components/ConfirmChargeModal';
import FooterNextButton from '../components/FooterNextButton';
import useEntregaState from '../hooks/useEntregaState';

export default function EntregaNovaScreen() {
  const router = useRouter();
  const { state, update } = useEntregaState();
  const { codeStatus, paymentStatus, paymentMethod, amount } = state;
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const flag = await SecureStore.getItemAsync('codigoValidado');
      if (flag === 'true') {
        update({ codeStatus: 'validated' });
        await SecureStore.deleteItemAsync('codigoValidado');
      }
    })();
  }, []);

  const handleChargeConfirm = () => {
    update({ paymentStatus: 'confirmed' });
    setModalOpen(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 pb-28">
      {codeStatus === 'pending' && (
        <CodeRequestBanner onRequest={() => router.push('/VerificationScreen')} />
      )}

      {codeStatus === 'pending' && paymentStatus === 'pending' && (
        <PaymentChooser
          amount={amount}
          method={paymentMethod}
          onChange={(m) => update({ paymentMethod: m })}
          onCharge={() => setModalOpen(true)}
        />
      )}

      {codeStatus === 'pending' && paymentStatus === 'confirmed' && paymentMethod && (
        <PaymentConfirmedRow
          amount={amount}
          method={paymentMethod}
          onEdit={() => update({ paymentStatus: 'pending' })}
        />
      )}

      {codeStatus === 'validated' && paymentStatus === 'confirmed' && paymentMethod && (
        <DeliveryReleasedCard amount={amount} method={paymentMethod} />
      )}

      <ConfirmChargeModal
        open={modalOpen}
        amount={amount}
        method={paymentMethod || ''}
        onConfirm={handleChargeConfirm}
        onCancel={() => setModalOpen(false)}
      />

      <FooterNextButton
        enabled={codeStatus === 'validated' && paymentStatus === 'confirmed'}
        onNext={() => console.log('Próxima entrega')}
      />
    </div>
  );
}
