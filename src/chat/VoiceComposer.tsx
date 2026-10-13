import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, type AudioRecorder } from 'expo-audio';
import { ChevronLeft, ChevronUp, Lock, Mic, Pause, Send, Trash2 } from 'lucide-react-native';
import type { LocalChatFile } from '../../services/communicationApi';
import { useWa } from './WaKit';

// Gravação de voz no padrão do WhatsApp: segurar grava, soltar envia, arrastar para a esquerda
// cancela (lixeira) e arrastar para cima trava a gravação com as mãos livres.
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const BUTTON = 48, GAP = 6;
const CANCEL_DISTANCE = 110, LOCK_DISTANCE = 84;
const MIN_MS = 700, MAX_MS = 120000;
const BAR_PITCH = 5;

type Phase = 'idle' | 'hold' | 'locked' | 'deleting' | 'closing';
type Feel = 'light' | 'medium' | 'heavy' | 'warning';

function buzz(enabled: boolean, feel: Feel) {
  if (!enabled || Platform.OS === 'web') return;
  const run = feel === 'warning' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    : Haptics.impactAsync(feel === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : feel === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  void run.catch(() => {});
}
const clock = (ms: number) => { const s = Math.floor(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function VoiceComposer({ disabled, send, onError, stopPlayback }: {
  disabled: boolean; send: (file: LocalChatFile) => Promise<void>; onError: (error: string) => void; stopPlayback: () => void;
}) {
  const wa = useWa(), recorder = useAudioRecorder(OPTIONS);
  const [phase, setPhaseState] = useState<Phase>('idle'), [armed, setArmed] = useState(false), [paused, setPaused] = useState(false), [tip, setTip] = useState(false);
  const [v] = useState(() => ({
    bar: new Animated.Value(0), press: new Animated.Value(0), tx: new Animated.Value(0), ty: new Animated.Value(0),
    lock: new Animated.Value(0), pop: new Animated.Value(0), tip: new Animated.Value(0),
  }));
  const live = useRef({ phase: 'idle' as Phase, armed: false, disabled, send, onError, stopPlayback, vibrate: wa.vibration, still: wa.reducedMotion });
  live.current = { ...live.current, disabled, send, onError, stopPlayback, vibrate: wa.vibration, still: wa.reducedMotion };
  const session = useRef({ id: 0, ready: Promise.resolve(false), startedAt: 0, axis: null as 'x' | 'y' | null, granted: null as boolean | null, tipTimer: null as ReturnType<typeof setTimeout> | null }).current;
  const ms = (value: number) => live.current.still ? 0 : value;
  const setPhase = (next: Phase) => { live.current.phase = next; setPhaseState(next); };
  const feel = (kind: Feel) => buzz(live.current.vibrate, kind);

  useEffect(() => {
    void AudioModule.getRecordingPermissionsAsync().then(p => { session.granted = p.granted; }).catch(() => {});
    return () => { if (session.tipTimer) clearTimeout(session.tipTimer); };
  }, [session]);

  const showTip = () => {
    setTip(true); v.tip.setValue(0);
    Animated.timing(v.tip, { toValue: 1, duration: ms(180), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (session.tipTimer) clearTimeout(session.tipTimer);
    session.tipTimer = setTimeout(() => Animated.timing(v.tip, { toValue: 0, duration: ms(220), useNativeDriver: true }).start(() => setTip(false)), 2200);
  };
  const askPermission = async () => {
    try {
      const answer = await AudioModule.requestRecordingPermissionsAsync();
      session.granted = answer.granted;
      if (!answer.granted) live.current.onError('Permita o microfone nas configuracoes para gravar audio.');
    } catch { live.current.onError('Nao foi possivel pedir acesso ao microfone.'); }
  };
  // stopTogether=false: ao trocar o botão, um valor sem componente ligado para sozinho sem derrubar os demais.
  const release = () => Animated.parallel([
    Animated.spring(v.press, { toValue: 0, friction: 7, tension: 160, useNativeDriver: true }),
    Animated.spring(v.tx, { toValue: 0, friction: 8, tension: 140, useNativeDriver: true }),
    Animated.spring(v.ty, { toValue: 0, friction: 8, tension: 140, useNativeDriver: true }),
  ], { stopTogether: false }).start();
  const closeBar = () => Animated.timing(v.bar, { toValue: 0, duration: ms(190), easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
    if (live.current.phase === 'closing' || live.current.phase === 'deleting') setPhase('idle');
  });

  const begin = () => {
    if (live.current.disabled || live.current.phase !== 'idle') return;
    if (session.granted !== true) { void askPermission(); return; }
    const id = ++session.id;
    session.axis = null; live.current.armed = false; setArmed(false); setPaused(false);
    v.tx.setValue(0); v.ty.setValue(0); v.lock.setValue(0); v.pop.setValue(0);
    setPhase('hold'); feel('medium');
    Animated.parallel([
      Animated.timing(v.bar, { toValue: 1, duration: ms(230), easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(v.press, { toValue: 1, friction: 6, tension: 170, useNativeDriver: true }),
    ], { stopTogether: false }).start();
    live.current.stopPlayback();
    session.ready = (async () => {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(OPTIONS);
      // Soltou antes de o microfone abrir: nada a gravar.
      if (session.id !== id || live.current.phase === 'closing' || live.current.phase === 'deleting') return false;
      recorder.record(); session.startedAt = Date.now();
      return true;
    })().catch(() => {
      if (session.id === id && (live.current.phase === 'hold' || live.current.phase === 'locked')) {
        setPhase('closing'); release(); closeBar(); live.current.onError('Nao foi possivel iniciar a gravacao.');
      }
      return false;
    });
  };

  const end = async (keep: boolean) => {
    if (live.current.phase !== 'hold' && live.current.phase !== 'locked') return;
    const wasLocked = live.current.phase === 'locked';
    setPhase(keep ? 'closing' : 'deleting');
    if (keep) { closeBar(); feel('light'); }
    release();
    if (wasLocked) Animated.timing(v.pop, { toValue: 0, duration: ms(140), useNativeDriver: true }).start();
    const started = await session.ready;
    let uri: string | null = null, length = 0;
    if (started) {
      try {
        length = recorder.getStatus().durationMillis || Date.now() - session.startedAt;
        await recorder.stop(); uri = recorder.uri;
      } catch { /* gravador já parado */ }
    }
    try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* sem efeito para o envio */ }
    if (!keep) return;
    if (!uri || length < MIN_MS) { feel('warning'); showTip(); return; }
    const file: LocalChatFile = { uri, name: Platform.OS === 'web' ? 'audio.webm' : 'audio.m4a', contentType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4' };
    void live.current.send(file).catch(error => live.current.onError(String(error)));
  };

  const lockRecording = () => {
    if (live.current.phase !== 'hold') return;
    setPhase('locked'); setArmed(false); live.current.armed = false; feel('heavy');
    Animated.parallel([
      Animated.spring(v.pop, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
      Animated.spring(v.press, { toValue: 0, friction: 7, tension: 160, useNativeDriver: true }),
      Animated.spring(v.tx, { toValue: 0, useNativeDriver: true }),
      Animated.spring(v.ty, { toValue: 0, useNativeDriver: true }),
    ], { stopTogether: false }).start();
  };
  const move = (dx: number, dy: number) => {
    if (live.current.phase !== 'hold') return;
    if (!session.axis) { if (Math.hypot(dx, dy) < 10) return; session.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'; }
    if (session.axis === 'x') {
      const x = Math.min(0, dx); v.tx.setValue(x); v.ty.setValue(0);
      const arm = x <= -CANCEL_DISTANCE;
      if (arm !== live.current.armed) { live.current.armed = arm; setArmed(arm); feel('light'); }
    } else {
      const y = Math.min(0, dy); v.ty.setValue(y); v.tx.setValue(0); v.lock.setValue(Math.min(1, -y / LOCK_DISTANCE));
      if (-y >= LOCK_DISTANCE) lockRecording();
    }
  };
  const act = useRef({ begin, move, end });
  act.current = { begin, move, end };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.disabled && live.current.phase === 'idle',
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => act.current.begin(),
    onPanResponderMove: (_, g) => act.current.move(g.dx, g.dy),
    onPanResponderRelease: () => { if (live.current.phase === 'hold') void act.current.end(!live.current.armed); },
    onPanResponderTerminate: () => { if (live.current.phase === 'hold') void act.current.end(false); },
  }), []);

  useEffect(() => {
    const listener = AppState.addEventListener('change', next => {
      if (next !== 'active' && (live.current.phase === 'hold' || live.current.phase === 'locked')) {
        void act.current.end(false); live.current.onError('Gravacao interrompida. Grave novamente para enviar.');
      }
    });
    return () => {
      listener.remove();
      try { if (live.current.phase === 'hold' || live.current.phase === 'locked') void recorder.stop().catch(() => undefined); } catch { /* já liberado */ }
    };
  }, [recorder]);

  const togglePause = () => {
    try { if (paused) { recorder.record(); setPaused(false); } else { recorder.pause(); setPaused(true); } feel('light'); } catch { /* estado do gravador mudou */ }
  };
  const dim = disabled ? .5 : 1;
  return <>
    {phase !== 'idle' && <RecordingBar recorder={recorder} phase={phase} armed={armed} paused={paused} v={v} still={wa.reducedMotion}
      onTrash={() => void end(false)} onPause={togglePause} onLimit={() => void end(true)} onFlightEnd={closeBar} onThud={() => feel('warning')} />}
    <View style={{ width: BUTTON, height: BUTTON, zIndex: 20 }}>
      {tip && <Animated.View pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: BUTTON + 12, width: 236, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: wa.dark ? '#e9eef7' : '#17202e', opacity: v.tip, transform: [{ translateY: v.tip.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 13, color: wa.dark ? '#17202e' : '#ffffff' }}>Segure para gravar, solte para enviar</Text>
      </Animated.View>}
      {phase === 'hold' && <LockHint v={v} />}
      {phase === 'hold' && <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, backgroundColor: wa.send + '33', opacity: v.press, transform: [{ translateX: v.tx }, { translateY: v.ty }, { scale: v.press.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }] }} />}
      {phase === 'locked'
        ? <Animated.View style={{ transform: [{ scale: v.pop.interpolate({ inputRange: [0, 1], outputRange: [.6, 1] }) }], opacity: v.pop }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Enviar áudio" onPress={() => void end(true)} style={({ pressed }) => ({ width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, backgroundColor: wa.send, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .85 : 1, boxShadow: '0 1px 2px #0000002e' })}><Send size={20} color="#fff" /></Pressable>
        </Animated.View>
        : <Animated.View {...pan.panHandlers} accessible accessibilityRole="button" accessibilityLabel="Gravar áudio. Segure para gravar e solte para enviar"
          accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={showTip}
          style={{ width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, backgroundColor: wa.send, alignItems: 'center', justifyContent: 'center', opacity: dim, boxShadow: '0 1px 2px #0000002e', transform: [{ translateX: v.tx }, { translateY: v.ty }, { scale: v.press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }] }}>
          <Mic size={22} color="#fff" />
        </Animated.View>}
    </View>
  </>;
}

type Values = { bar: Animated.Value; press: Animated.Value; tx: Animated.Value; ty: Animated.Value; lock: Animated.Value; pop: Animated.Value; tip: Animated.Value };

/** Cadeado acima do botão: encolhe conforme o dedo sobe e some ao travar. */
function LockHint({ v }: { v: Values }) {
  const wa = useWa(), [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (wa.reducedMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob, wa.reducedMotion]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', right: 4, bottom: BUTTON + 40, width: 40, opacity: v.press, transform: [{ translateY: v.press.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
    <Animated.View style={{ height: v.lock.interpolate({ inputRange: [0, 1], outputRange: [92, 54] }), borderRadius: 20, backgroundColor: wa.header, alignItems: 'center', paddingTop: 12, gap: 8, boxShadow: '0 2px 6px #00000033' }}>
      <Lock size={17} color={wa.meta} />
      <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) }], opacity: v.lock.interpolate({ inputRange: [0, .8], outputRange: [1, 0] }) }}><ChevronUp size={20} color={wa.meta} /></Animated.View>
    </Animated.View>
  </Animated.View>;
}

/** Barra que ocupa o lugar do campo de texto enquanto grava. */
function RecordingBar({ recorder, phase, armed, paused, v, still, onTrash, onPause, onLimit, onFlightEnd, onThud }: {
  recorder: AudioRecorder; phase: Phase; armed: boolean; paused: boolean; v: Values; still: boolean;
  onTrash: () => void; onPause: () => void; onLimit: () => void; onFlightEnd: () => void; onThud: () => void;
}) {
  const wa = useWa(), [blink] = useState(() => new Animated.Value(0)), [view, setView] = useState({ ms: 0, bars: [] as number[] });
  const width = useRef(0), levels = useRef<number[]>([]), limited = useRef(false), count = useRef(12);
  const danger = wa.dark ? '#ff7a6b' : '#e5433a';
  useEffect(() => {
    const timer = setInterval(() => {
      let status; try { status = recorder.getStatus(); } catch { return; }
      if (status.isRecording) {
        // Entre -52 dB (silêncio) e -8 dB (voz próxima): o volume real que chega ao microfone.
        const raw = typeof status.metering === 'number' ? Math.max(0, Math.min(1, (status.metering + 52) / 44)) : 0;
        const last = levels.current[levels.current.length - 1] ?? 0;
        levels.current.push(raw > last ? raw : last * .55 + raw * .45);
        if (levels.current.length > 90) levels.current.shift();
      }
      setView({ ms: status.durationMillis, bars: levels.current.slice(-count.current) });
      if (status.durationMillis >= MAX_MS && !limited.current) { limited.current = true; onLimit(); }
    }, 90);
    return () => clearInterval(timer);
  }, [recorder, onLimit]);
  useEffect(() => {
    if (still || paused || (phase !== 'hold' && phase !== 'locked')) { blink.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [blink, phase, paused, still]);
  const deleting = phase === 'deleting', locked = phase === 'locked';
  const dot = { opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [1, .25] }) };
  return <Animated.View pointerEvents={deleting || phase === 'closing' ? 'none' : 'auto'} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: BUTTON + GAP, minHeight: BUTTON, borderRadius: 24, backgroundColor: wa.field, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, boxShadow: '0 1px 1px #0000001a', opacity: v.bar, transform: [{ translateX: v.bar.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) }] }}>
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      {deleting ? <TrashFlight color={danger} still={still} onEnd={onFlightEnd} onThud={onThud} />
        : locked ? <Pressable accessibilityRole="button" accessibilityLabel="Descartar áudio" onPress={onTrash} hitSlop={6} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Trash2 size={22} color={danger} /></Pressable>
        : armed ? <Trash2 size={22} color={danger} /> : <Animated.View style={dot}><Mic size={22} color={danger} fill={danger} /></Animated.View>}
    </View>
    {!deleting && <>
      <Text accessibilityLabel={'Gravando ' + clock(view.ms)} style={{ width: 44, fontFamily: 'Manrope', fontWeight: '700', fontSize: 15, color: wa.ink, fontVariant: ['tabular-nums'] }}>{clock(view.ms)}</Text>
      <View onLayout={e => { width.current = e.nativeEvent.layout.width; count.current = Math.max(6, Math.min(60, Math.floor(width.current / BAR_PITCH))); }} style={{ flex: 1, minWidth: 40, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: BAR_PITCH - 3, overflow: 'hidden' }}>
        {view.bars.map((level, i) => <View key={i} style={{ width: 3, height: 3 + Math.pow(level, .8) * 24, borderRadius: 2, backgroundColor: danger, opacity: paused ? .35 : .55 + level * .45 }} />)}
      </View>
      {locked
        ? <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Continuar gravação' : 'Pausar gravação'} onPress={onPause} hitSlop={6} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>{paused ? <Mic size={22} color={danger} /> : <Pause size={22} color={wa.meta} fill={wa.meta} />}</Pressable>
        : <Animated.View pointerEvents="none" style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 8, opacity: v.tx.interpolate({ inputRange: [-CANCEL_DISTANCE, -20, 0], outputRange: [0, .85, 1], extrapolate: 'clamp' }), transform: [{ translateX: v.tx.interpolate({ inputRange: [-CANCEL_DISTANCE, 0], outputRange: [-36, 0], extrapolate: 'clamp' }) }] }}>
          <ChevronLeft size={18} color={wa.meta} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: 'Manrope', fontWeight: '600', fontSize: 13.5, color: wa.meta }}>Deslize para cancelar</Text>
        </Animated.View>}
    </>}
  </Animated.View>;
}

/** O microfone sobe, gira e cai na lixeira, que balança ao receber o áudio descartado. */
function TrashFlight({ color, still, onEnd, onThud }: { color: string; still: boolean; onEnd: () => void; onThud: () => void }) {
  const [a] = useState(() => ({ rise: new Animated.Value(0), fall: new Animated.Value(0), trash: new Animated.Value(0), wobble: new Animated.Value(0) }));
  const callbacks = useRef({ onEnd, onThud }); callbacks.current = { onEnd, onThud };
  useEffect(() => {
    let alive = true;
    const d = (value: number) => still ? 0 : value;
    const wobble = (to: number, duration: number) => Animated.timing(a.wobble, { toValue: to, duration: d(duration), easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    Animated.parallel([
      Animated.timing(a.rise, { toValue: 1, duration: d(330), easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([Animated.delay(d(110)), Animated.spring(a.trash, { toValue: 1, friction: 6, tension: 150, useNativeDriver: true })]),
    ]).start(() => {
      if (!alive) return;
      Animated.timing(a.fall, { toValue: 1, duration: d(250), easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
        if (!alive) return;
        callbacks.current.onThud();
        Animated.sequence([wobble(1, 70), wobble(-1, 110), wobble(.5, 90), wobble(0, 80), Animated.delay(d(140)), Animated.timing(a.trash, { toValue: 0, duration: d(160), useNativeDriver: true })])
          .start(() => { if (alive) callbacks.current.onEnd(); });
      });
    });
    return () => { alive = false; };
  }, [a, still]);
  const travel = Animated.add(a.rise, a.fall);
  return <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={{ position: 'absolute', opacity: a.trash, transform: [{ scale: a.trash }, { rotate: a.wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] }) }] }}><Trash2 size={22} color={color} /></Animated.View>
    <Animated.View style={{ position: 'absolute', opacity: a.fall.interpolate({ inputRange: [0, .8, 1], outputRange: [1, 1, 0] }), transform: [
      { translateY: Animated.add(Animated.multiply(a.rise, -44), Animated.multiply(a.fall, 44)) },
      { rotate: travel.interpolate({ inputRange: [0, 1, 2], outputRange: ['0deg', '-140deg', '-360deg'] }) },
      { scale: a.fall.interpolate({ inputRange: [0, 1], outputRange: [1, .35] }) }] }}><Mic size={22} color={color} fill={color} /></Animated.View>
  </View>;
}
