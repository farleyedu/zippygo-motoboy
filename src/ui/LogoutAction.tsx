import React, { useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { Button, Feedback, Surface, type } from './Kit';
import { useZippyTheme } from './theme';

export function LogoutAction() {
  const auth = useAuth(), turn = useOperationalSession(), router = useRouter();
  const { colors } = useZippyTheme();
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const leaving = useRef(false);
  const leave = async () => {
    if (leaving.current) return;
    leaving.current = true;
    setBusy(true); setError('');
    try { await auth.signOut(); setVisible(false); router.replace('/(auth)/login'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível sair. Seu acesso foi mantido.'); }
    finally { leaving.current = false; setBusy(false); }
  };
  return <>
    <Button secondary icon={LogOut} onPress={() => { setError(''); setVisible(true); }}>Sair da conta</Button>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) setVisible(false); }}>
      <View style={{ flex: 1, backgroundColor: '#081426bb', justifyContent: 'center', alignItems: 'center', padding: 22 }}>
        <Surface style={{ width: '100%', maxWidth: 420 }}>
          <View style={{ gap: 16 }}>
            <LogOut size={30} color={colors.accent} />
            <Text accessibilityRole="header" style={[type.title, { color: colors.ink }]}>Até o próximo caminho.</Text>
            <Text style={[type.body, { color: colors.muted }]}>{turn.session ? 'Vamos encerrar seu turno antes de sair. Pedidos ou transferências pendentes precisam ser resolvidos primeiro.' : 'Você voltará à tela de login e poderá entrar novamente quando quiser.'}</Text>
            {error ? <Feedback title="Seu acesso foi mantido" message={error} /> : null}
            <Button loading={busy} disabled={busy} onPress={() => void leave()}>{turn.session ? 'Encerrar turno e sair' : 'Sair agora'}</Button>
            <Button secondary disabled={busy} onPress={() => setVisible(false)}>Continuar no app</Button>
          </View>
        </Surface>
      </View>
    </Modal>
  </>;
}
