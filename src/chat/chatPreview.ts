// Última mensagem vista de cada conversa, para a lista mostrar prévia e horário como o WhatsApp.
export type ChatPreview = { text: string; at: number; mine: boolean };
const previews = new Map<string, ChatPreview>();
export const previewKey = (owner: string | null, kind: string, id?: number | string) => `${owner}:${kind}:${id ?? ''}`;
export const getPreview = (key: string) => previews.get(key);

type Source = { body?: string | null; attachment?: { contentType: string } | null; mine: boolean; senderName?: string; createdAtUtc: string };
export function describeMessage(message: Source, group: boolean): ChatPreview {
  const media = message.attachment ? message.attachment.contentType.startsWith('audio/') ? '🎤 Mensagem de voz' : '📷 Foto' : '';
  const content = message.body?.trim() || media || 'Mensagem';
  const prefix = message.mine ? 'Você: ' : group && message.senderName ? `${message.senderName.split(' ')[0]}: ` : '';
  return { text: prefix + content, at: Date.parse(message.createdAtUtc) || 0, mine: message.mine };
}
export function rememberPreview(key: string, message: Source | undefined, group: boolean) {
  if (!message) return;
  const next = describeMessage(message, group), current = previews.get(key);
  if (current && current.at > next.at) return;
  if (previews.size >= 80) previews.delete(previews.keys().next().value as string);
  previews.delete(key); previews.set(key, next);
}

export function listTime(at: number, now = new Date()) {
  if (!at) return '';
  const date = new Date(at), start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86400000);
  if (days <= 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Ontem';
  if (days < 7) return date.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^./, c => c.toUpperCase());
  return date.toLocaleDateString('pt-BR');
}
