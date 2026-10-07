import { AxiosResponse } from 'axios';
import { apiClient } from './apiService';
import { API_CONFIG } from '../config/apiConfig';
import { Pedido } from '../types/pedido';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secureStorage';

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

function unwrap<T>(response: AxiosResponse<any>): T {
  const payload = response.data;
  if (response.status >= 400 || payload?.success === false) {
    throw new MobileApiError(errorMessage(payload), response.status, payload?.code ?? payload?.error?.code);
  }

  return (payload?.data ?? payload) as T;
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

export async function listEstablishments(): Promise<EstablishmentLink[]> {
  const response = await apiClient.get(API_CONFIG.ENDPOINTS.ESTABLISHMENTS);
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

export async function startOperationalSession(): Promise<OperationalTokenResponse> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.OPERATIONAL_START, {
    attemptId: createIdentifier(),
    clientInstanceId: await getClientInstanceId(),
  });
  const data = unwrap<OperationalTokenResponse>(response);
  await saveOperationalSession(data);
  return data;
}

export async function getOperationalSession(): Promise<OperationalSession | null> {
  const response = await apiClient.get(API_CONFIG.ENDPOINTS.OPERATIONAL_SESSION);
  return unwrap<OperationalSession | null>(response);
}

export async function heartbeatOperationalSession(): Promise<OperationalHeartbeatResponse> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.OPERATIONAL_HEARTBEAT);
  const data = unwrap<OperationalHeartbeatResponse>(response);
  if (data.accessToken) {
    await setSecureItem('operationalAccessToken', data.accessToken);
  }
  if (data.session) {
    await setSecureItem('operationalSession', JSON.stringify(data.session));
  }
  return data;
}

export async function endOperationalSession(reason = 'client_end'): Promise<void> {
  const token = await getSecureItem('operationalAccessToken');
  if (token) {
    const response = await apiClient.delete(API_CONFIG.ENDPOINTS.OPERATIONAL_SESSION, { params: { reason } });
    unwrap(response);
  }
  await clearOperationalSession();
}

export async function getOperationalQueue(): Promise<MotoboyQueue> {
  const response = await apiClient.get(API_CONFIG.ENDPOINTS.OPERATIONAL_QUEUE);
  return unwrap<MotoboyQueue>(response);
}

export async function acceptOffer(): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.ACCEPT_OFFER);
  return unwrap<MotoboyQueue>(response);
}

export async function rejectOffer(reason?: string): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.REJECT_OFFER, { motivo: reason });
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

export async function pickUpCurrent(): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.PICKUP_CURRENT);
  return unwrap<MotoboyQueue>(response);
}

export async function arriveCurrent(): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.ARRIVE_CURRENT);
  return unwrap<MotoboyQueue>(response);
}

export async function deliverCurrent(codigo?: string): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.DELIVER_CURRENT, { codigo });
  return unwrap<MotoboyQueue>(response);
}

export async function failCurrent(motivo: string): Promise<MotoboyQueue> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.FAIL_CURRENT, { motivo });
  return unwrap<MotoboyQueue>(response);
}

export async function sendOperationalLocation(payload: OperationalLocationPayload): Promise<void> {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.OPERATIONAL_LOCATION, payload);
  unwrap(response);
}

export async function saveOperationalSession(data: OperationalTokenResponse): Promise<void> {
  await setSecureItem('operationalAccessToken', data.accessToken);
  await setSecureItem('operationalSession', JSON.stringify(data.session));
  await setSecureItem('operationalEstablishmentId', data.establishmentId);
}

export async function clearOperationalSession(): Promise<void> {
  await deleteSecureItem('operationalAccessToken');
  await deleteSecureItem('operationalSession');
  await deleteSecureItem('operationalEstablishmentId');
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

function createIdentifier(): string {
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
