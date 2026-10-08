export type ChatEvent = {
  estabelecimentoId: string;
  threadKey: string;
  channel: string;
  action: string;
  messageId?: string;
  version: number;
};
const listeners = new Set<(event: ChatEvent) => void>();
export const emitChatEvent = (event: ChatEvent) =>
  listeners.forEach((listener) => listener(event));
export const subscribeChatEvents = (listener: (event: ChatEvent) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
