import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Mic, Pause, Play, Send, Trash2, X } from 'lucide-react-native';
import { ChatAttachment, LocalChatFile } from '../../services/communicationApi';
import { useZippyTheme } from '../ui/theme';
import { openChatFile } from './media';
import { browserNativeTest } from '../../services/browserNativeTest';
import { BrowserAudioComposer } from './BrowserAudioComposer';

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function ChatMedia({
  attachment,
  foreground,
}: {
  attachment: ChatAttachment;
  foreground: string;
}) {
  const [uri, setUri] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [expanded, setExpanded] = useState(false);
  const player = useAudioPlayer(null),
    status = useAudioPlayerStatus(player);
  const image = attachment.contentType.startsWith('image/');
  useEffect(() => {
    let alive = true;
    if (image) {
      setUri(null);
      setError('');
      setLoading(true);
      void openChatFile(attachment.id, attachment.clientPedidoId)
        .then(
          (value) => {
            if (alive) setUri(value);
          },
          () => {
            if (alive) setError('Nao foi possivel abrir a foto.');
          },
        )
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    return () => {
      alive = false;
    };
  }, [attachment.id, attachment.clientPedidoId, image]);
  const play = async () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      setLoading(true);
      setError('');
      if (!uri) {
        const source = await openChatFile(
          attachment.id,
          attachment.clientPedidoId,
        );
        setUri(source);
        player.replace(source);
      }
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: false,
      });
      if (status.didJustFinish) await player.seekTo(0);
      player.play();
    } catch {
      setError('Nao foi possivel reproduzir. Toque para tentar novamente.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={{ minWidth: image ? 180 : 160, maxWidth: '100%' }}>
      {image ? (
        <Pressable
          accessibilityLabel="Ampliar foto"
          onPress={() => setExpanded(true)}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{
                width: 220,
                maxWidth: '100%',
                aspectRatio: 4 / 3,
                borderRadius: 8,
              }}
              resizeMode="cover"
            />
          ) : (
            <ActivityIndicator color={foreground} />
          )}
        </Pressable>
      ) : (
        <View style={styles.row}>
          <Pressable
            accessibilityLabel={
              status.playing ? 'Pausar audio' : 'Reproduzir audio'
            }
            onPress={() => void play()}
            style={styles.tool}
          >
            {loading ? (
              <ActivityIndicator color={foreground} />
            ) : status.playing ? (
              <Pause color={foreground} size={18} />
            ) : (
              <Play color={foreground} size={18} />
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: foreground, fontFamily: 'Manrope', fontSize: 11 }}
            >
              Mensagem de audio
            </Text>
            <Text style={{ color: foreground, fontSize: 9 }}>
              {clock(status.currentTime)} /{' '}
              {status.duration
                ? clock(status.duration)
                : attachment.size
                  ? `${Math.round(attachment.size / 1024)} KB`
                  : '--:--'}
            </Text>
          </View>
        </View>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: foreground, fontSize: 10 }}
        >
          {error}
        </Text>
      )}
      <Modal
        visible={expanded}
        transparent
        onRequestClose={() => setExpanded(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#101820ee',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <Pressable
            accessibilityLabel="Fechar foto"
            onPress={() => setExpanded(false)}
            style={{ alignSelf: 'flex-end', padding: 12 }}
          >
            <X color="#fff" />
          </Pressable>
          {uri && (
            <Image
              source={{ uri }}
              style={{ width: '100%', height: '70%' }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
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
      if (recorder.isRecording) void recorder.stop().catch(() => undefined);
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
        playsInSilentMode: false,
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
