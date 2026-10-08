import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecureItem } from '../../utils/secureStorage';
import {
  ChatMessage,
  ChatTarget,
  sendChat,
  uploadChat,
} from '../../services/communicationApi';
import { createChatOutbox } from './outbox';
import { readChatStorage, writeChatStorage } from './storage';

export function useChatOutbox(
  owner: string | null,
  sessionId: string | undefined,
  confirmed: (message: ChatMessage, target: ChatTarget) => void,
) {
  const current = useRef({ owner, sessionId });
  current.current = { owner, sessionId };
  const callback = useRef(confirmed);
  callback.current = confirmed;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const outbox = useMemo(() => {
    const key = `zippygo.chat.outbox.v1:${owner}`;
    const token = async () => {
      const [access, raw, savedOwner] = await Promise.all(
        [
          'operationalAccessToken',
          'operationalSession',
          'operationalUserId',
        ].map(getSecureItem),
      );
      const session = raw ? (JSON.parse(raw) as { sessionId?: string }) : null;
      if (
        !access ||
        session?.sessionId !== sessionId ||
        owner?.split(':')[0] !== savedOwner ||
        current.current.owner !== owner ||
        current.current.sessionId !== sessionId
      )
        throw new Error('O acesso mudou. Retome o envio neste turno.');
      return access;
    };
    return createChatOutbox({
      read: () => readChatStorage(key),
      write: (value) => writeChatStorage(key, value),
      current: () =>
        !!owner &&
        !!sessionId &&
        current.current.owner === owner &&
        current.current.sessionId === sessionId,
      upload: async (target, file) =>
        (await uploadChat(target, file, await token())).id,
      send: async (target, request) => sendChat(target, request, await token()),
      confirmed: (message, target) => callback.current(message, target),
    });
  }, [owner, sessionId]);
  const entries = useSyncExternalStore(
    outbox.subscribe,
    outbox.snapshot,
    outbox.snapshot,
  );
  useEffect(() => {
    let alive = true;
    setReady(false);
    setError('');
    void outbox.restore().then(
      () => {
        if (alive) {
          setReady(!!owner && !!sessionId);
          void outbox.flush().catch((e) => setError(String(e)));
        }
      },
      (e) => {
        if (alive)
          setError(
            e instanceof Error
              ? e.message
              : 'Nao foi possivel recuperar as mensagens.',
          );
      },
    );
    const timer = setInterval(() => {
      void outbox.flush().catch((e) => {
        if (alive) setError(String(e));
      });
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
      outbox.stop();
    };
  }, [outbox, owner, sessionId]);
  return { outbox, entries, ready, error };
}
