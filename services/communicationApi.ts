import { Platform } from 'react-native';
import { apiClient } from './apiService';
import { unwrap } from './mobileApi';

export type ChatChannel = 'store' | 'group' | 'private' | 'client';
export type ChatTarget = {
  channel: ChatChannel;
  target?: number;
  pedidoId?: number;
};
export type ChatAttachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
};
export type ChatMessage = {
  id: string;
  sequence: number;
  channel: ChatChannel;
  threadKey: string;
  clientId?: string;
  body: string;
  senderName: string;
  senderKey: string;
  motoboyId?: number;
  recipientId?: number;
  mine: boolean;
  createdAtUtc: string;
  readCount: number;
  read: boolean;
  mentioned: boolean;
  mentions: number[];
  attachment?: ChatAttachment;
  replyTo?: string;
  replyBody?: string;
  replySender?: string;
  reactions: { reaction: string; count: number; mine: boolean }[];
};
export type ChatPage = {
  messages: ChatMessage[];
  cursor?: number;
  hasMore: boolean;
};
export type ChatRequest = {
  clientId: string;
  body: string;
  attachmentId?: string;
  replyTo?: string;
  mentions: number[];
  pedidoId?: number;
};
export type ChatContact = {
  motoboyId: number;
  nome: string;
  avatar?: string;
  online: boolean;
};
export type LocalChatFile = { uri: string; name: string; contentType: string };
const root = '/v2/motoboys/me/session/chat';
export const listChat = async (
  target: ChatTarget,
  options: { before?: number; search?: string; signal?: AbortSignal } = {},
): Promise<ChatPage> =>
  unwrap(
    await apiClient.get(`${root}/${target.channel}/messages`, {
      signal: options.signal,
      params: {
        target: target.target,
        pedidoId: target.pedidoId,
        before: options.before,
        search: options.search,
        limit: 50,
      },
    }),
  );
export const sendChat = async (
  target: ChatTarget,
  request: ChatRequest,
  token?: string,
): Promise<ChatMessage> =>
  unwrap(
    await apiClient.post(
      target.channel === 'client'
        ? `/v2/motoboys/me/session/orders/${target.pedidoId}/client-chat`
        : `${root}/${target.channel}/messages`,
      request,
      {
        params: { target: target.target },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    ),
  );
export const readChat = async (
  target: ChatTarget,
  through: number,
): Promise<void> => {
  unwrap(
    await apiClient.post(
      `${root}/${target.channel}/read`,
      { through },
      { params: { target: target.target } },
    ),
  );
};
export const reactChat = async (
  target: ChatTarget,
  id: string,
  reaction: string | null,
): Promise<void> => {
  unwrap(
    await apiClient.put(
      `${root}/${target.channel}/messages/${id}/reaction`,
      { reaction },
      { params: { target: target.target } },
    ),
  );
};
export const listChatContacts = async (): Promise<ChatContact[]> =>
  unwrap(await apiClient.get('/v2/motoboys/me/session/contacts'));
export const listChatNotifications = async (): Promise<ChatMessage[]> =>
  unwrap(await apiClient.get(`${root}/notifications`));
export const dismissChatNotification = async (id: string): Promise<void> => {
  unwrap(await apiClient.post(`${root}/notifications/${id}/read`));
};
export async function uploadChat(
  target: ChatTarget,
  file: LocalChatFile,
  token?: string,
): Promise<ChatAttachment> {
  const form = new FormData();
  if (Platform.OS === 'web')
    form.append('file', await (await fetch(file.uri)).blob(), file.name);
  else
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.contentType,
    } as unknown as Blob);
  return unwrap(
    await apiClient.post(`${root}/${target.channel}/attachments`, form, {
      params: {
        target: target.channel === 'client' ? target.pedidoId : target.target,
      },
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 60000,
    }),
  );
}
export type ClientRichChat = {
  channel: {
    pedidoId: number;
    clienteNome?: string;
    podeReceber: boolean;
    motivo?: string;
  };
  messages: {
    id: string;
    body: string;
    type: string;
    status: string;
    createdAtUtc: string;
    mine: boolean;
    attachment?: ChatAttachment;
    replyTo?: string;
  }[];
  hasMore: boolean;
  cursor?: string;
};
export const listClientChat = async (
  pedidoId: number,
  before?: string,
  signal?: AbortSignal,
): Promise<ClientRichChat> =>
  unwrap(
    await apiClient.get(
      `/v2/motoboys/me/session/orders/${pedidoId}/client-chat`,
      { params: { before, limit: 50 }, signal },
    ),
  );
export async function chatAttachmentData(id: string): Promise<string> {
  const response = await apiClient.get(`${root}/attachments/${id}`, {
    responseType: 'blob',
  });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nao foi possivel abrir o anexo.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(response.data as Blob);
  });
}
