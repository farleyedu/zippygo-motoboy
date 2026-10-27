import React, { useState, useSyncExternalStore } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Check, LocateFixed, Pause, Wifi, WifiOff } from 'lucide-react-native';
import { useOperationalSession } from '../contexts/OperationalSessionContext';
import { Button, Pill, Surface, type } from './Kit';
import { useZippyTheme } from './theme';
import { useOnline } from '../hooks/useOnline';
import { ensureChatNotificationPermission, registerChatPush } from '../chat/push';
import { registrationFor, subscribeWebPushRegistration, webPushGuidanceNow, webPushRegistration } from '../../services/webOfferPush';
import { executionMode } from '../../services/executionMode';
import { pushGuidance, type PushGuidance } from '../../services/webPushGuidance';

type Tone = 'accent' | 'warning' | 'danger';
type Row = { key: string; icon: typeof Check; label: string; pill: string; tone: Tone; message?: string; action?: { label: string; run: () => void; loading?: boolean } };

/**
 * Online, localização, notificações e conexão são coisas diferentes: perder uma delas não derruba as outras
 * nem o turno. Cada linha diz o que está valendo agora e o que fazer, sem prometer entrega de alertas.
 */
export function OperationalStatus() {
  const turn = useOperationalSession(), router = useRouter(), { colors, sound, vibration } = useZippyTheme(), connected = useOnline();
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState(''), [, refresh] = useState(0);
  const hasSession = !!turn.session, paused = !!turn.queue?.paused, web = Platform.OS === 'web';
  const reconnecting = turn.phase === 'reconnecting' || !connected;
  // Re-renderiza quando a inscrição no servidor muda (registro automático, troca de sessão, encerramento).
  useSyncExternalStore(subscribeWebPushRegistration, webPushRegistration, webPushRegistration);
  const pushContext = { sessionId: turn.session?.sessionId, establishmentId: turn.queue?.estabelecimentoId ?? null };
  const push: PushGuidance = web ? webPushGuidanceNow(pushContext)
    : pushGuidance({ mode: 'native', ios: false, supported: true, permission: turn.permissions?.notifications.granted ? 'granted' : 'denied' });
  const enablePush = async () => {
    if (busy) return;
    setBusy(true); setFailure('');
    try {
      // A solicitação precisa partir diretamente do toque; com a permissão já concedida, só refaz o registro.
      const access = await ensureChatNotificationPermission(true);
      await turn.store.refreshPermissions();
      if (access === 'granted' && turn.session) await registerChatPush(turn.session.sessionId, { sound, vibration, muted: false, mentionAlerts: true });
      else if (access !== 'granted') setFailure(webPushGuidanceNow(pushContext).message);
    } catch (error) { setFailure(error instanceof Error ? error.message : 'Não foi possível ativar os avisos agora.'); }
    finally { refresh(v => v + 1); setBusy(false); }
  };
  const pushActionLabel = push.status === 'unregistered' ? (registrationFor(pushContext.sessionId, pushContext.establishmentId) === 'failed' ? 'Tentar registrar de novo' : 'Registrar avisos') : 'Ativar notificações';
  const gpsReady = !!turn.permissions?.ready;
  const gps: Row = hasSession
    ? turn.locationLimited || (!gpsReady && web)
      ? { key: 'gps', icon: LocateFixed, label: 'Localização', pill: 'Indisponível', tone: 'warning',
          message: web
            ? 'Seu turno continua. A loja vê a última posição confirmada e há quanto tempo ela foi capturada. A localização volta sozinha quando o ZippyGo estiver aberto e permitido.'
            : 'Seu turno continua. A loja vê a última posição confirmada. Revise a permissão de localização.',
          action: { label: 'Ativar localização', run: () => router.push({ pathname: '/permissoes', params: { intent: 'review' } }) } }
      : { key: 'gps', icon: LocateFixed, label: 'Localização', pill: web ? 'Ativa com o app aberto' : 'Ativa', tone: 'accent' }
    : { key: 'gps', icon: LocateFixed, label: 'Localização', pill: gpsReady ? 'Pronta' : web ? 'Opcional' : 'Verificar', tone: gpsReady || web ? 'accent' : 'warning',
        message: !gpsReady && web ? 'Você pode ficar online sem localização; a loja não verá sua posição em tempo real.' : undefined };
  const rows: Row[] = [
    { key: 'turn', icon: paused ? Pause : Check, label: 'Turno', pill: hasSession ? paused ? 'Online · chamados pausados' : 'Online' : 'Offline', tone: hasSession ? 'accent' : 'warning' },
    gps,
    { key: 'push', icon: Bell, label: 'Notificações', pill: push.label, tone: push.status === 'active' || push.status === 'permitted' ? 'accent' : 'warning', message: push.status === 'active' ? undefined : push.message,
      action: push.canRequest ? { label: pushActionLabel, run: () => void enablePush(), loading: busy } : undefined },
    { key: 'net', icon: reconnecting ? WifiOff : Wifi, label: 'Conexão', pill: reconnecting ? 'Sem conexão' : 'Conectada', tone: reconnecting ? 'warning' : 'accent',
      message: reconnecting ? 'Seus dados estão salvos neste aparelho. Uma ação só vale depois que o servidor confirmar; nada é dado como feito antes disso.' : undefined },
  ];
  return <Surface style={{ marginTop: 16, gap: 14 }}>
    {rows.map(row => {
      const Icon = row.icon;
      return <View key={row.key} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center', flexShrink: 1 }}><Icon size={16} color={colors.muted} /><Text style={[type.small, { color: colors.ink }]}>{row.label}</Text></View>
          <Pill tone={row.tone}>{row.pill}</Pill>
        </View>
        {!!row.message && <Text style={[type.small, { color: colors.muted }]}>{row.message}</Text>}
        {row.action && <Button secondary loading={row.action.loading} disabled={row.action.loading} onPress={row.action.run}>{row.action.label}</Button>}
      </View>;
    })}
    {!!failure && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger }]}>{failure}</Text>}
    {web && executionMode() === 'web-browser' && <Text style={[type.small, { color: colors.muted }]}>Dica: adicione o ZippyGo à Tela de Início para abrir como aplicativo e receber avisos de forma mais confiável.</Text>}
  </Surface>;
}
