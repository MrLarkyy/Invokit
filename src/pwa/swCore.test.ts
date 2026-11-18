import { describe, expect, it } from 'vitest';
import { cacheName, cachedOrNetwork, isSkipWaitingMessage, routeRequest, staleCaches } from './swCore';

const scope = 'https://invoo.cz/';
const precached = new Set([
  'https://invoo.cz/assets/a.js',
  'https://invoo.cz/licenses/OFL-Nunito.txt',
  'https://invoo.cz/index.html',
]);
const get = (url: string, mode = 'no-cors') => routeRequest({ method: 'GET', url, mode }, scope, precached);

describe('routeRequest', () => {
  it('serves a precached asset from the cache', () => {
    expect(get('https://invoo.cz/assets/a.js')).toEqual({ kind: 'cache', key: 'https://invoo.cz/assets/a.js' });
  });

  it('passes POST and HEAD', () => {
    for (const method of ['POST', 'HEAD']) {
      const route = routeRequest({ method, url: 'https://invoo.cz/assets/a.js', mode: 'no-cors' }, scope, precached);
      expect(route).toEqual({ kind: 'pass' });
    }
  });

  it('passes cross-origin, data and blob requests', () => {
    expect(get('https://fonts.googleapis.com/css?family=x')).toEqual({ kind: 'pass' });
    expect(get('data:text/plain,hi')).toEqual({ kind: 'pass' });
    expect(get('blob:https://invoo.cz/1234')).toEqual({ kind: 'pass' });
  });

  it('passes same-origin requests outside the scope', () => {
    const route = routeRequest(
      { method: 'GET', url: 'https://x.github.io/other/x', mode: 'navigate' },
      'https://x.github.io/Invokit/',
      new Set(),
    );
    expect(route).toEqual({ kind: 'pass' });
  });

  it('answers a navigation inside the scope with the shell', () => {
    expect(get('https://invoo.cz/?x=1#faktury', 'navigate')).toEqual({ kind: 'shell' });
  });

  it('gives a navigated precached file its own key', () => {
    expect(get('https://invoo.cz/licenses/OFL-Nunito.txt', 'navigate')).toEqual({
      kind: 'cache',
      key: 'https://invoo.cz/licenses/OFL-Nunito.txt',
    });
  });

  it('passes an unknown non-navigation request', () => {
    expect(get('https://invoo.cz/api/x')).toEqual({ kind: 'pass' });
  });

  it('passes an unparsable url', () => {
    expect(get('not a url')).toEqual({ kind: 'pass' });
  });
});

describe('cache names', () => {
  it('prefixes the version', () => {
    expect(cacheName('abc')).toBe('invoo-abc');
  });

  it('deletes only older invoo caches', () => {
    expect(staleCaches(['invoo-old', 'invoo-abc', 'other', 'invoo.data.v2'], 'invoo-abc')).toEqual(['invoo-old']);
  });
});

describe('isSkipWaitingMessage', () => {
  it('accepts only the SKIP_WAITING object', () => {
    expect(isSkipWaitingMessage({ type: 'SKIP_WAITING' })).toBe(true);
    for (const data of [null, 'SKIP_WAITING', ['SKIP_WAITING'], { type: 'x' }, undefined]) {
      expect(isSkipWaitingMessage(data)).toBe(false);
    }
  });
});

describe('cachedOrNetwork', () => {
  const network = () => Promise.resolve('network');

  it('prefers the cached entry', async () => {
    expect(await cachedOrNetwork(() => Promise.resolve('cached'), network)).toBe('cached');
  });

  it('falls back to the network when the entry is missing', async () => {
    expect(await cachedOrNetwork(() => Promise.resolve(undefined), network)).toBe('network');
  });

  it('falls back to the network when the cache lookup fails', async () => {
    expect(await cachedOrNetwork(() => Promise.reject(new Error('evicted')), network)).toBe('network');
  });
});
