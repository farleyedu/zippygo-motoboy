import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { FontAwesome } from '@expo/vector-icons';

type Props = {
  onRequest(): void;
  sameSizeAs?: React.ReactNode;
};

export default function CodeRequestBanner({ onRequest }: Props) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: -4 }}
      animate={{ opacity: 1, translateY: 0 }}
      style={styles.container}
    >
      <View style={styles.leftRow}>
        <FontAwesome name="key" size={18} color="#ef4444" />
        <Text style={styles.title}>Código de entrega</Text>
      </View>
      <Pressable onPress={onRequest} style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}>
        <Text style={styles.ctaText}>Solicitar</Text>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB', // yellow-50
    borderWidth: 1,
    borderColor: '#F59E0B', // yellow-400
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 480,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#1F2937',
    fontWeight: '600',
    fontSize: 14,
  },
  ctaBtn: {
    backgroundColor: '#EA580C', // orange-600
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ctaBtnPressed: {
    backgroundColor: '#C2410C', // orange-700
  },
  ctaText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
