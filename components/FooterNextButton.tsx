import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';

type Props = {
  enabled: boolean;
  onNext(): void;
};

export default function FooterNextButton({ enabled, onNext }: Props) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        onPress={onNext}
        disabled={!enabled}
        style={({ pressed }) => [
          styles.button,
          !enabled && styles.buttonDisabled,
          pressed && enabled && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, !enabled && styles.buttonTextDisabled]}>Próxima entrega</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonTextDisabled: {
    color: '#6B7280',
  },
});
