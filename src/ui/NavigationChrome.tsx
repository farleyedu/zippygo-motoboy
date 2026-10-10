import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LocateFixed, Navigation, Volume2, VolumeX } from 'lucide-react-native';
import type { NavigationState } from '../../components/mapTypes';
import { journeySummary } from '../delivery/navigationJourney';
import { NavigationDiagnostics } from '../delivery/navigationDiagnostics';
import { useZippyTheme } from './theme';

type Props = {
  state: NavigationState;
  address: string;
  following: boolean;
  muted: boolean;
  top: number;
  bottom: number;
  footerInset: number;
  onCenter(): void;
  onMute(): void;
  onExit(): void;
  onRetry(): void;
  onHeight(height: number): void;
};

// Only travel information here. Pickup/delivery checks stay in their own flow.
export function NavigationChrome(props: Props) {
  const retryLog = React.useRef(new NavigationDiagnostics(__DEV__));
  const { colors } = useZippyTheme();
  const { state } = props;
  const summary = journeySummary(state.seconds, state.meters);
  const active = state.status === 'guiding' || state.status === 'rerouting';
  const arrived = state.status === 'arrived';
  const error = state.status === 'error';
  const icon = props.muted ? VolumeX : Volume2;
  const SoundIcon = icon;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {(!active || arrived) && <View accessibilityLiveRegion="polite" style={[styles.prepare, { top: props.top + 12, backgroundColor: colors.hero, borderColor: colors.line }]}>
      <View style={styles.row}>{error || arrived ? <Navigation color={colors.heroInk} size={26} /> : <ActivityIndicator color={colors.heroInk} />}<Text style={[styles.title, { color: colors.heroInk }]}>{error ? 'Navegação indisponível' : arrived ? 'Você chegou ao endereço' : 'Preparando seu caminho'}</Text></View>
      <Text numberOfLines={2} style={[styles.address, { color: colors.heroMuted }]}>{props.address || 'Aguardando o endereço de destino'}</Text>
      {!!state.message && <Text style={[styles.small, { color: colors.heroMuted }]}>{state.message}</Text>}
      {error && <Pressable accessibilityRole="button" onPressIn={() => retryLog.current.event('retry.touch')} onPress={() => { retryLog.current.event('retry.press'); props.onRetry(); }} style={styles.retry}><Text style={[styles.small, { color: colors.heroInk, fontFamily: 'ManropeExtraBold' }]}>Tentar novamente</Text></Pressable>}
    </View>}
    <View pointerEvents="box-none" style={[styles.actions, { bottom: props.footerInset + 12 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Centralizar e acompanhar minha posição" onPress={props.onCenter} style={({ pressed }) => [styles.center, { backgroundColor: colors.hero, opacity: pressed ? .75 : 1 }]}>
        <LocateFixed color={colors.heroInk} size={21} /><Text style={[styles.small, { color: colors.heroInk, fontFamily: 'ManropeExtraBold' }]}>{props.following ? 'Centralizar' : 'Voltar a acompanhar'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={props.muted ? 'Ativar instruções faladas' : 'Silenciar instruções faladas'} accessibilityState={{ selected: props.muted }} onPress={props.onMute} style={({ pressed }) => [styles.sound, { backgroundColor: colors.hero, opacity: pressed ? .75 : 1 }]}><SoundIcon color={colors.heroInk} size={22} /></Pressable>
    </View>
    <View onLayout={event => props.onHeight(event.nativeEvent.layout.height + props.bottom + 12)} style={[styles.footer, { bottom: props.bottom + 8, backgroundColor: colors.card, borderColor: colors.line }]}>
      <View style={styles.row}><View style={{ flex: 1 }}>
        <Text accessibilityLiveRegion="polite" style={[styles.duration, { color: colors.accent }]}>{arrived ? 'Chegou' : active ? summary.duration : error ? 'Sem orientação' : 'Aguardando rota'}</Text>
        <Text style={[styles.metrics, { color: colors.ink }]}>{active ? summary.distance + ' · chegada ' + summary.arrival : arrived ? 'Navegação concluída neste destino' : 'Tempo e distância aparecem após o cálculo'}</Text>
      </View><Pressable accessibilityRole="button" accessibilityLabel="Sair da navegação sem finalizar a entrega" onPress={props.onExit} style={({ pressed }) => [styles.exit, { backgroundColor: colors.dangerSoft, opacity: pressed ? .75 : 1 }]}><Text style={[styles.small, { color: colors.danger, fontFamily: 'ManropeExtraBold' }]}>Sair</Text></Pressable></View>
      <View style={[styles.destination, { borderTopColor: colors.line }]}><Navigation size={14} color={colors.muted} /><Text numberOfLines={1} style={[styles.small, { flex: 1, color: colors.muted }]}>{props.address || 'Endereço ainda não disponível'}</Text></View>
      {state.status === 'rerouting' && <Text accessibilityLiveRegion="polite" style={[styles.small, { color: colors.accent, marginTop: 4 }]}>Recalculando o caminho…</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prepare: { position: 'absolute', left: 12, right: 12, borderRadius: 23, borderWidth: 1, padding: 18, gap: 8 },
  title: { flex: 1, fontFamily: 'ManropeExtraBold', fontSize: 19 },
  address: { fontFamily: 'ManropeMedium', fontSize: 15, lineHeight: 21 },
  small: { fontFamily: 'ManropeMedium', fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 44, justifyContent: 'center' },
  actions: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { minHeight: 48, borderRadius: 24, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: '0 5px 16px #10203530' },
  sound: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 16px #10203530' },
  footer: { position: 'absolute', left: 12, right: 12, padding: 17, borderRadius: 23, borderWidth: 1, boxShadow: '0 10px 32px #10203530' },
  duration: { fontFamily: 'ManropeExtraBold', fontSize: 29, lineHeight: 36 },
  metrics: { fontFamily: 'ManropeMedium', fontSize: 13, lineHeight: 20, marginTop: 2 },
  exit: { minWidth: 64, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  destination: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
});
