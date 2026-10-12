import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { useChatOutbox } from '../useChatOutbox';
import { ChatNotices } from '../ChatNotices';
import { useAppForeground } from '../../hooks/useAppForeground';
import { listChatNotifications, sendChat } from '../../../services/communicationApi';
import { registerChatPush } from '../push';

jest.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: jest.fn() }, Platform: { OS: 'android' },
  Animated: { Value: class { setValue() {} } }, AccessibilityInfo: {}, Pressable: 'Pressable', Text: 'Text', View: 'View', Vibration: {} }));
jest.mock('expo-router/react-navigation', () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null, setItem: async () => {} }));
jest.mock('expo-router', () => { const router = { push: jest.fn() }; return { useRouter: () => router }; });
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-audio', () => { const player = { pause: jest.fn() }; return { useAudioPlayer: () => player }; });
jest.mock('lucide-react-native', () => ({ AtSign: () => null, MessageCircle: () => null, X: () => null }));
jest.mock('expo-notifications', () => ({ addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }) }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '7' }, estabelecimentoAtual: { id: 'loja' } }) }));
jest.mock('../../contexts/OperationalSessionContext', () => ({ useOperationalSession: () => ({ session: { sessionId: 'turno' }, queue: { motoboyId: 1 } }) }));
jest.mock('../../ui/theme', () => { const theme = { sound: false, vibration: false }; return { useZippyTheme: () => theme }; });
jest.mock('../../../services/chatEvents', () => ({ subscribeChatEvents: () => () => {} }));
jest.mock('../push', () => ({ registerChatPush: jest.fn(async () => {}) }));
jest.mock('../storage', () => ({ readChatStorage: async () => null, writeChatStorage: async () => {} }));
jest.mock('../../../utils/secureStorage', () => ({ getSecureItem: async key => ({ operationalAccessToken: 'token', operationalSession: '{"sessionId":"turno"}', operationalUserId: '7' })[key] }));
jest.mock('../../../services/communicationApi', () => ({ listChatNotifications: jest.fn(async () => []), uploadChat: jest.fn(), sendChat: jest.fn(async (_, request) => ({ clientId: request.clientId, id: request.clientId })) }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'fetch', { value: jest.fn(), configurable: true, writable: true });
let renderer, value;
const listeners = new Set();
const originalDocument = globalThis.document;
function Outbox() { value = useChatOutbox('7:loja', 'turno', () => {}); return null; }
function Foreground() { value = useAppForeground(); return null; }
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); AppState.currentState = 'active'; Platform.OS = 'android';
  useIsFocused.mockReturnValue(true);
  AppState.addEventListener.mockImplementation((_, listener) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount()); renderer = null; listeners.clear(); jest.useRealTimers();
  globalThis.document = originalDocument;
});
async function mount(Component) { await act(async () => { renderer = create(<Component />); }); }
async function state(next) { await act(async () => { AppState.currentState = next; listeners.forEach(listener => listener(next)); }); }
async function enqueue(id) { await act(async () => { await value.outbox.enqueue({ target: { channel: 'group' }, request: { clientId: id, body: 'Oi', mentions: [] }, state: 'queued', createdAtUtc: new Date().toISOString() }); }); }

test('fila para a reserva no background e envia imediatamente ao retornar, preservando a mensagem', async () => {
  await mount(Outbox); expect(value.ready).toBe(true);
  await enqueue('mensagem-1');
  await act(async () => { jest.advanceTimersByTime(59999); }); expect(sendChat).not.toHaveBeenCalled();
  await state('background');
  await act(async () => { jest.advanceTimersByTime(180000); }); expect(sendChat).not.toHaveBeenCalled();
  expect(value.entries).toHaveLength(1);
  await state('active'); expect(sendChat).toHaveBeenCalledTimes(1); expect(value.entries).toHaveLength(0);
});

test('fila não tenta enviar em tela sem foco e retoma uma vez quando o foco volta', async () => {
  await mount(Outbox); await enqueue('mensagem-2');
  useIsFocused.mockReturnValue(false); await act(async () => renderer.update(<Outbox />));
  await act(async () => { jest.advanceTimersByTime(120000); }); expect(sendChat).not.toHaveBeenCalled();
  useIsFocused.mockReturnValue(true); await act(async () => renderer.update(<Outbox />));
  expect(sendChat).toHaveBeenCalledTimes(1);
});

test('avisos e registro push usam sessenta segundos e suspendem consultas em segundo plano', async () => {
  await mount(ChatNotices);
  expect(listChatNotifications).toHaveBeenCalledTimes(1); expect(registerChatPush).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(59999); }); expect(listChatNotifications).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(1); }); expect(listChatNotifications).toHaveBeenCalledTimes(2);
  await state('background');
  await act(async () => { jest.advanceTimersByTime(180000); }); expect(listChatNotifications).toHaveBeenCalledTimes(2);
  await state('active'); expect(listChatNotifications).toHaveBeenCalledTimes(3);
});

test('aba web oculta suspende atividade mesmo quando AppState continua active', async () => {
  Platform.OS = 'web'; const webListeners = new Set();
  globalThis.document = { visibilityState: 'visible', addEventListener: (_, listener) => webListeners.add(listener), removeEventListener: (_, listener) => webListeners.delete(listener) };
  await mount(Foreground); expect(value).toBe(true);
  await act(async () => { document.visibilityState = 'hidden'; webListeners.forEach(listener => listener()); }); expect(value).toBe(false);
  await act(async () => { document.visibilityState = 'visible'; webListeners.forEach(listener => listener()); }); expect(value).toBe(true);
});
