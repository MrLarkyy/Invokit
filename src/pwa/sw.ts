import { cacheName, cachedOrNetwork, isSkipWaitingMessage, routeRequest, staleCaches } from './swCore';

// Replaced at build time by tools/serviceWorkerPlugin.ts.
declare const __INVOO_PRECACHE__: string[];
declare const __INVOO_VERSION__: string;

interface WorkerEvent {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends WorkerEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}
interface MessageEvent {
  data: unknown;
}
interface WorkerScope {
  registration: { scope: string };
  addEventListener(type: 'install' | 'activate', listener: (event: WorkerEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  skipWaiting(): Promise<void>;
}

const worker = self as unknown as WorkerScope;
const scope = worker.registration.scope;
const CURRENT = cacheName(__INVOO_VERSION__);
const urls = __INVOO_PRECACHE__.map((entry) => new URL(entry, scope));
const precached = new Set(urls.map((url) => `${url.origin}${url.pathname}${url.search}`));
const shellKey = new URL('index.html', scope).href;

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CURRENT).then((cache) => cache.addAll(urls.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(staleCaches(keys, CURRENT).map((key) => caches.delete(key)))),
  );
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  const route = routeRequest({ method: request.method, url: request.url, mode: request.mode }, scope, precached);
  if (route.kind === 'pass') return;
  const key = route.kind === 'cache' ? route.key : shellKey;
  event.respondWith(
    cachedOrNetwork(
      async () => (await caches.open(CURRENT)).match(key),
      () => fetch(request),
    ),
  );
});

worker.addEventListener('message', (event) => {
  if (isSkipWaitingMessage(event.data)) void worker.skipWaiting();
});
