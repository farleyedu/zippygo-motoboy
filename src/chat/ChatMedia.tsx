import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Mic, Pause, Play, Send, Trash2, X } from 'lucide-react-native';
import { ChatAttachment, LocalChatFile } from '../../services/communicationApi';
import { useZippyTheme } from '../ui/theme';
import { openChatFile } from './media';
import { browserNativeTest } from '../../services/browserNativeTest';
import { BrowserAudioComposer } from './BrowserAudioComposer';

const clock = (seconds: number) => Math.floor(Math.max(0, seconds) / 60) + ':' + String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0');
const audioStops = new Set<() => void>();
export function ChatMedia({ attachment, foreground, senderName = 'Áudio', avatarUri }: {
  attachment: ChatAttachment; foreground: string; senderName?: string; avatarUri?: string;
}) {
  const { colors } = useZippyTheme(), focused = useIsFocused();
  const [uri, setUri] = useState<string | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [expanded, setExpanded] = useState(false), [speed, setSpeed] = useState(1);
  const player = useAudioPlayer(null, { updateInterval: 250 }), status = useAudioPlayerStatus(player);
  const image = attachment.contentType.startsWith('image/');
  const pending = useRef(false), active = useRef(true), request = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null), width = useRef(1);
  const loaded = useRef(false); loaded.current = status.isLoaded;
  useEffect(() => {
    active.current = true;
    const stop = () => { pending.current = false; request.current++; try { player.pause(); } catch {} if (active.current) setLoading(false); };
    audioStops.add(stop);
    const listener = AppState.addEventListener('change', next => { if (next !== 'active') stop(); });
    return () => { active.current = false; request.current++; pending.current = false; audioStops.delete(stop); listener.remove(); if (timer.current) clearTimeout(timer.current); };
  }, [player]);
  useEffect(() => { if (!focused) { pending.current = false; request.current++; player.pause(); setLoading(false); setExpanded(false); } }, [focused, player]);
  useEffect(() => {
    if (!pending.current || !status.isLoaded || !focused) return;
    pending.current = false;
    if (timer.current) clearTimeout(timer.current);
    player.setPlaybackRate(speed); player.play(); setLoading(false);
  }, [status.isLoaded, focused, player, speed]);
  useEffect(() => {
    let alive = true; setUri(null); setError('');
    if (image) {
      setLoading(true);
      void openChatFile(attachment.id, attachment.clientPedidoId).then(value => { if (alive) setUri(value); })
        .catch(() => { if (alive) setError('Não foi possível abrir a foto.'); }).finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [attachment.id, attachment.clientPedidoId, image]);
  const play = async () => {
    if (loading) return;
    if (status.playing) { player.pause(); return; }
    const run = ++request.current;
    try {
      setError('');
      // Interrompe outros áudios antes de adquirir o foco do aparelho.
      for (const stop of audioStops) stop();
      request.current = run;
      setLoading(true);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      const source = uri || await openChatFile(attachment.id, attachment.clientPedidoId);
      if (!active.current || !focused || request.current !== run) return;
      if (!uri) { setUri(source); pending.current = true; player.replace(source); }
      else if (loaded.current) {
        if (status.didJustFinish || status.currentTime >= status.duration && status.duration > 0) await player.seekTo(0);
        player.setPlaybackRate(speed); player.play(); setLoading(false); return;
      } else pending.current = true;
      timer.current = setTimeout(() => { if (!active.current || !pending.current) return; pending.current = false; setLoading(false); setError('O áudio não abriu. Toque para tentar novamente.'); setUri(null); }, 15000);
    } catch {
      if (active.current && request.current === run) { pending.current = false; setLoading(false); setUri(null); setError('Não foi possível reproduzir. Toque para tentar novamente.'); }
    }
  };
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  const percent = `${progress * 100}%` as `${number}%`;
  return <View style={{ minWidth: image ? 180 : 224, maxWidth: '100%' }}>
    {image ? <Pressable accessibilityRole="button" accessibilityLabel="Ampliar foto" disabled={!uri} onPress={() => setExpanded(true)}>
      {uri ? <Image source={{ uri }} style={{ width: 240, maxWidth: '100%', aspectRatio: 4 / 3, borderRadius: 12 }} resizeMode="cover" /> : <ActivityIndicator color={foreground} />}
    </Pressable> : <View style={styles.row}>
      <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' }}>
        {avatarUri ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} /> : <Text style={{ color: colors.accent, fontFamily: 'ManropeExtraBold', fontSize: 10 }}>{senderName.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()}</Text>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? 'Pausar áudio' : 'Reproduzir áudio'} onPress={() => void play()} style={{ width: 36, height: 44, justifyContent: 'center', alignItems: 'center' }}>
        {loading ? <ActivityIndicator color={foreground} /> : status.playing ? <Pause color={foreground} size={21} /> : <Play color={foreground} size={21} />}
      </Pressable>
      <View style={{ flex: 1, minWidth: 70 }}>
        <Pressable accessibilityRole="adjustable" accessibilityLabel="Posição do áudio" accessibilityValue={{ min: 0, max: Math.round(status.duration), now: Math.round(status.currentTime), text: clock(status.currentTime) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => { if (status.isLoaded) void player.seekTo(Math.max(0, Math.min(status.duration, status.currentTime + (e.nativeEvent.actionName === 'increment' ? 5 : -5)))).catch(() => setError('Não foi possível mudar a posição.')); }} onLayout={e => { width.current = e.nativeEvent.layout.width; }} onPress={e => { if (status.isLoaded && status.duration > 0) void player.seekTo(Math.max(0, Math.min(1, e.nativeEvent.locationX / width.current)) * status.duration).catch(() => setError('Não foi possível mudar a posição.')); }} style={{ height: 34, justifyContent: 'center' }}>
          <View style={{ height: 4, borderRadius: 3, backgroundColor: foreground + '40' }}><View style={{ height: 4, borderRadius: 3, backgroundColor: foreground, width: percent }} /><View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: foreground, top: -3, left: percent }} /></View>
        </Pressable>
        <Text style={{ color: foreground, fontFamily: 'Manrope', fontSize: 9 }}>{clock(status.currentTime)} / {status.duration ? clock(status.duration) : '—:—'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={'Velocidade ' + speed + ' vezes'} onPress={() => { const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; setSpeed(next); player.setPlaybackRate(next); }} style={{ minWidth: 38, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: foreground, fontFamily: 'ManropeExtraBold', fontSize: 10 }}>{speed}×</Text></Pressable>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: foreground, fontSize: 10, marginTop: 6 }}>{error}</Text>}
    <Modal visible={expanded} transparent onRequestClose={() => setExpanded(false)}><View style={{ flex: 1, backgroundColor: '#101820ee', justifyContent: 'center', padding: 16 }}><Pressable accessibilityLabel="Fechar foto" onPress={() => setExpanded(false)} style={{ alignSelf: 'flex-end', padding: 12 }}><X color="#fff" /></Pressable>{uri && <Image source={{ uri }} style={{ width: '100%', height: '70%' }} resizeMode="contain" />}</View></Modal>
  </View>;
}

export function AudioComposer(props: { disabled: boolean; send: (file: LocalChatFile) => Promise<void>; onError: (error: string) => void }) {
  return browserNativeTest ? <BrowserAudioComposer disabled={props.disabled} /> : <NativeAudioComposer {...props} />;
}

function NativeAudioComposer({
  disabled,
  send,
  onError,
}: {
  disabled: boolean;
  send: (file: LocalChatFile) => Promise<void>;
  onError: (error: string) => void;
}) {
  const { colors } = useZippyTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY),
    state = useAudioRecorderState(recorder, 250);
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<LocalChatFile | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const listener = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && recorder.isRecording)
        void recorder.stop().then(() => {
          if (active.current) {
            setRecording(false);
            onError('Gravacao interrompida. Grave novamente para enviar.');
          }
        });
    });
    return () => {
      active.current = false;
      listener.remove();
      // No desmontar, o expo-audio ja liberou o gravador antes deste cleanup.
      try {
        if (recorder.isRecording) void recorder.stop().catch(() => undefined);
      } catch {}
    };
  }, [recorder, onError]);
  const stop = async (keep: boolean) => {
    try {
      setBusy(true);
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      setRecording(false);
      if (keep && recorder.uri)
        setPreview({
          uri: recorder.uri,
          name: Platform.OS === 'web' ? 'audio.webm' : 'audio.m4a',
          contentType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
        });
    } catch {
      onError('Nao foi possivel concluir o audio.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (recording && state.durationMillis >= 120000) void stop(true);
  }, [state.durationMillis, recording]);
  const start = async () => {
    try {
      setBusy(true);
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          'Permita o microfone nas configuracoes para gravar audio.',
        );
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel iniciar a gravacao.',
      );
    } finally {
      setBusy(false);
    }
  };
  if (recording || preview)
    return (
      <View
        style={[
          styles.row,
          {
            padding: 10,
            backgroundColor: colors.soft,
            borderRadius: 8,
            flex: 1,
          },
        ]}
      >
        <Mic color={recording ? colors.danger : colors.accent} size={18} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 11 }}>
          {recording
            ? `Gravando ${clock(state.durationMillis / 1000)}`
            : 'Audio pronto'}
        </Text>
        <Pressable
          accessibilityLabel="Descartar audio"
          disabled={busy}
          onPress={() => (recording ? void stop(false) : setPreview(null))}
          style={styles.tool}
        >
          <Trash2 size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityLabel={recording ? 'Concluir gravacao' : 'Enviar audio'}
          disabled={busy}
          style={styles.tool}
          onPress={() => {
            if (recording) void stop(true);
            else if (preview) {
              setBusy(true);
              void send(preview)
                .then(() => setPreview(null))
                .catch((e) => onError(String(e)))
                .finally(() => setBusy(false));
            }
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Send size={19} color={colors.accent} />
          )}
        </Pressable>
      </View>
    );
  return (
    <Pressable
      accessibilityLabel="Gravar audio"
      disabled={disabled || busy}
      onPress={() => void start()}
      style={[
        styles.tool,
        {
          backgroundColor: colors.accentSoft,
          borderRadius: 16,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Mic size={20} color={colors.accent} />
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tool: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
