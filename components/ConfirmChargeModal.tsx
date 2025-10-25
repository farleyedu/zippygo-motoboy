import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';

type Props = {
  open: boolean;
  amount: number;
  method: string;
  onConfirm(): void;
  onCancel(): void;
};

export default function ConfirmChargeModal({ open, amount, method, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={open} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>Tem certeza que deseja cobrar?</Text>
          <Text style={styles.subtitle}>R$ {amount.toFixed(2)} — {method}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnSecondaryPressed]}>
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}>
              <Text style={styles.btnPrimaryText}>Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: 320,
    maxWidth: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  btnSecondaryPressed: {
    backgroundColor: '#F3F4F6',
  },
  btnSecondaryText: {
    color: '#374151',
    fontWeight: '500',
  },
  btnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#16A34A',
  },
  btnPrimaryPressed: {
    backgroundColor: '#15803D',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
  },
});
