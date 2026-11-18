export type UpdateState = 'idle' | 'ready';

export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
}

export interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
  update(): Promise<unknown>;
}

export interface ContainerLike {
  controller: unknown;
  register(url: string, options: { updateViaCache: 'none' }): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

export interface WindowLike {
  isLoaded(): boolean;
  isVisible(): boolean;
  addEventListener(type: 'load' | 'visibilitychange', listener: () => void): void;
}

export interface UpdateStoreOptions {
  container: ContainerLike | null;
  windowLike: WindowLike;
  now: () => number;
  reload: () => void;
  scriptUrl?: string;
}

export interface UpdateStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): UpdateState;
  apply(): void;
  dismiss(): void;
}

// Hash routing means the page never navigates, so the browser's own update check would rarely run.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function createUpdateStore(options: UpdateStoreOptions): UpdateStore {
  const { container, windowLike, now, reload, scriptUrl = './sw.js' } = options;
  const listeners = new Set<() => void>();
  let state: UpdateState = 'idle';
  let registration: RegistrationLike | null = null;
  let applying = false;
  let reloaded = false;
  let lastCheck = now();

  function setState(next: UpdateState): void {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  }

  function reloadOnce(): void {
    if (reloaded) return;
    reloaded = true;
    reload();
  }

  function watch(worker: WorkerLike | null): void {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && container?.controller) setState('ready');
    });
  }

  function register(): void {
    if (!container) return;
    container
      .register(scriptUrl, { updateViaCache: 'none' })
      .then((found) => {
        registration = found;
        lastCheck = now();
        if (found.waiting && container.controller) setState('ready');
        found.addEventListener('updatefound', () => watch(found.installing));
      })
      .catch(() => undefined);
  }

  if (container) {
    container.addEventListener('controllerchange', () => {
      if (applying) reloadOnce();
      else setState('ready');
    });
    windowLike.addEventListener('visibilitychange', () => {
      if (!registration || !windowLike.isVisible() || now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheck = now();
      registration.update().catch(() => undefined);
    });
    if (windowLike.isLoaded()) register();
    else windowLike.addEventListener('load', register);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    apply() {
      applying = true;
      const waiting = registration?.waiting;
      if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
      else reloadOnce();
    },
    dismiss() {
      setState('idle');
    },
  };
}

export function startServiceWorker(): UpdateStore {
  const supported = 'serviceWorker' in navigator;
  return createUpdateStore({
    container: supported ? navigator.serviceWorker : null,
    windowLike: {
      isLoaded: () => document.readyState === 'complete',
      isVisible: () => document.visibilityState === 'visible',
      addEventListener: (type, listener) => (type === 'load' ? window : document).addEventListener(type, listener),
    },
    now: () => Date.now(),
    reload: () => window.location.reload(),
  });
}
