import type { MapCoordinate, NavigationState } from '../../components/mapTypes';

export type JourneyRequest = {
  key: string;
  destinations: { position: MapCoordinate; title: string }[];
  enabled: boolean;
  follow: boolean;
  cameraToken: string;
  muted: boolean;
};
export type JourneyBridge = {
  prepare(request: JourneyRequest): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  navigationUI(enabled: boolean): Promise<void>;
  audio(muted: boolean): void;
  follow(): Promise<void>;
  overview(): Promise<void>;
};

// Native commands are serialized. A late route/start result must never
// restore follow mode after the driver has exited or changed destination.
export class NavigationJourney {
  private revision = 0;
  private work = Promise.resolve();
  private preparedKey = '';
  private cameraToken = '';
  private guiding = false;
  private arrived = false;
  private disposed = false;

  constructor(private bridge: JourneyBridge, private report: (state: NavigationState) => void) {}

  sync(request: JourneyRequest): Promise<void> {
    const revision = ++this.revision;
    const current = () => !this.disposed && revision === this.revision;
    this.work = this.work.catch(() => {}).then(async () => {
      if (!current()) return;
      if (request.key !== this.preparedKey) {
        this.guiding = false;
        this.arrived = false;
        this.cameraToken = '';
        this.report({ status: 'loading', message: 'Calculando o caminho pelas ruas…', meters: undefined, seconds: undefined });
        await this.bridge.stop();
        if (!current()) return;
        await this.bridge.prepare(request);
        this.preparedKey = request.key;
        if (!current()) return;
      }
      await this.bridge.navigationUI(request.enabled);
      if (!current()) return;
      this.bridge.audio(!request.enabled || request.muted);
      if (this.arrived) { this.report({ status: 'arrived' }); return; }
      if (request.enabled) {
        if (!this.guiding) {
          await this.bridge.start();
          this.guiding = true;
        }
        if (!current()) return;
        if (request.follow && request.cameraToken !== this.cameraToken) {
          await this.bridge.follow();
          this.cameraToken = request.cameraToken;
        }
        if (current()) this.report({ status: 'guiding' });
      } else {
        if (this.guiding) await this.bridge.stop();
        this.guiding = false;
        this.cameraToken = '';
        if (!current()) return;
        await this.bridge.overview();
        if (current()) this.report({ status: 'ready' });
      }
    }).catch(async error => {
      if (current()) {
        this.guiding = false;
        await this.bridge.stop().catch(() => {});
        if (current()) this.report({ status: 'error', message: error instanceof Error ? error.message : 'Não foi possível iniciar a navegação.' });
      }
    });
    return this.work;
  }

  arrival(): void {
    ++this.revision;
    this.arrived = true;
    this.guiding = false;
    this.cameraToken = '';
    this.work = this.work.catch(() => {}).then(() => this.bridge.stop()).catch(() => {});
    this.report({ status: 'arrived' });
  }

  remaining(meters: number, seconds: number): void {
    if (!this.disposed && (this.arrived || this.guiding)) this.report({ status: this.arrived ? 'arrived' : 'guiding', meters, seconds });
  }

  rerouting(): void {
    if (!this.disposed && this.guiding && !this.arrived) this.report({ status: 'rerouting', message: 'Recalculando o caminho…' });
  }

  dispose(): Promise<void> {
    this.disposed = true; ++this.revision;
    this.work = this.work.catch(() => {}).then(() => this.bridge.stop()).catch(() => {});
    return this.work;
  }
}

export function journeySummary(seconds?: number, meters?: number, now = Date.now()) {
  const hasTime = typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0;
  const hasDistance = typeof meters === 'number' && Number.isFinite(meters) && meters >= 0;
  return {
    duration: hasTime ? seconds < 60 ? '< 1 min' : `${Math.ceil(seconds / 60)} min` : '— min',
    distance: hasDistance ? meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : '— km',
    arrival: hasTime ? new Date(now + seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—:—',
  };
}
