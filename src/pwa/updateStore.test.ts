import { describe, expect, it } from 'vitest';
import { createUpdateStore, type RegistrationLike, type WorkerLike } from './updateStore';

class FakeWorker extends EventTarget implements WorkerLike {
  state = 'installing';
  messages: unknown[] = [];
  postMessage(message: unknown): void {
    this.messages.push(message);
  }
}

class FakeRegistration extends EventTarget implements RegistrationLike {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  updates = 0;
  updateResult: Promise<unknown> = Promise.resolve();
  update(): Promise<unknown> {
    this.updates++;
    return this.updateResult;
  }
}

class FakeContainer extends EventTarget {
  controller: unknown = {};
  registration = new FakeRegistration();
  registerResult: Promise<RegistrationLike> | null = null;
  register(): Promise<RegistrationLike> {
    return this.registerResult ?? Promise.resolve(this.registration);
  }
}

class FakeWindow extends EventTarget {
  loaded = true;
  visible = true;
  isLoaded = () => this.loaded;
  isVisible = () => this.visible;
}

function build(container: FakeContainer, win: FakeWindow) {
  let clock = 0;
  let reloads = 0;
  const store = createUpdateStore({
    container: container,
    windowLike: win,
    now: () => clock,
    reload: () => reloads++,
  });
  return { store, reloads: () => reloads, advance: (ms: number) => (clock += ms) };
}

function setup(configure?: (container: FakeContainer) => void) {
  const container = new FakeContainer();
  configure?.(container);
  const win = new FakeWindow();
  return { container, win, registration: container.registration, ...build(container, win) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const HOUR = 60 * 60 * 1000;

describe('createUpdateStore', () => {
  it('stays idle without service worker support', () => {
    const store = createUpdateStore({
      container: null,
      windowLike: new FakeWindow(),
      now: () => 0,
      reload: () => undefined,
    });
    expect(store.getSnapshot()).toBe('idle');
    expect(() => store.apply()).not.toThrow();
  });

  it('is idle after a first install without a controller', async () => {
    const t = setup((c) => {
      c.controller = null;
      c.registration.waiting = new FakeWorker();
    });
    await flush();
    expect(t.store.getSnapshot()).toBe('idle');
  });

  it('is ready when a worker is already waiting', async () => {
    const t = setup((c) => (c.registration.waiting = new FakeWorker()));
    await flush();
    expect(t.store.getSnapshot()).toBe('ready');
  });

  it('becomes ready when an updated worker finishes installing', async () => {
    const t = setup();
    await flush();
    const worker = new FakeWorker();
    t.registration.installing = worker;
    t.registration.dispatchEvent(new Event('updatefound'));
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
    expect(t.store.getSnapshot()).toBe('ready');
  });

  it('watches a worker that was already installing at registration', async () => {
    const worker = new FakeWorker();
    const t = setup((c) => (c.registration.installing = worker));
    await flush();
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
    expect(t.store.getSnapshot()).toBe('ready');
  });

  it('stays idle when the worker installing at registration is a first install', async () => {
    const worker = new FakeWorker();
    const t = setup((c) => {
      c.controller = null;
      c.registration.installing = worker;
    });
    await flush();
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
    expect(t.store.getSnapshot()).toBe('idle');
  });

  it('notifies subscribers', async () => {
    const t = setup((c) => (c.registration.waiting = new FakeWorker()));
    let calls = 0;
    t.store.subscribe(() => calls++);
    await flush();
    expect(calls).toBe(1);
  });

  it('apply posts SKIP_WAITING and reloads exactly once on controllerchange', async () => {
    const waiting = new FakeWorker();
    const t = setup((c) => (c.registration.waiting = waiting));
    await flush();
    t.store.apply();
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(t.reloads()).toBe(0);
    t.container.dispatchEvent(new Event('controllerchange'));
    t.container.dispatchEvent(new Event('controllerchange'));
    expect(t.reloads()).toBe(1);
  });

  it('apply reloads at once when another tab already activated the update', async () => {
    const t = setup();
    await flush();
    t.store.apply();
    expect(t.reloads()).toBe(1);
  });

  it('keeps the prompt visible on a controllerchange this tab did not ask for', async () => {
    const t = setup();
    await flush();
    t.container.dispatchEvent(new Event('controllerchange'));
    expect(t.reloads()).toBe(0);
    expect(t.store.getSnapshot()).toBe('ready');
  });

  it('dismiss returns to idle', async () => {
    const t = setup((c) => (c.registration.waiting = new FakeWorker()));
    await flush();
    t.store.dismiss();
    expect(t.store.getSnapshot()).toBe('idle');
  });

  it('stays idle when register rejects', async () => {
    const t = setup((c) => {
      c.registerResult = Promise.reject(new Error('blocked'));
    });
    await flush();
    expect(t.store.getSnapshot()).toBe('idle');
  });

  it('waits for the load event when the page is still loading', async () => {
    const container = new FakeContainer();
    container.registration.waiting = new FakeWorker();
    const win = new FakeWindow();
    win.loaded = false;
    const { store } = build(container, win);
    await flush();
    expect(store.getSnapshot()).toBe('idle');
    win.dispatchEvent(new Event('load'));
    await flush();
    expect(store.getSnapshot()).toBe('ready');
  });

  it('checks for an update on visible only after an hour', async () => {
    const t = setup();
    await flush();
    t.win.dispatchEvent(new Event('visibilitychange'));
    expect(t.registration.updates).toBe(0);
    t.advance(HOUR - 60_000);
    t.win.dispatchEvent(new Event('visibilitychange'));
    expect(t.registration.updates).toBe(0);
    t.advance(120_000);
    t.win.dispatchEvent(new Event('visibilitychange'));
    expect(t.registration.updates).toBe(1);
    t.win.dispatchEvent(new Event('visibilitychange'));
    expect(t.registration.updates).toBe(1);
  });

  it('does not check while hidden', async () => {
    const t = setup();
    await flush();
    t.advance(2 * HOUR);
    t.win.visible = false;
    t.win.dispatchEvent(new Event('visibilitychange'));
    expect(t.registration.updates).toBe(0);
  });

  it('swallows a failing update check', async () => {
    const t = setup();
    await flush();
    t.registration.updateResult = Promise.reject(new Error('offline'));
    t.advance(2 * HOUR);
    t.win.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(t.store.getSnapshot()).toBe('idle');
  });
});
