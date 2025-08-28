import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

type Props = {
  amount: number;
  method: string;
};

export default function DeliveryReleasedCard({ amount, method }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <FontAwesome name="check" size={20} color="#fff" />
      </View>
      <Text style={styles.title}>Entrega Liberada! ✨</Text>
      <Text style={styles.subtitle}>Código validado e pagamento registrado com sucesso.</Text>
      <View style={styles.amountBox}>
        <Text style={styles.amount}>R$ {amount.toFixed(2)}</Text>
        <Text style={styles.method}>{method}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 480,
  },
  iconCircle: {
    backgroundColor: '#16A34A',
    borderRadius: 999,
    padding: 10,
  },
  title: {
    color: '#15803D',
    fontWeight: '600',
    fontSize: 18,
    textAlign: 'center',
  },
  subtitle: {
    color: '#374151',
    fontSize: 14,
    textAlign: 'center',
  },
  amountBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  amount: {
    color: '#111827',
    fontWeight: '600',
  },
  method: {
    color: '#6B7280',
    fontSize: 12,
  },
});
