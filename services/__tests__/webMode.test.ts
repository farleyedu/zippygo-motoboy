import { isIosDevice, resolveExecutionMode } from '../executionMode';
import { pushGuidance } from '../webPushGuidance';
import { createActivityReporter } from '../sessionActivity';

describe('modo de execução', () => {
  it('separa nativo, PWA instalado e navegador', () => {
    expect(resolveExecutionMode({ os: 'android' })).toBe('native');
    expect(resolveExecutionMode({ os: 'web', standalone: true })).toBe('web-installed');
    expect(resolveExecutionMode({ os: 'web', standalone: false })).toBe('web-browser');
  });
  it('reconhece iPhone e iPad (que se apresenta como Mac)', () => {
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })).toBe(true);
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe(false);
  });
});

describe('orientação de notificações', () => {
  it('iPhone no Safari comum pede instalação na Tela de Início', () => {
    const g = pushGuidance({ mode: 'web-browser', ios: true, supported: false, permission: 'unsupported' });
    expect(g.status).toBe('install-required');
    expect(g.message).toMatch(/Tela de Início/);
  });
  it('PWA instalado no iPhone pode pedir a permissão', () => {
    expect(pushGuidance({ mode: 'web-installed', ios: true, supported: true, permission: 'default' })).toMatchObject({ status: 'can-enable', canRequest: true });
  });
  it('iOS instalado sem Web Push avisa em vez de prometer alertas', () => {
    const g = pushGuidance({ mode: 'web-installed', ios: true, supported: false, permission: 'unsupported' });
    expect(g.status).toBe('unsupported');
    expect(g.message).toMatch(/aberto/);
  });
  it('navegador sem Web Push mantém o trabalho com página aberta e não promete alerta', () => {
    const g = pushGuidance({ mode: 'web-browser', ios: false, supported: false, permission: 'unsupported' });
    expect(g.status).toBe('unsupported');
    expect(g.message).toMatch(/não esperamos alerta/);
  });
  it('permissão negada orienta liberar nas configurações, sem botão de pedir', () => {
    expect(pushGuidance({ mode: 'web-browser', ios: false, supported: true, permission: 'denied' })).toMatchObject({ status: 'blocked', canRequest: false });
  });
});

describe('atividade humana', () => {
  const session = { sessionId: 's1' } as any;
  const settle = () => new Promise(resolve => setTimeout(resolve, 5));
  it('não envia por timer: só quando há interação, no máximo uma vez por janela', async () => {
    let now = 0;
    const send = jest.fn(async () => session);
    const onSession = jest.fn();
    const reporter = createActivityReporter({ canReport: () => true, send, onSession, now: () => now, minIntervalMs: 1000 });
    reporter.note(); reporter.note();
    expect(send).toHaveBeenCalledTimes(1);
    await settle();
    expect(onSession).toHaveBeenCalledWith(session);
    now = 500; reporter.note(); expect(send).toHaveBeenCalledTimes(1);
    now = 1500; reporter.note(); expect(send).toHaveBeenCalledTimes(2);
  });
  it('não envia sem turno, em segundo plano ou sem rede', () => {
    const send = jest.fn(async () => null);
    createActivityReporter({ canReport: () => false, send, onSession: () => {} }).note();
    expect(send).not.toHaveBeenCalled();
  });
  it('servidor sem o contrato (404) desliga o envio', async () => {
    let now = 0;
    const send = jest.fn(async () => { throw { status: 404 }; });
    const reporter = createActivityReporter({ canReport: () => true, send, onSession: () => {}, now: () => now, minIntervalMs: 10 });
    reporter.note(); await settle();
    now = 100; reporter.note();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('falha de rede não desliga: tenta de novo na próxima janela', async () => {
    let now = 0;
    const send = jest.fn(async () => { throw new Error('Network Error'); });
    const reporter = createActivityReporter({ canReport: () => true, send, onSession: () => {}, now: () => now, minIntervalMs: 10 });
    reporter.note(); await settle();
    now = 100; reporter.note();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
