export interface RequestInfo {
  method: string;
  url: string;
  mode: string;
}

export type Route = { kind: 'cache'; key: string } | { kind: 'shell' } | { kind: 'pass' };

const CACHE_PREFIX = 'invoo-';

export function cacheName(version: string): string {
  return `${CACHE_PREFIX}${version}`;
}

export function staleCaches(keys: readonly string[], current: string): string[] {
  return keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== current);
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
  return request.mode === 'navigate' ? { kind: 'shell' } : { kind: 'pass' };
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
