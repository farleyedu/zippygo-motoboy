import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

type Props = {
  amount: number;
  method: string;
  onEdit(): void;
};

export default function PaymentConfirmedRow({ amount, method, onEdit }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.checkCircle}>
          <FontAwesome name="check" size={10} color="#fff" />
        </View>
        <View>
          <Text style={styles.title}>Pagamento Confirmado</Text>
          <Text style={styles.subtitle}>R$ {amount.toFixed(2)} — {method}</Text>
        </View>
      </View>
      <Pressable onPress={onEdit} accessibilityLabel="Editar" style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}>
        <FontAwesome name="pencil" size={16} color="#9CA3AF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 480,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkCircle: {
    backgroundColor: '#22C55E',
    borderRadius: 999,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#15803D',
    fontWeight: '600',
    fontSize: 14,
  },
  subtitle: {
    color: '#111827',
    fontSize: 13,
  },
  editBtn: {
    padding: 8,
  },
});
