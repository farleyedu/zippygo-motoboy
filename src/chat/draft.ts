import type { ChatContact } from "../../services/communicationApi";

export const encodeChatDraft = (
  body: string,
  mentions: ChatContact[],
): string => JSON.stringify({ version: 1, body, mentions });

export function decodeChatDraft(raw: string | null): {
  body: string;
  mentions: ChatContact[];
} {
  if (!raw) return { body: "", mentions: [] };
  try {
    const value = JSON.parse(raw);
    if (
      value?.version === 1 &&
      typeof value.body === "string" &&
      Array.isArray(value.mentions)
    )
      return {
        body: value.body,
        mentions: value.mentions.filter(
          (m: ChatContact) =>
            Number.isSafeInteger(m?.motoboyId) &&
            m.motoboyId > 0 &&
            typeof m.nome === "string",
        ),
      };
  } catch {
    /* Rascunhos antigos continham apenas texto. */
  }
  return { body: raw, mentions: [] };
}

export function mentionedIds(body: string, mentions: ChatContact[]): number[] {
  return [
    ...new Set(
      mentions
        .filter((m) => {
          const name = m.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`@${name}(?=$|[\\s.,!?;:])`, "u").test(body);
        })
        .map((m) => m.motoboyId),
    ),
  ];
}
