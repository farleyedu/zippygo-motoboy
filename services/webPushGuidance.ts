import type { ExecutionMode } from './executionMode';

export type PushStatus = 'active' | 'can-enable' | 'blocked' | 'install-required' | 'unsupported';
export type PushGuidance = { status: PushStatus; label: string; message: string; canRequest: boolean };

/**
 * Estado das notificações para a pessoa. "active" só afirma que a permissão está concedida neste aparelho;
 * o envio de um aviso não prova que ele foi entregue, então nenhum texto promete entrega.
 */
export function pushGuidance(input: {
  mode: ExecutionMode;
  ios: boolean;
  supported: boolean;
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
}): PushGuidance {
  if (input.mode === 'native') {
    return input.permission === 'granted'
      ? { status: 'active', label: 'Ativas', message: 'Avisos de novos pedidos e mensagens permitidos neste aparelho.', canRequest: false }
      : { status: 'blocked', label: 'Desativadas', message: 'Permita as notificações nas configurações do aparelho para receber avisos com o app fechado.', canRequest: false };
  }
  if (!input.supported) {
    // No iPhone/iPad, Web Push só existe depois de adicionar o app à Tela de Início.
    if (input.ios && input.mode === 'web-browser') return {
      status: 'install-required', label: 'Instalar o app', canRequest: false,
      message: 'No iPhone, toque em Compartilhar e em "Adicionar à Tela de Início". Abra o ZippyGo por esse ícone para receber avisos com o app fechado.',
    };
    return {
      status: 'unsupported', label: 'Indisponíveis', canRequest: false,
      message: input.ios
        ? 'Este iOS não oferece notificações para apps da Tela de Início. Atualize o iOS ou mantenha o ZippyGo aberto para ver novos pedidos.'
        : 'Este navegador não oferece avisos com a página fechada. Mantenha o ZippyGo aberto para ver novos pedidos; não esperamos alerta com ele fechado.',
    };
  }
  if (input.permission === 'granted') return {
    status: 'active', label: 'Ativas', canRequest: false,
    message: input.mode === 'web-installed' || !input.ios
      ? 'Avisos de novos pedidos permitidos neste aparelho. Mantenha a permissão ativa nas configurações do navegador.'
      : 'Avisos permitidos.',
  };
  if (input.permission === 'denied') return {
    status: 'blocked', label: 'Bloqueadas', canRequest: false,
    message: 'As notificações estão bloqueadas. Libere nas configurações do navegador ou do aplicativo instalado e volte aqui.',
  };
  return {
    status: 'can-enable', label: 'Desativadas', canRequest: true,
    message: 'Ative as notificações para ser avisado de novos pedidos mesmo com outra aba ou o app em segundo plano.',
  };
}
