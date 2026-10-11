import React from 'react';
import { Modal, Text, View } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { Button, Feedback, Surface, type } from './Kit';
import { useZippyTheme } from './theme';

export function SessionReplacementDialog({ visible, busy, error, onCancel, onContinue }: {
  visible: boolean; busy: boolean; error?: string; onCancel: () => void; onContinue: () => void;
}) {
  const { colors } = useZippyTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={{ flex: 1, backgroundColor: '#081426bb', justifyContent: 'flex-end', alignItems: 'center', padding: 22 }}>
      <Surface style={{ width: '100%', maxWidth: 420, borderRadius: 25, padding: 21 }}>
        <View accessibilityViewIsModal style={{ gap: 16 }}>
          <Smartphone size={30} color={colors.accent} />
          <Text accessibilityRole="header" style={[type.title, { color: colors.ink }]}>Já existe uma sessão ativa.</Text>
          <Text style={[type.body, { color: colors.muted }]}>Esta conta está em uso em outro aparelho. Se continuar, ele sairá da conta e o turno online será encerrado. Seus pedidos continuam salvos.</Text>
          {error ? <Feedback title="Não foi possível continuar" message={error} /> : null}
          <Button loading={busy} disabled={busy} onPress={onContinue}>Continuar</Button>
          <Button secondary disabled={busy} onPress={onCancel}>Cancelar</Button>
        </View>
      </Surface>
    </View>
  </Modal>;
}
