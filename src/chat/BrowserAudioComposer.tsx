import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Mic, Play, Send, Square, Trash2, X } from 'lucide-react-native';
import { useAudioPlayer } from 'expo-audio';
import { reportBrowserMock } from '../../services/browserNativeTest';
import { useZippyTheme } from '../ui/theme';

export function BrowserAudioComposer({ disabled }: { disabled: boolean }) {
  const { colors } = useZippyTheme();
  const [phase, setPhase] = useState<'closed' | 'recording' | 'preview'>(
    'closed',
  );
  const [seconds, setSeconds] = useState(0);
  const player = useAudioPlayer(
    require('../../assets/sounds/chat_message.wav'),
  );
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(
      () => setSeconds((s) => Math.min(120, s + 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (seconds === 120) setPhase('preview');
  }, [seconds]);
  const close = () => {
    player.pause();
    setPhase('closed');
  };
  const tool = {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gravar audio"
        disabled={disabled}
        onPress={() => {
          setSeconds(0);
          setPhase('recording');
          reportBrowserMock(
            'Microfone MOCK no navegador: nenhum som do aparelho esta sendo gravado.',
          );
        }}
        style={{
          ...tool,
          backgroundColor: colors.accentSoft,
          borderRadius: 8,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Mic size={20} color={colors.accent} />
      </Pressable>
      <Modal visible={phase !== 'closed'} transparent onRequestClose={close}>
        <View
          style={{
            flex: 1,
            backgroundColor: '#10182099',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              alignSelf: 'center',
              padding: 16,
              backgroundColor: colors.card,
              borderRadius: 8,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: '800',
                  color: colors.ink,
                }}
              >
                Audio MOCK no navegador
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar audio mock"
                onPress={close}
                style={tool}
              >
                <X size={18} color={colors.ink} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
              {phase === 'recording'
                ? `Gravacao simulada: ${seconds}s. Microfone nao utilizado.`
                : 'Previa com audio de exemplo. O envio sera apenas simulado localmente.'}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Descartar audio"
                onPress={close}
                style={tool}
              >
                <Trash2 size={20} color={colors.muted} />
              </Pressable>
              {phase === 'recording' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Concluir gravacao"
                  onPress={() => setPhase('preview')}
                  style={tool}
                >
                  <Square size={20} color={colors.accent} />
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Reproduzir audio de exemplo mock"
                    onPress={() => {
                      void player
                        .seekTo(0)
                        .then(() => player.play())
                        .catch(() =>
                          reportBrowserMock(
                            'Audio de exemplo MOCK indisponivel; nenhuma gravacao real.',
                          ),
                        );
                    }}
                    style={tool}
                  >
                    <Play size={20} color={colors.accent} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Enviar audio"
                    onPress={() => {
                      reportBrowserMock(
                        'Envio de audio MOCK concluido apenas no navegador. Nao foi enviado ao chat, cliente ou loja.',
                      );
                      close();
                    }}
                    style={tool}
                  >
                    <Send size={20} color={colors.accent} />
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
