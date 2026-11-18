export interface RequestInfo {
  method: string;
  url: string;
  mode: string;
}

export type Route = { kind: 'cache'; key: string } | { kind: 'shell' } | { kind: 'pass' };

function scopePrefix(scope: string): string {
  return `invoo-${encodeURIComponent(new URL(scope).pathname)}-`;
}

// The scope path is part of the name so two copies on one origin never delete each other's caches.
export function cacheName(scope: string, version: string): string {
  return `${scopePrefix(scope)}${version}`;
}

export function staleCaches(keys: readonly string[], scope: string, current: string): string[] {
  const prefix = scopePrefix(scope);
  return keys.filter((key) => key.startsWith(prefix) && key !== current);
}

export function isSkipWaitingMessage(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    (data as { type?: unknown }).type === 'SKIP_WAITING'
  );
}

function parse(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

export function routeRequest(request: RequestInfo, scope: string, precached: ReadonlySet<string>): Route {
  if (request.method !== 'GET') return { kind: 'pass' };
  const url = parse(request.url);
  const scopeUrl = parse(scope);
  if (!url || !scopeUrl) return { kind: 'pass' };
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return { kind: 'pass' };
  const key = `${url.origin}${url.pathname}${url.search}`;
  if (precached.has(key)) return { kind: 'cache', key };
  // Hash routing has one document: only the scope root and index.html are the shell, other paths stay the server's.
  const below = url.pathname.slice(scopeUrl.pathname.length);
  const isShell = request.mode === 'navigate' && (below === '' || below === 'index.html');
  return isShell ? { kind: 'shell' } : { kind: 'pass' };
}

// The browser may evict Cache Storage; a missing or unreadable entry falls back to the network.
export async function cachedOrNetwork<T>(lookup: () => Promise<T | undefined>, network: () => Promise<T>): Promise<T> {
  try {
    const cached = await lookup();
    if (cached !== undefined) return cached;
  } catch {
    // fall through to the network
  }
  return network();
}

// Runs the task on the first call only; later calls share its outcome, so a failure is never retried in a loop.
export function atMostOnce(task: () => Promise<void>): () => Promise<void> {
  let started: Promise<void> | null = null;
  return () => {
    started ??= task().catch(() => undefined);
    return started;
  };
}
