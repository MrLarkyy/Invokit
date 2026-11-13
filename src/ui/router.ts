import { useMemo, useSyncExternalStore } from 'react';

/** Hash routes (#faktury, #nova-faktura…): no server configuration, so any static hosting works. */
export type Route =
  | { name: 'uvod' }
  | { name: 'faktury' }
  | { name: 'nova' }
  | { name: 'upravit'; id: string }
  | { name: 'faktura'; id: string }
  | { name: 'nastaveni' };

const MAX_HASH = 100;
const ID = /^[A-Za-z0-9-]{1,64}$/;

/** The route of a hash; null for an empty hash. The id is only ever compared, never rendered as markup. */
export function parseHash(hash: string): Route | null {
  if (hash.length > MAX_HASH) return { name: 'uvod' };
  const value = hash.replace(/^#/, '');
  if (value === '') return null;
  if (value === 'faktury') return { name: 'faktury' };
  if (value === 'nova-faktura') return { name: 'nova' };
  if (value === 'nastaveni') return { name: 'nastaveni' };
  const match = /^(upravit|faktura)-(.+)$/.exec(value);
  if (match && ID.test(match[2] ?? '')) {
    return match[1] === 'upravit' ? { name: 'upravit', id: match[2] ?? '' } : { name: 'faktura', id: match[2] ?? '' };
  }
  return { name: 'uvod' };
}

/** Where an empty hash leads: the invoices once there is something to show, otherwise the landing page. */
export function startRoute(data: { invoices: unknown[]; supplier: unknown }): Route {
  return data.invoices.length > 0 || data.supplier !== null ? { name: 'faktury' } : { name: 'uvod' };
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'uvod':
      return '#uvod';
    case 'faktury':
      return '#faktury';
    case 'nova':
      return '#nova-faktura';
    case 'nastaveni':
      return '#nastaveni';
    case 'upravit':
      return `#upravit-${route.id}`;
    case 'faktura':
      return `#faktura-${route.id}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = toHash(route);
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

export function useHashRoute(): Route | null {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return useMemo(() => parseHash(hash), [hash]);
}
