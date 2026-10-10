type Detail = string | number | boolean | null | undefined;

export function safeNavigationMessage(value: unknown): string {
  return String(value).replace(/AIza[\w-]+/g, '[chave omitida]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token omitido]')
    .replace(/Bearer\s+\S+/gi, '[token omitido]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL omitida]')
    .replace(/((?:apiKey|token|authorization|address|latitude|longitude|lat|lng)\s*[=:]\s*)[^,\s]+/gi, '$1[omitido]')
    .replace(/-?\d+\.\d{4,}/g, '[coordenada omitida]')
    .slice(0, 500);
}

export class NavigationDiagnostics {
  private started = Date.now();
  private id = `nav-${this.started.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  private sequence = 0;
  private pending = new Set<() => void>();
  constructor(readonly enabled: boolean) {}
  // Diagnostic timers never cancel, retry or alter the native operation.
  operation(phase: string, details: Record<string, Detail> = {}) {
    if (!this.enabled) return (_details: Record<string, Detail> = {}, _warning = false) => {};
    const operationId = ++this.sequence, started = Date.now();
    let finished = false;
    this.event(`${phase}.begin`, { ...details, operationId });
    const timers = [5000, 15000, 30000].map(delay => setTimeout(() => {
      if (!finished) this.event(`${phase}.pending`, { operationId, durationMs: Date.now() - started }, true);
    }, delay));
    const finish = (result: Record<string, Detail> = {}, warning = false) => {
      if (finished) return;
      finished = true; timers.forEach(clearTimeout); this.pending.delete(cancel);
      this.event(`${phase}.end`, { ...result, operationId, durationMs: Date.now() - started }, warning);
    };
    const cancel = () => finish({ interruptedByLifecycle: true }, true);
    this.pending.add(cancel);
    return finish;
  }
  close(): void { for (const cancel of [...this.pending]) cancel(); }
  event(phase: string, details: Record<string, Detail> = {}, warning = false): void {
    if (!this.enabled) return;
    const safe = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, typeof value === 'string' ? safeNavigationMessage(value) : value]));
    const record = { attemptId: this.id, at: new Date().toISOString(), phase, elapsedMs: Date.now() - this.started, ...safe };
    (warning ? console.warn : console.log)('[Navegação][Diagnóstico]', JSON.stringify(record));
  }
  error(phase: string, error: unknown): void {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    this.event(phase, { code, name: error instanceof Error ? error.name : undefined, message: error instanceof Error ? error.message : String(error), cause }, true);
  }
}

let probeFlight: Promise<void> | null = null, lastProbe = 0;
// These public, credential-free probes test HTTPS, not Navigation authorization.
// One probe group at a time, max once per 30 seconds, only in development.
export function diagnoseNavigationConnection(log: NavigationDiagnostics): void {
  if (!log.enabled || probeFlight || Date.now() - lastProbe < 30000) return;
  lastProbe = Date.now();
  probeFlight = Promise.all([
    { host: 'clients4.google.com', url: 'https://clients4.google.com/generate_204' },
    { host: 'maps.googleapis.com', url: 'https://maps.googleapis.com/maps/api/directions/json' },
  ].map(async target => {
    const controller = new AbortController(), started = Date.now();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(target.url, { method: 'HEAD', signal: controller.signal });
      log.event('https.public.result', { host: target.host, status: response.status, durationMs: Date.now() - started, testsNavigationAuthorization: false });
    } catch (error) {
      log.event('https.public.error', { host: target.host, durationMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) }, true);
    } finally { clearTimeout(timer); }
  })).then(() => {}).finally(() => { probeFlight = null; });
}
