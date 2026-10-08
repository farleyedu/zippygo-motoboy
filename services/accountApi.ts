import { apiClient } from './apiService';
import { MobileApiError } from './mobileApi';
import { assertRealPhoto } from './browserNativeTest';

export type OwnAccount = { motoboyId: number; nome: string; email: string; telefone?: string; cidade?: string; uf?: string; avatar?: string; modeloMoto?: string; placaMoto?: string; anoMoto?: number; statusCadastro: string };
export type OwnDocument = { id: string; tipo: 'identificacao' | 'cnh' | 'moto'; enviadoEmUtc: string; status: string };
export type PersonalData = Pick<OwnAccount, 'nome' | 'email' | 'telefone' | 'cidade' | 'uf'>;
export type VehicleData = Required<Pick<OwnAccount, 'modeloMoto' | 'placaMoto' | 'anoMoto'>>;
function result<T>(response: { status: number; data: { success?: boolean; data: T; error?: string; code?: string } }): T {
  if (response.status >= 400 || response.data.success === false) throw new MobileApiError(response.data.error || 'Não foi possível atualizar seu cadastro.', response.status, response.data.code);
  return response.data.data;
}
export async function getOwnAccount(signal?: AbortSignal): Promise<OwnAccount> { return result(await apiClient.get('/motoboys/me/perfil', { signal })); }
export async function savePersonalData(data: PersonalData): Promise<OwnAccount> { return result(await apiClient.patch('/motoboys/me/perfil', data)); }
export async function saveVehicle(data: VehicleData): Promise<OwnAccount> { return result(await apiClient.put('/motoboys/me/veiculo', data)); }
export async function getOwnDocuments(signal?: AbortSignal): Promise<OwnDocument[]> { return result(await apiClient.get('/motoboys/me/documentos', { signal })); }
export async function getOwnDocumentImage(id: string): Promise<string> { return result(await apiClient.get(`/motoboys/me/documentos/${encodeURIComponent(id)}`)); }
export async function sendOwnImage(tipo: OwnDocument['tipo'] | 'avatar', base64: string): Promise<OwnDocument> {
  assertRealPhoto(base64);
  return result(await apiClient.post('/motoboys/me/documentos', { tipo, base64 }, { timeout: 45000 }));
}
