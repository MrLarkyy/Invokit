import { describe, expect, it } from 'vitest';
import { atMostOnce, cacheName, cachedOrNetwork, isSkipWaitingMessage, routeRequest, staleCaches } from './swCore';

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

  it('answers a navigation to the scope root or index.html with the shell', () => {
    expect(get('https://invoo.cz/', 'navigate')).toEqual({ kind: 'shell' });
    expect(get('https://invoo.cz/index.html?x=1', 'navigate')).toEqual({ kind: 'shell' });
    expect(get('https://invoo.cz/?x=1#faktury', 'navigate')).toEqual({ kind: 'shell' });
  });

  describe('under a project path', () => {
    const projectScope = 'https://x.github.io/Invokit/';
    const projectPrecached = new Set(['https://x.github.io/Invokit/assets/x.js']);
    const navigate = (url: string) =>
      routeRequest({ method: 'GET', url, mode: 'navigate' }, projectScope, projectPrecached);

    it('serves the shell for the root and index.html only', () => {
      for (const url of [
        'https://x.github.io/Invokit/',
        'https://x.github.io/Invokit/index.html?x=1',
        'https://x.github.io/Invokit/?x=1#faktury',
      ]) {
        expect(navigate(url)).toEqual({ kind: 'shell' });
      }
    });

    it('leaves other navigations to the server', () => {
      for (const path of ['neexistuje', 'a/b', 'sw.js']) {
        expect(navigate(`https://x.github.io/Invokit/${path}`)).toEqual({ kind: 'pass' });
      }
    });

    it('serves a precached asset from the cache', () => {
      expect(navigate('https://x.github.io/Invokit/assets/x.js')).toEqual({
        kind: 'cache',
        key: 'https://x.github.io/Invokit/assets/x.js',
      });
    });

    it('passes the path without the slash and a sibling path', () => {
      expect(navigate('https://x.github.io/Invokit')).toEqual({ kind: 'pass' });
      expect(navigate('https://x.github.io/Invokit2/')).toEqual({ kind: 'pass' });
    });
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
  const invokit = 'https://x.github.io/Invokit/';
  const other = 'https://x.github.io/Jina/';

  it('carries the scope path and the version', () => {
    expect(cacheName(invokit, 'abc')).toBe('invoo-%2FInvokit%2F-abc');
  });

  it('deletes only older caches of the same scope', () => {
    const keys = [
      cacheName(invokit, 'old'),
      cacheName(invokit, 'abc'),
      cacheName(other, 'old'),
      'other',
      'invoo.data.v2',
    ];
    expect(staleCaches(keys, invokit, cacheName(invokit, 'abc'))).toEqual([cacheName(invokit, 'old')]);
  });

  it('does not match a scope nested under another', () => {
    const outer = 'https://x.github.io/a/';
    const inner = 'https://x.github.io/a/b/';
    expect(staleCaches([cacheName(inner, 'old')], outer, cacheName(outer, 'new'))).toEqual([]);
    expect(staleCaches([cacheName(outer, 'old')], inner, cacheName(inner, 'new'))).toEqual([]);
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

describe('atMostOnce', () => {
  it('runs the task once while it is running and after it succeeded', async () => {
    let runs = 0;
    const once = atMostOnce(() => {
      runs++;
      return Promise.resolve();
    });
    const first = once();
    const second = once();
    await Promise.all([first, second]);
    await once();
    expect(runs).toBe(1);
  });

  it('does not retry after a failure and does not reject', async () => {
    let runs = 0;
    const once = atMostOnce(() => {
      runs++;
      return Promise.reject(new Error('offline'));
    });
    await once();
    await once();
    expect(runs).toBe(1);
  });
});
