import type { ChatMessage } from '../../services/communicationApi';
export type ChatNoticeSettings = { muted: boolean; mentionAlerts: boolean };
export function priorityNotice(
  messages: ChatMessage[],
  watermark: number,
  settings: ChatNoticeSettings,
) {
  const fresh = messages.filter(
    (m) => !m.mine && m.sequence > watermark && !m.read,
  );
  const mentions = fresh.filter((m) => m.mentioned);
  const notice =
    mentions[0] ?? fresh.find((m) => m.channel !== 'group' || !settings.muted);
  return {
    watermark: Math.max(watermark, ...messages.map((m) => m.sequence)),
    notice,
    audible:
      !!notice &&
      (notice.mentioned
        ? settings.mentionAlerts
        : notice.channel !== 'group' || !settings.muted),
  };
}
