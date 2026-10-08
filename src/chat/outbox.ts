import type {
  ChatMessage,
  ChatRequest,
  ChatTarget,
  LocalChatFile,
} from '../../services/communicationApi';

export type ChatPending = {
  target: ChatTarget;
  request: ChatRequest;
  file?: LocalChatFile;
  createdAtUtc: string;
  state: 'queued' | 'sending' | 'failed';
  error?: string;
};
export type OutboxPorts = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  upload: (target: ChatTarget, file: LocalChatFile) => Promise<string>;
  send: (target: ChatTarget, request: ChatRequest) => Promise<ChatMessage>;
  current: () => boolean;
  confirmed: (message: ChatMessage, target: ChatTarget) => void;
};

// Persistir antes de enviar; o mesmo clientId acompanha todas as tentativas.
export function createChatOutbox(ports: OutboxPorts) {
  let entries: ChatPending[] = [],
    ready = false,
    stopped = false;
  let operation: Promise<void> | null = null;
  let writes = Promise.resolve();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const save = () => {
    const raw = JSON.stringify({ version: 1, entries });
    writes = writes.catch(() => undefined).then(() => ports.write(raw));
    return writes;
  };
  const active = () => !stopped && ports.current();
  const store = {
    snapshot: () => entries,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async restore() {
      stopped = false;
      const raw = await ports.read();
      if (!active()) return;
      if (raw) {
        const data = JSON.parse(raw) as {
          version?: number;
          entries?: ChatPending[];
        };
        if (
          data.version !== 1 ||
          !Array.isArray(data.entries) ||
          data.entries.some(
            (item) =>
              !item.request?.clientId ||
              !['store', 'group', 'private', 'client'].includes(
                item.target?.channel,
              ),
          )
        )
          throw new Error(
            'Fila de mensagens invalida. Nenhum envio foi feito.',
          );
        entries = data.entries.map((item) => ({
          ...item,
          state: item.state === 'sending' ? 'queued' : item.state,
        }));
      }
      ready = true;
      notify();
    },
    async enqueue(entry: ChatPending) {
      if (!ready || !active())
        throw new Error('Aguarde recuperar a fila de mensagens.');
      if (entries.length >= 100)
        throw new Error(
          'A fila possui 100 mensagens. Reenvie ou remova as pendentes.',
        );
      const previous = entries;
      entries = [...entries, entry];
      try {
        await save();
      } catch (error) {
        entries = previous;
        throw error;
      }
      notify();
    },
    async retry(id: string) {
      if (!active() || !ready || operation) return;
      entries = entries.map((item) =>
        item.request.clientId === id
          ? { ...item, state: 'queued', error: undefined }
          : item,
      );
      await save();
      notify();
      await store.flush();
    },
    async remove(id: string) {
      if (!active() || !ready || operation) return;
      entries = entries.filter((item) => item.request.clientId !== id);
      await save();
      notify();
    },
    flush(): Promise<void> {
      if (operation) return operation;
      if (!ready || !active()) return Promise.resolve();
      operation = (async () => {
        for (const id of entries
          .filter((item) => item.state === 'queued')
          .map((item) => item.request.clientId)) {
          if (!active()) break;
          let item = entries.find((entry) => entry.request.clientId === id)!;
          try {
            item = { ...item, state: 'sending', error: undefined };
            entries = entries.map((entry) =>
              entry.request.clientId === id ? item : entry,
            );
            await save();
            notify();
            if (!active()) break;
            if (item.file && !item.request.attachmentId) {
              const attachmentId = await ports.upload(item.target, item.file);
              if (!active()) break;
              item = { ...item, request: { ...item.request, attachmentId } };
              entries = entries.map((entry) =>
                entry.request.clientId === id ? item : entry,
              );
              await save();
            }
            if (!active()) break;
            const message = await ports.send(item.target, item.request);
            if (!active()) break;
            if (message.clientId !== id)
              throw new Error('Confirmacao do envio invalida.');
            entries = entries.filter((entry) => entry.request.clientId !== id);
            await save();
            notify();
            ports.confirmed(message, item.target);
          } catch (error) {
            if (!active()) break;
            entries = entries.map((entry) =>
              entry.request.clientId === id
                ? {
                    ...entry,
                    state: 'failed',
                    error:
                      error instanceof Error
                        ? error.message
                        : 'Envio nao confirmado.',
                  }
                : entry,
            );
            await save();
            notify();
            break;
          }
        }
      })().finally(() => {
        operation = null;
      });
      return operation;
    },
    stop() {
      stopped = true;
      listeners.clear();
    },
  };
  return store;
}
