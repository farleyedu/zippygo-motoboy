import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

type Method = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito';

type Props = {
  amount: number;
  method: Method | null;
  onChange(method: Method): void;
  onCharge(): void;
};

export default function PaymentChooser({ amount, method, onChange, onCharge }: Props) {
  const [progress, setProgress] = useState(0);
  // Compatível com DOM (number) e Node (Timeout)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = () => {
    if (!method) return;
    const start = Date.now();
    timer.current = setInterval(() => {
      const pct = Math.min((Date.now() - start) / 800, 1);
      setProgress(pct);
      if (pct === 1) {
        if (timer.current) clearInterval(timer.current);
        onCharge();
        setTimeout(() => setProgress(0), 300);
      }
    }, 16);
  };

  const cancelHold = () => {
    if (timer.current) clearInterval(timer.current);
    setProgress(0);
  };

  const isSelected = (m: Method) => method === m;

  return (
    <View style={styles.wrapper}>
      <View style={styles.methodsRow}>
        {(['Dinheiro', 'PIX', 'Débito', 'Crédito'] as Method[]).map((m) => (
          <Pressable key={m} onPress={() => onChange(m)} style={({ pressed }) => [
            styles.methodBtn,
            isSelected(m) ? styles.methodBtnSelected : styles.methodBtnDefault,
            pressed && styles.methodBtnPressed,
          ]}>
            <Text style={[styles.methodText, isSelected(m) ? styles.methodTextSelected : undefined]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chargeWrap}>
        <Pressable
          disabled={!method}
          onPressIn={startHold}
          onPressOut={cancelHold}
          style={({ pressed }) => [
            styles.chargeBtn,
            !method && styles.chargeBtnDisabled,
            pressed && method && styles.chargeBtnPressed,
          ]}
        >
          <Text style={[styles.chargeText, !method && styles.chargeTextDisabled]}>Cobrar R$ {amount.toFixed(2)}</Text>
        </Pressable>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 480,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  methodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  methodBtnDefault: {
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  methodBtnSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#ECFDF5',
  },
  methodBtnPressed: {
    opacity: 0.9,
  },
  methodText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  methodTextSelected: {
    color: '#047857',
  },
  chargeWrap: {
    position: 'relative',
  },
  chargeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  chargeBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  chargeBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  chargeText: {
    color: '#fff',
    fontWeight: '600',
  },
  chargeTextDisabled: {
    color: '#6B7280',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 4,
    backgroundColor: '#22C55E',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
});
