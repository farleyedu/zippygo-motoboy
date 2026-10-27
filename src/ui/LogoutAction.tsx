import React, { useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { END_WITH_WORK_MESSAGE, END_WITH_WORK_TITLE, useEndShift } from '../hooks/useEndShift';
import { Button, Feedback, Surface, type } from './Kit';
import { useZippyTheme } from './theme';

export function LogoutAction() {
  const auth = useAuth(), turn = useOperationalSession(), router = useRouter(), shift = useEndShift('logout');
  const { colors } = useZippyTheme();
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const leaving = useRef(false);
  const leave = async () => {
    if (leaving.current) return;
    leaving.current = true;
    setBusy(true); setError('');
    try {
      // O turno é encerrado aqui, com a confirmação de pedidos que a pessoa acabou de ver; só então a conta sai.
      // Se o servidor recusar ou não responder, a conta e o turno continuam.
      if (turn.session && !(await shift.end(shift.needsWorkConfirmation))) return;
      await auth.signOut(); setVisible(false); router.replace('/(auth)/login');
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível sair. Seu acesso foi mantido.'); }
    finally { leaving.current = false; setBusy(false); }
  };
  const close = () => { shift.cancel(); setVisible(false); };
  const working = busy || shift.busy, failure = error || shift.error;
  return <>
    <Button secondary icon={LogOut} onPress={() => { setError(''); shift.cancel(); setVisible(true); }}>Sair da conta</Button>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!working) close(); }}>
      <View style={{ flex: 1, backgroundColor: '#081426bb', justifyContent: 'center', alignItems: 'center', padding: 22 }}>
        <Surface style={{ width: '100%', maxWidth: 420 }}>
          <View style={{ gap: 16 }}>
            <LogOut size={30} color={colors.accent} />
            <Text accessibilityRole="header" style={[type.title, { color: colors.ink }]}>Até o próximo caminho.</Text>
            <Text style={[type.body, { color: colors.muted }]}>{turn.session ? 'Vamos encerrar seu turno antes de sair. Se o servidor recusar ou não responder, você continua logado e com o turno.' : 'Você voltará à tela de login e poderá entrar novamente quando quiser.'}</Text>
            {turn.session && shift.pendingCompletion ? <Feedback title="Consulte a conclusão pendente" message="Há uma conclusão ainda não confirmada pelo servidor. Aguarde o resultado antes de encerrar o turno e sair." /> : null}
            {turn.session && shift.needsWorkConfirmation ? <Feedback title={END_WITH_WORK_TITLE} message={END_WITH_WORK_MESSAGE} /> : null}
            {failure ? <Feedback title="Seu acesso foi mantido" message={failure} /> : null}
            <Button loading={working} disabled={working || (!!turn.session && shift.pendingCompletion)} onPress={() => void leave()}>{!turn.session ? 'Sair agora' : shift.needsWorkConfirmation ? 'Passar pedidos à loja e sair' : 'Encerrar turno e sair'}</Button>
            <Button secondary disabled={working} onPress={close}>Continuar no app</Button>
          </View>
        </Surface>
      </View>
    </Modal>
  </>;
}
