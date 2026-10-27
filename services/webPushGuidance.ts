import type { ExecutionMode } from './executionMode';

export type PushStatus = 'active' | 'permitted' | 'registering' | 'unregistered' | 'can-enable' | 'blocked' | 'install-required' | 'unsupported';
export type PushGuidance = { status: PushStatus; label: string; message: string; canRequest: boolean };
type Registration = 'none' | 'registering' | 'registered' | 'failed' | 'not-configured';

/**
 * Estado das notificações para a pessoa. Na Web, permissão do navegador e inscrição no servidor são etapas
 * diferentes: "active" só aparece depois que o backend confirmou a inscrição deste turno. Mesmo assim o envio
 * de um aviso não prova que ele foi entregue, então nenhum texto promete entrega com o app fechado.
 */
export function pushGuidance(input: {
  mode: ExecutionMode;
  ios: boolean;
  supported: boolean;
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
  /** Só na Web: há turno aberto para receber a inscrição. */
  hasSession?: boolean;
  /** Só na Web: situação da inscrição confirmada pelo servidor para o turno atual. */
  registration?: Registration;
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
  if (input.permission === 'granted') {
    // A entrega depende do navegador e do sistema; com o app fechado ela pode atrasar ou não acontecer.
    const delivery = input.ios
      ? 'A entrega depende do iPhone; abra o ZippyGo pelo ícone da Tela de Início e confira a fila ao voltar.'
      : 'A entrega depende do navegador e do sistema; com o app fechado ela pode atrasar ou não acontecer.';
    if (!input.hasSession) return { status: 'permitted', label: 'Permitidas', canRequest: false,
      message: 'O navegador permite avisos. O registro para receber ofertas é feito quando o turno começar.' };
    switch (input.registration) {
      case 'registered': return { status: 'active', label: 'Registradas', canRequest: false,
        message: `Avisos de novas ofertas registrados para este turno neste aparelho. ${delivery}` };
      case 'registering': return { status: 'registering', label: 'Registrando', canRequest: false,
        message: 'Permissão concedida. Registrando este aparelho no servidor para receber ofertas.' };
      case 'not-configured': return { status: 'unsupported', label: 'Indisponíveis', canRequest: false,
        message: 'O envio de avisos pelo servidor ainda não foi habilitado. Mantenha o ZippyGo aberto para ver novas ofertas.' };
      case 'failed': return { status: 'unregistered', label: 'Sem registro', canRequest: true,
        message: 'O navegador permite avisos, mas o registro no servidor falhou. Tente registrar de novo; até lá, mantenha o ZippyGo aberto.' };
      default: return { status: 'unregistered', label: 'Sem registro', canRequest: true,
        message: 'O navegador permite avisos, mas este turno ainda não está registrado para recebê-los. Registre para ser avisado de novas ofertas.' };
    }
  }
  if (input.permission === 'denied') return {
    status: 'blocked', label: 'Bloqueadas', canRequest: false,
    message: 'As notificações estão bloqueadas. Libere nas configurações do navegador ou do aplicativo instalado e volte aqui.',
  };
  return {
    status: 'can-enable', label: 'Desativadas', canRequest: true,
    message: 'Ative as notificações para ser avisado de novos pedidos mesmo com outra aba ou o app em segundo plano.',
  };
}
