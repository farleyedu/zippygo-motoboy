import { API_CONFIG } from '../config/apiConfig';
import { getClientInstanceId } from './mobileApi';

export type AccountLoginResponse = {
  success: boolean;
  error?: string;
  requiresSessionConfirmation?: boolean;
  activeSessionId?: string;
  data?: {
    accessToken: string; refreshToken?: string; motoboyLoginSessionId?: string;
    user?: { id?: string | number; nome?: string; email?: string; telefone?: string };
  };
};

export async function requestAccountLogin(email: string, senha: string, expectedSessionId?: string): Promise<AccountLoginResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.OPERATIONAL_SYNC_TIMEOUT);
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
      method: 'POST', headers: API_CONFIG.DEFAULT_HEADERS, signal: controller.signal,
      body: JSON.stringify({ email, senha, clientApp: 'motoboy', clientInstanceId: await getClientInstanceId(),
        confirmSessionReplacement: !!expectedSessionId, expectedSessionId }),
    });
    const body = await response.json();
    if (response.status === 409 && body?.code === 'LOGIN_SESSION_ACTIVE' && typeof body?.details?.sessionId === 'string')
      return { success: false, requiresSessionConfirmation: true, activeSessionId: body.details.sessionId };
    if (!response.ok || !body?.success || !body?.data?.accessToken)
      return { success: false, error: body?.error || 'E-mail ou senha inválidos.' };
    return body;
  } finally { clearTimeout(timer); }
}
