import React from 'react';
import { Modal, Text, View } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { Button, Feedback, Surface, type } from './Kit';
import { useZippyTheme } from './theme';

export function OperationalConflictDialog() {
  const turn = useOperationalSession();
  const { colors } = useZippyTheme();
  const visible = !!turn.conflict;
  const busy = turn.busy;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) turn.store.cancelConflict(); }}>
    <View style={{ flex: 1, backgroundColor: '#081426bb', justifyContent: 'flex-end', alignItems: 'center', padding: 22 }}>
      <Surface style={{ width: '100%', maxWidth: 420, borderRadius: 25, padding: 21 }}>
        <View accessibilityViewIsModal style={{ gap: 16 }}>
          <Smartphone size={30} color={colors.accent} />
          <Text accessibilityRole="header" style={[type.title, { color: colors.ink }]}>Seu turno está ativo em outro aparelho.</Text>
          <Text style={[type.body, { color: colors.muted }]}>Se continuar aqui, o turno no outro aparelho será encerrado e você assume este. Os pedidos continuam salvos.</Text>
          {turn.error ? <Feedback title="Não foi possível continuar" message={turn.error} /> : null}
          <Button loading={busy} disabled={busy} onPress={() => void turn.store.confirmSwitch()}>Continuar aqui</Button>
          <Button secondary disabled={busy} onPress={() => turn.store.cancelConflict()}>Cancelar</Button>
        </View>
      </Surface>
    </View>
  </Modal>;
}
