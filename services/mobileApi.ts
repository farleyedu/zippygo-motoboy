import { AxiosResponse } from 'axios';
import { apiClient } from './apiService';
import { API_CONFIG } from '../config/apiConfig';
import { Pedido } from '../types/pedido';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secureStorage';
import { operationalRequests } from './operationalRequests';

export type EstablishmentLink = {
  estabelecimentoId: string;
  nome: string;
  tipoEstabelecimento?: string | null;
  statusVinculo?: string | null;
  statusEstabelecimento?: string | null;
  tipoAcesso?: string | null;
  isAtual?: boolean;
  modulosAtivos?: string[];
};

export type SelectedEstablishment = {
  id: string;
  nome: string;
  tipoEstabelecimento?: string | null;
  modulosAtivos?: string[];
  status?: string | null;
};

export type MotoboyAvailableEstablishment = {
  id: string;
  nome: string;
  cidade?: string | null;
  uf?: string | null;
  tipoEstabelecimento?: string | null;
  modulosAtivos?: string[] | null;
};

export type MotoboyLinkRequest = {
  id: string;
  motoboyId: number;
  estabelecimentoId: string;
  estabelecimentoNome: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  origem?: 'motoboy' | 'estabelecimento' | string;
  requestedAtUtc: string;
  reviewedAtUtc?: string | null;
  rejectionReason?: string | null;
  motoboyNome?: string | null;
  motoboyEmail?: string | null;
  motoboyTelefone?: string | null;
};

export type OperationalSession = {
  sessionId: string;
  epoch: number;
  origin: string;
  startedAtUtc: string;
  presenceExpiresAtUtc: string;
  heartbeatIntervalSeconds: number;
  version: number;
  isEnded: boolean;
  nextLocationSequence?: number;
  endedAtUtc?: string | null;
  endReason?: string | null;
};

export type OperationalTokenResponse = {
  establishmentId: string;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  motoboy: {
    id?: number;
    nome?: string;
  };
  session: OperationalSession;
};

export type OperationalHeartbeatResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  serverTimeUtc: string;
  session: OperationalSession;
};

export type DeliveryOrder = {
  id: number;
  nomeCliente?: string | null;
  telefoneCliente?: string | null;
  enderecoEntrega?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  items?: string | null;
  value?: number | null;
  tipoPagamento?: string | null;
  statusPagamento?: string | null;
  troco?: number | null;
  observacoes?: string | null;
  previsaoEntrega?: string | null;
  requerCodigoEntrega?: boolean;
};

export type RouteStop = {
  pedidoId: number;
  position: number;
  status: string;
  assignedAtUtc: string;
  pickedUpAtUtc?: string | null;
  arrivedAtUtc?: string | null;
  locked: boolean;
  pedido?: DeliveryOrder | null;
};

export type MotoboyOffer = {
  offerId?: string | null;
  offeredAtUtc: string;
  expiresAtUtc: string;
  timeoutMinutes: number;
  stops: RouteStop[];
};

export type MotoboyQueue = {
  paused?: boolean;
  motoboyId: number;
  estabelecimentoId: string;
  version: number;
  current?: RouteStop | null;
  next: RouteStop[];
  offer?: MotoboyOffer | null;
  routeState: string;
  returningSinceUtc?: string | null;
  politicas?: Record<string, unknown> | null;
};

export type OperationalLocationPayload = {
  sampleId: string;
  sequence: number;
  capturedAtUtc: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  speedMps?: number | null;
  headingDegrees?: number | null;
  trackingMode: 'online_idle' | 'active_route';
};

export type OperationalLocationAck = {
  sampleId: string;
  sequence: number;
  outcome: 'accepted' | 'duplicate' | 'stale' | 'rejected';
  updatedCurrent: boolean;
  sessionVersion: number;
  receivedAtUtc: string;
  code?: string;
};

export type OrderItemDetail = {
  produtoId?: string | null;
  nome: string;
  quantidade: number;
  precoUnitario?: number | null;
  observacao?: string | null;
  adicionais: { id?: string | null; nome: string; preco: number }[];
  total?: number | null;
  imagemUrl?: string | null;
};

export type OperationalOrderDetail = {
  id: number; queueVersion: number; position: number; stopStatus: string;
  isCurrent: boolean; isOffer: boolean; locked: boolean;
  assignedAtUtc: string; pickedUpAtUtc?: string | null; arrivedAtUtc?: string | null;
  origem: string; nomeCliente?: string | null; telefoneCliente?: string | null;
  enderecoEntrega?: string | null; rua?: string | null; numero?: string | null;
  bairro?: string | null; cidade?: string | null; estado?: string | null; cep?: string | null;
  latitude?: number | null; longitude?: number | null; total?: number | null;
  subtotal?: number | null; taxaEntrega?: number | null; formaPagamento?: string | null;
  statusPagamento?: string | null; troco?: number | null; observacoes?: string | null;
  previsaoEntrega?: string | null; requerCodigoEntrega: boolean;
  capaImagemUrl?: string | null; itens: OrderItemDetail[];
};

export async function getOperationalOrder(pedidoId: number, signal?: AbortSignal): Promise<OperationalOrderDetail> {
  const response = await apiClient.get(`/v2/motoboys/me/session/orders/${pedidoId}`, { signal });
  return unwrap<OperationalOrderDetail>(response);
}

export type StoreChatMessage = { id: number; motoboyId: number; pedidoId?: number | null; direction: 'operator' | 'motoboy'; body: string; createdAtUtc: string; readAtUtc?: string | null };
export type GroupChatMessage = { id: number; senderType: string; motoboyId?: number | null; motoboyNome?: string | null; body: string; createdAtUtc: string };
export type ClientChat = {
  channel: { pedidoId: number; clienteNome?: string | null; podeReceber: boolean; motivo?: string | null; janelaFimUtc?: string | null };
  messages: { id: string; body: string; type: string; status: string; createdAtUtc: string; mine: boolean }[];
  hasMore: boolean; cursor?: string | null;
};
const operationalPath = '/v2/motoboys/me/session';
export async function getStoreMessages(signal?: AbortSignal): Promise<StoreChatMessage[]> {
  return unwrap(await apiClient.get(`${operationalPath}/messages`, { signal, params: { limit: 100 } }));
}
export async function sendStoreMessage(body: string, pedidoId?: number): Promise<StoreChatMessage> {
  return unwrap(await apiClient.post(`${operationalPath}/messages`, { body, pedidoId }));
}
export async function markStoreMessagesRead(): Promise<void> { unwrap(await apiClient.post(`${operationalPath}/messages/read`)); }
export async function getGroupMessages(signal?: AbortSignal): Promise<GroupChatMessage[]> {
  return unwrap(await apiClient.get(`${operationalPath}/group-messages`, { signal, params: { limit: 100 } }));
}
export async function sendGroupMessage(body: string): Promise<GroupChatMessage> {
  return unwrap(await apiClient.post(`${operationalPath}/group-messages`, { body }));
}
export async function getClientMessages(pedidoId: number, signal?: AbortSignal): Promise<ClientChat> {
  return unwrap(await apiClient.get(`${operationalPath}/orders/${pedidoId}/client-messages`, { signal, params: { limit: 100 } }));
}
export async function sendClientMessage(pedidoId: number, mensagem: string): Promise<void> {
  unwrap(await apiClient.post(`${operationalPath}/orders/${pedidoId}/client-messages`, { mensagem }));
}

export class MobileApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'MobileApiError';
    this.status = status;
    this.code = code;
  }
}

function errorMessage(payload: any): string {
  if (typeof payload?.error === 'string') return payload.error;
  if (typeof payload?.message === 'string') return payload.message;
  if (typeof payload?.error?.message === 'string') return payload.error.message;
  if (payload?.errors && typeof payload.errors === 'object') {
    const messages = Object.values(payload.errors)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === 'string');
    if (messages.length > 0) return messages.join(' ');
  }
  if (typeof payload?.title === 'string') return payload.title;
  return 'Não foi possível concluir a operação.';
}

export function unwrap<T>(response: AxiosResponse<any>): T {
  const payload = response.data;
  if (response.status >= 400 || payload?.success === false) {
    throw new MobileApiError(errorMessage(payload), response.status, payload?.code ?? payload?.error?.code);
  }

  return (payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload) as T;
}

export async function registerMotoboy(payload: {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
}): Promise<{ userId: number; motoboyId: number; nome: string; email: string }> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.MOTOBOY_REGISTER, payload);
  return unwrap(response);
}

export async function listAvailableEstablishments(): Promise<MotoboyAvailableEstablishment[]> {
  const response = await apiClient.get(API_CONFIG.ENDPOINTS.MOTOBOY_AVAILABLE_ESTABLISHMENTS);
  const data = unwrap<MotoboyAvailableEstablishment[]>(response);
  return Array.isArray(data) ? data : [];
}

export async function listMotoboyLinkRequests(): Promise<MotoboyLinkRequest[]> {
  const response = await apiClient.get(API_CONFIG.ENDPOINTS.MOTOBOY_LINK_REQUESTS);
  const data = unwrap<MotoboyLinkRequest[]>(response);
  return Array.isArray(data) ? data : [];
}

export async function requestMotoboyLink(estabelecimentoId: string): Promise<MotoboyLinkRequest> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.MOTOBOY_REQUEST_LINK, { estabelecimentoId });
  return unwrap(response);
}

export async function acceptMotoboyInvite(id: string): Promise<void> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.MOTOBOY_ACCEPT_INVITE(id));
  unwrap(response);
}

export async function rejectMotoboyInvite(id: string): Promise<void> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.MOTOBOY_REJECT_INVITE(id));
  unwrap(response);
}

// Fonte única dos vínculos do motoboy (motoboy_estabelecimento ativo no backend).
export async function listMotoboyLinks(): Promise<EstablishmentLink[]> {
  const response = await apiClient.get(API_CONFIG.ENDPOINTS.MOTOBOY_LINKS);
  const data = unwrap<EstablishmentLink[]>(response);
  return Array.isArray(data) ? data : [];
}

export async function selectEstablishment(estabelecimentoId: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  estabelecimentoSelecionado: SelectedEstablishment;
}> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.SELECT_ESTABLISHMENT, { estabelecimentoId });
  return unwrap(response);
}

export async function startOperationalSession(options: { attemptId?: string; persist?: boolean } = {}): Promise<OperationalTokenResponse> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.OPERATIONAL_START, {
    attemptId: options.attemptId ?? createIdentifier(),
    clientInstanceId: await getClientInstanceId(),
  });
  const data = unwrap<OperationalTokenResponse>(response);
  if (options.persist !== false) await saveOperationalSession(data);
  return data;
}

export async function getOperationalSession(): Promise<OperationalSession | null> {
  const response = await apiClient.get(API_CONFIG.ENDPOINTS.OPERATIONAL_SESSION, { timeout: API_CONFIG.OPERATIONAL_SYNC_TIMEOUT });
  return unwrap<OperationalSession | null>(response);
}

export async function heartbeatOperationalSession(options: { persist?: boolean; token?: string; force?: boolean } = {}): Promise<OperationalHeartbeatResponse> {
  const token = options.token ?? await getSecureItem('operationalAccessToken');
  const data = await operationalRequests.heartbeat(token || '', async startedAt => {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.OPERATIONAL_HEARTBEAT, undefined, { timeout: API_CONFIG.OPERATIONAL_SYNC_TIMEOUT, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const confirmed = unwrap<OperationalHeartbeatResponse>(response);
    const raw = await getSecureItem('operationalSession');
    const currentToken = await getSecureItem('operationalAccessToken');
    if (raw && currentToken === token && !confirmed.session.isEnded) {
      let current: OperationalSession | null = null;
      try { current = JSON.parse(raw) as OperationalSession; } catch { /* Não perder o ACK por um dado local corrompido. */ }
      if (current?.sessionId === confirmed.session.sessionId && current.epoch === confirmed.session.epoch) {
        // Gravar só após ACK real; resposta reutilizada não adia a renovação.
        await setSecureItem(`tracking.heartbeat.v3.${current.sessionId}.${current.epoch}`, String(startedAt));
      }
    }
    return confirmed;
  }, options.force);
  const canPersist = options.persist !== false && await getSecureItem('operationalAccessToken') === token;
  if (canPersist) {
    const raw = await getSecureItem('operationalSession');
    let current: OperationalSession | null = null;
    try { current = raw ? JSON.parse(raw) : null; } catch { /* O ACK válido substitui o dado corrompido. */ }
    if (!current || (current.sessionId === data.session.sessionId && current.epoch === data.session.epoch && current.version <= data.session.version)) {
      await setSecureItem('operationalAccessToken', data.accessToken);
      await setSecureItem('operationalSession', JSON.stringify(data.session));
    }
  }
  return data;
}

export async function endOperationalSession(reason = 'client_end', options: { clear?: boolean } = {}): Promise<void> {
  const token = await getSecureItem('operationalAccessToken');
  if (token) {
    const response = await apiClient.delete(API_CONFIG.ENDPOINTS.OPERATIONAL_SESSION, { params: { reason } });
    unwrap(response);
  }
  if (options.clear !== false) await clearOperationalSession();
}

export async function getOperationalQueue(): Promise<MotoboyQueue> {
  const token = await getSecureItem('operationalAccessToken');
  return operationalRequests.queue(token || '', async () => {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.OPERATIONAL_QUEUE, { timeout: API_CONFIG.OPERATIONAL_SYNC_TIMEOUT, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    return unwrap<MotoboyQueue>(response);
  });
}

export async function acceptOffer(expectedOfferId?: string): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.ACCEPT_OFFER, expectedOfferId ? { expectedOfferId } : undefined);
  return unwrap<MotoboyQueue>(response);
}

export async function rejectOffer(reason?: string, expectedOfferId?: string): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.REJECT_OFFER, { motivo: reason, expectedOfferId });
  return unwrap<MotoboyQueue>(response);
}

export async function reorderQueue(expectedVersion: number, pedidoIdsOrdenados: number[]): Promise<MotoboyQueue> {
  const response = await apiClient.put(API_CONFIG.ENDPOINTS.REORDER_QUEUE, {
    expectedVersion,
    pedidoIdsOrdenados,
  });
  return unwrap<MotoboyQueue>(response);
}

export async function resumeQueue(): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.RESUME_QUEUE);
  return unwrap<MotoboyQueue>(response);
}

export async function arrivedAtStore(): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.ARRIVED_AT_STORE);
  return unwrap<MotoboyQueue>(response);
}

export async function pickUpCurrent(confirmation?: { expectedPedidoId: number; expectedVersion: number; pedidoIds: number[] }): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.PICKUP_CURRENT, confirmation);
  return unwrap<MotoboyQueue>(response);
}

export async function arriveCurrent(expectedPedidoId?: number): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.ARRIVE_CURRENT, expectedPedidoId == null ? undefined : { expectedPedidoId });
  return unwrap<MotoboyQueue>(response);
}

export async function deliverCurrent(codigo?: string): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.DELIVER_CURRENT, { codigo });
  return unwrap<MotoboyQueue>(response);
}

export async function failCurrent(motivo: string,expectedPedidoId?:number): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.FAIL_CURRENT, { motivo,expectedPedidoId });
  return unwrap<MotoboyQueue>(response);
}

export async function sendOperationalLocation(payload: OperationalLocationPayload, token?: string): Promise<OperationalLocationAck> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.OPERATIONAL_LOCATION, payload, { timeout: API_CONFIG.OPERATIONAL_SYNC_TIMEOUT, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  return unwrap<OperationalLocationAck>(response);
}

let batchUnavailableUntil = 0;
export async function sendOperationalLocations(samples: OperationalLocationPayload[], token: string): Promise<OperationalLocationAck[]> {
  if (!samples.length || samples.length > 20) throw new Error('Lote de localização inválido.');
  if (Date.now() >= batchUnavailableUntil) {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.OPERATIONAL_LOCATION_BATCH, { samples }, {
      timeout: API_CONFIG.OPERATIONAL_SYNC_TIMEOUT, headers: { Authorization: `Bearer ${token}` },
      validateStatus: status => (status >= 200 && status < 300) || status === 404 || status === 405,
    });
    if (response.status !== 404 && response.status !== 405) {
      const result = unwrap<{ samples: OperationalLocationAck[] }>(response);
      if (!Array.isArray(result?.samples) || result.samples.length !== samples.length) throw new Error('Confirmação do lote incompleta.');
      return result.samples;
    }
    // Atualizacao gradual: API anterior continua atendendo, sem tentar o lote a cada callback.
    batchUnavailableUntil = Date.now() + 300000;
  }
  const acknowledgments: OperationalLocationAck[] = [];
  const started = Date.now();
  for (const sample of samples.slice(0, 5)) {
    if (acknowledgments.length && Date.now() - started >= 8000) break;
    try { acknowledgments.push(await sendOperationalLocation(sample, token)); }
    catch (error) {
      const failure = error as { response?: { status?: number; data?: { code?: string } } };
      const code = failure.response?.data?.code;
      if ((failure.response?.status === 422 && code === 'LOCATION_INVALID') ||
          (failure.response?.status === 409 && code === 'STALE_SEQUENCE')) {
        acknowledgments.push({ sampleId: sample.sampleId, sequence: sample.sequence,
          outcome: code === 'STALE_SEQUENCE' ? 'stale' : 'rejected', code,
          updatedCurrent: false, sessionVersion: 0, receivedAtUtc: new Date().toISOString() });
      } else if (acknowledgments.length) break;
      else throw error;
    }
  }
  return acknowledgments;
}

export async function saveOperationalSession(data: OperationalTokenResponse): Promise<void> {
  const raw = await getSecureItem('operationalSession');
  if (raw) {
    try {
      const previous = JSON.parse(raw) as OperationalSession;
      if (previous.sessionId === data.session.sessionId && previous.epoch === data.session.epoch && previous.version > data.session.version) return;
    } catch { /* Uma sessão corrompida será substituída pela resposta confirmada. */ }
  }
  await setSecureItem('operationalAccessToken', data.accessToken);
  await setSecureItem('operationalSession', JSON.stringify(data.session));
  await setSecureItem('operationalEstablishmentId', data.establishmentId);
}

export async function clearOperationalSession(): Promise<void> {
  await deleteSecureItem('operationalAccessToken');
  await deleteSecureItem('operationalSession');
  await deleteSecureItem('operationalEstablishmentId');
  await deleteSecureItem('operationalUserId');
}

export function queueToPedidos(queue: MotoboyQueue | null): Pedido[] {
  if (!queue) return [];
  const stops = queue.offer?.stops?.length
    ? queue.offer.stops
    : [queue.current, ...(queue.next ?? [])].filter(Boolean) as RouteStop[];

  return stops
    .filter((stop) => stop.pedido)
    .map((stop) => toPedido(stop.pedido as DeliveryOrder, stop.status));
}

function toPedido(order: DeliveryOrder, status: string): Pedido {
  const items = parseItems(order.items);
  return {
    id: order.id,
    nomeCliente: order.nomeCliente,
    telefoneCliente: order.telefoneCliente,
    enderecoEntrega: order.enderecoEntrega,
    endereco: order.enderecoEntrega ?? '',
    bairro: order.bairro ?? '',
    valor: order.value ?? 0,
    total_valor: order.value ?? 0,
    status: status,
    statusPedido: status,
    statusPagamento: order.statusPagamento ?? order.tipoPagamento ?? undefined,
    itens: items,
    coordinates:
      typeof order.latitude === 'number' && typeof order.longitude === 'number'
        ? { lat: order.latitude, lng: order.longitude }
        : undefined,
    horario: order.previsaoEntrega ?? undefined,
    observacoes: order.observacoes ?? undefined,
  };
}

function parseItems(raw?: string | null): Pedido['itens'] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createIdentifier(): string {
  const cryptoObject = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObject?.randomUUID) {
    return cryptoObject.randomUUID();
  }

  // O backend desserializa attemptId como System.Guid. Alguns ambientes
  // Android/Hermes não expõem crypto.randomUUID(), então o fallback também
  // precisa gerar um UUID válido (e não timestamp-contador).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function getClientInstanceId(): Promise<string> {
  const stored = await getSecureItem('clientInstanceId');
  if (stored) return stored;
  const created = createIdentifier();
  await setSecureItem('clientInstanceId', created);
  return created;
}
