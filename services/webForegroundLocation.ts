/** O navegador só acompanha GPS com a página visível; cada retorno exige um fix novo. */
export function createWebForegroundLocation(ports: {
  geolocation: Geolocation;
  visible: () => boolean;
  subscribe: (listener: () => void) => () => void;
  send: (position: GeolocationPosition, force: boolean) => Promise<void>;
  permission: (granted: boolean) => void;
  now?: () => number;
  interval?: (callback: () => void) => () => void;
}) {
  const now = ports.now ?? Date.now;
  let disposed = false, generation = 0, watching = false, watchId: number | null = null;
  let lastCapture = 0, resumedAt = 0, forceNext = true;
  let stopTimer: (() => void) | null = null;
  const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
  function pause() {
    ++generation; watching = false;
    if (watchId !== null) ports.geolocation.clearWatch(watchId);
    watchId = null;
    stopTimer?.(); stopTimer = null;
  }
  function refresh() {
    if (disposed) return;
    if (!ports.visible()) { if (watching) pause(); return; }
    // focus e visibilitychange podem chegar juntos: não duplicar o watcher/fix.
    if (watching) return;
    watching = true; resumedAt = now(); forceNext = true;
    const current = ++generation;
    const receive = (position: GeolocationPosition) => {
      if (disposed || current !== generation || !ports.visible()) return;
      const captured = position.timestamp;
      // Cache do navegador e callbacks atrasados não renovam a idade do GPS.
      if (!Number.isFinite(captured) || captured < resumedAt - 2000 || captured <= lastCapture || captured > now() + 5000) return;
      lastCapture = captured;
      ports.permission(true);
      const force = forceNext; forceNext = false;
      void ports.send(position, force).catch(() => undefined);
    };
    const failure = (error: GeolocationPositionError) => {
      if (!disposed && current === generation && error.code === 1) ports.permission(false);
    };
    watchId = ports.geolocation.watchPosition(receive, failure, options);
    let pending = false;
    const capture = () => {
      if (pending || disposed || current !== generation || !ports.visible()) return;
      pending = true;
      ports.geolocation.getCurrentPosition(
        position => { pending = false; receive(position); },
        error => { pending = false; failure(error); }, options,
      );
    };
    capture();
    // watchPosition pode ficar silencioso quando parado. O envio continua filtrado
    // em trackingService (10 s em rota / 60 s aguardando, ou deslocamento).
    stopTimer = ports.interval ? ports.interval(capture) : (() => {
      const timer = setInterval(capture, 15000);
      return () => clearInterval(timer);
    })();
  }
  const unsubscribe = ports.subscribe(refresh);
  refresh();
  return () => { disposed = true; pause(); unsubscribe(); };
}

export function subscribeWebForeground(listener: () => void): () => void {
  document.addEventListener('visibilitychange', listener);
  window.addEventListener('focus', listener);
  window.addEventListener('pageshow', listener);
  return () => {
    document.removeEventListener('visibilitychange', listener);
    window.removeEventListener('focus', listener);
    window.removeEventListener('pageshow', listener);
  };
}
