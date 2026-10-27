import { isIosDevice, resolveExecutionMode } from '../executionMode';
import { pushGuidance } from '../webPushGuidance';
import { registrationFor } from '../webOfferPush';
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

describe('notificações na Web: permissão não é inscrição', () => {
  const base = { mode: 'web-installed' as const, ios: false, supported: true, permission: 'granted' as const };
  it('permissão concedida sem inscrição confirmada não aparece como ativa e permite registrar', () => {
    const g = pushGuidance({ ...base, hasSession: true, registration: 'none' });
    expect(g).toMatchObject({ status: 'unregistered', canRequest: true });
    expect(g.label).not.toMatch(/Ativ|Registrad/);
  });
  it('sem contexto de sessão nunca afirma que os avisos estão ativos', () => {
    expect(pushGuidance(base).status).toBe('permitted');
  });
  it('só fica "registradas" depois da confirmação do servidor, sem prometer entrega', () => {
    const g = pushGuidance({ ...base, hasSession: true, registration: 'registered' });
    expect(g).toMatchObject({ status: 'active', label: 'Registradas', canRequest: false });
    expect(g.message).toMatch(/pode atrasar ou não acontecer/);
    expect(g.message).not.toMatch(/garantid/);
  });
  it('falha no registro permite tentar de novo; servidor sem Web Push aparece como indisponível', () => {
    expect(pushGuidance({ ...base, hasSession: true, registration: 'failed' })).toMatchObject({ status: 'unregistered', canRequest: true });
    expect(pushGuidance({ ...base, hasSession: true, registration: 'not-configured' })).toMatchObject({ status: 'unsupported', canRequest: false });
    expect(pushGuidance({ ...base, hasSession: true, registration: 'registering' })).toMatchObject({ status: 'registering', canRequest: false });
  });
  it('iPhone instalado registrado orienta abrir pelo ícone da Tela de Início', () => {
    expect(pushGuidance({ ...base, ios: true, hasSession: true, registration: 'registered' }).message).toMatch(/Tela de Início/);
  });
  it('inscrição de outra sessão ou estabelecimento não conta para o turno atual', () => {
    const state = { status: 'registered' as const, sessionId: 's1', establishmentId: 'e1', endpoint: 'https://push' };
    expect(registrationFor('s1', 'e1', state)).toBe('registered');
    expect(registrationFor('s2', 'e1', state)).toBe('none');
    expect(registrationFor('s1', 'e2', state)).toBe('none');
    expect(registrationFor(null, 'e1', state)).toBe('none');
  });
});

describe('atividade humana', () => {
  const ack = { recorded: true, serverTimeUtc: '2026-01-01T10:00:00Z', lastHumanActivityAtUtc: '2026-01-01T10:00:00Z', inactivityExpiresAtUtc: '2026-01-01T17:00:00Z', inactivityRemainingSeconds: 25200 };
  const settle = () => new Promise(resolve => setTimeout(resolve, 5));
  const reporterWith = (over: Partial<Parameters<typeof createActivityReporter>[0]>) =>
    createActivityReporter({ canReport: () => true, sessionId: () => 's1', send: async () => ack, onAck: () => {}, ...over });
  it('não envia por timer: só quando há interação, no máximo uma vez por janela', async () => {
    let now = 0;
    const send = jest.fn(async () => ack);
    const onAck = jest.fn();
    const reporter = reporterWith({ send, onAck, now: () => now, minIntervalMs: 1000 });
    reporter.note(); reporter.note();
    expect(send).toHaveBeenCalledTimes(1);
    await settle();
    expect(onAck).toHaveBeenCalledWith(ack, 's1');
    now = 500; reporter.note(); expect(send).toHaveBeenCalledTimes(1);
    now = 1500; reporter.note(); expect(send).toHaveBeenCalledTimes(2);
  });
  it('a resposta fica presa ao turno do toque, mesmo que outro turno comece antes dela chegar', async () => {
    let current = 's1';
    const onAck = jest.fn();
    let release: (value: typeof ack) => void = () => {};
    const reporter = reporterWith({ sessionId: () => current, send: () => new Promise(resolve => { release = resolve; }), onAck });
    reporter.note(); current = 's2'; release(ack); await settle();
    expect(onAck).toHaveBeenCalledWith(ack, 's1');
  });
  it('não envia sem turno, em segundo plano ou sem rede', () => {
    const send = jest.fn(async () => null);
    reporterWith({ canReport: () => false, send }).note();
    reporterWith({ sessionId: () => null, send }).note();
    expect(send).not.toHaveBeenCalled();
  });
  it('resposta sem prazo legível não é aplicada', async () => {
    const onAck = jest.fn();
    reporterWith({ send: async () => null, onAck }).note(); await settle();
    expect(onAck).not.toHaveBeenCalled();
  });
  it('servidor sem o contrato (404) desliga o envio', async () => {
    let now = 0;
    const send = jest.fn(async () => { throw { status: 404 }; });
    const reporter = reporterWith({ send, now: () => now, minIntervalMs: 10 });
    reporter.note(); await settle();
    now = 100; reporter.note();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('falha de rede não desliga nem aplica prazo: tenta de novo antes do fim da janela', async () => {
    let now = 0;
    const onAck = jest.fn();
    const send = jest.fn(async () => { throw new Error('Network Error'); });
    const reporter = reporterWith({ send, onAck, now: () => now, minIntervalMs: 120000 });
    reporter.note(); await settle();
    now = 10000; reporter.note(); expect(send).toHaveBeenCalledTimes(1);
    now = 31000; reporter.note(); expect(send).toHaveBeenCalledTimes(2);
    expect(onAck).not.toHaveBeenCalled();
  });
  it('sessão encerrada (401) não renova nem repete logo em seguida', async () => {
    let now = 0;
    const send = jest.fn(async () => { throw { status: 401 }; });
    const reporter = reporterWith({ send, now: () => now, minIntervalMs: 120000 });
    reporter.note(); await settle();
    now = 31000; reporter.note();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
