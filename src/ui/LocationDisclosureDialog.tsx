import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LOCATION_DISCLOSURE_TEXT, LOCATION_DISCLOSURE_TITLE } from '../../services/locationDisclosureConsent';
import { Button, Feedback, type } from './Kit';
import { useZippyTheme } from './theme';

export function LocationDisclosureDialog({ visible, busy, error, onCancel, onContinue }: {
  visible: boolean; busy: boolean; error?: string; onCancel: () => void; onContinue: () => void;
}) {
  const { colors } = useZippyTheme(), insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#12192388', padding: 13, paddingTop: insets.top + 20, paddingBottom: Math.max(14, insets.bottom) }}>
      <View accessibilityViewIsModal accessibilityRole="alert" style={{ width: '100%', maxWidth: 420, maxHeight: '90%', backgroundColor: colors.paper, borderRadius: 25, borderWidth: 1, borderColor: colors.line, padding: 21 }}>
        <ScrollView style={{ flexShrink: 1 }}>
          <MapPin size={30} color={colors.accent} />
          <Text accessibilityRole="header" style={[type.title, { color: colors.ink, marginTop: 14 }]}>{LOCATION_DISCLOSURE_TITLE}</Text>
          <Text style={[type.body, { color: colors.muted, marginTop: 14 }]}>{LOCATION_DISCLOSURE_TEXT}</Text>
          {!!error && <View style={{ marginTop: 14 }}><Feedback title="Não foi possível continuar" message={error} /></View>}
        </ScrollView>
        <View style={{ gap: 9, marginTop: 18 }}>
          <Button loading={busy} onPress={onContinue}>Concordar e continuar</Button>
          <Button secondary disabled={busy} onPress={onCancel}>Agora não</Button>
        </View>
      </View>
    </View>
  </Modal>;
}
