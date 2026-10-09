import React, { useState } from 'react';
import { Linking, Platform, Switch, Vibration } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Vibrate } from 'lucide-react-native';
import { AccountNotice, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Surface } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';
import { ensureChatNotificationPermission } from '../src/chat/push';
import { browserNativeTest, reportBrowserMock } from '../services/browserNativeTest';

export default function SoundScreen() {
  const router = useRouter(), theme = useZippyTheme(), [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const allowNotifications = async () => {
    if (requesting) return;
    setRequesting(true);
    setError('');
    try {
      const access = await ensureChatNotificationPermission(true);
      if (access === 'blocked') await Linking.openSettings();
      else if (access === 'denied') setError('Permissao de notificacoes nao concedida.');
    } catch { setError('Nao foi possivel verificar as notificacoes. Tente novamente.'); }
    finally { setRequesting(false); }
  };
  const change = async (key: 'sound' | 'vibration', value: boolean) => { try { await theme.setPreference(key, value); setError(''); if (key === 'vibration' && value) { if (browserNativeTest) reportBrowserMock('Vibracao MOCK no navegador. Nenhuma vibracao fisica executada.'); else Vibration.vibrate(90); } } catch { setError('Não foi possível salvar. Tente novamente.'); } };
  return <AccountScreen><Header title="Você percebe o chamado." subtitle="Som & vibração" onBack={() => router.back()} /><Surface style={{ paddingVertical: 0 }}><MenuRow icon={Bell} title="Som dos avisos" subtitle="Respeita o volume e os canais do aparelho." right={<Switch accessibilityLabel="Som dos avisos" value={theme.sound} onValueChange={v => void change('sound', v)} />} /><MenuRow icon={Vibrate} title="Vibrar ao receber rota" subtitle="Um aviso curto quando chega uma nova oferta." last right={<Switch accessibilityLabel="Vibrar ao receber rota" value={theme.vibration} onValueChange={v => void change('vibration', v)} />} /></Surface>{!!error && <Feedback title="Confira a preferência" message={error} />}<AccountNotice icon={Bell}>Para receber avisos com o app fechado, permita notificações nas configurações do aparelho.</AccountNotice>{Platform.OS !== 'web' && <Button secondary icon={Bell} disabled={requesting} onPress={() => void allowNotifications()}>Permitir notificações</Button>}<Button secondary icon={Bell} onPress={() => router.push('/permissoes')}>Revisar permissões</Button></AccountScreen>;
}
