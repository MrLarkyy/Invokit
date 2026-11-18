import { describe, expect, it } from 'vitest';
import { injectPrecache, precacheEntries, precacheVersion } from './precacheManifest.ts';

describe('precacheEntries', () => {
  const bundle = ['index.html', 'assets/index-abc.js', 'assets/index-abc.js.map', 'sw.js'];
  const publicFiles = [
    'CNAME',
    '.nojekyll',
    'favicon.svg',
    'manifest.webmanifest',
    'icons\\icon-192.png',
    'licenses/OFL-Nunito.txt',
  ];

  it('excludes sw.js, source maps, CNAME and dotfiles', () => {
    const entries = precacheEntries(bundle, publicFiles);
    expect(entries).not.toContain('sw.js');
    expect(entries).not.toContain('assets/index-abc.js.map');
    expect(entries).not.toContain('CNAME');
    expect(entries).not.toContain('.nojekyll');
  });

  it('normalises Windows paths, sorts and dedupes', () => {
    const entries = precacheEntries([...bundle, 'index.html'], publicFiles);
    expect(entries).toContain('icons/icon-192.png');
    expect(entries).toEqual([...entries].sort());
    expect(new Set(entries).size).toBe(entries.length);
  });

  it('keeps the shell, assets, manifest, icons and licences', () => {
    expect(precacheEntries(bundle, publicFiles)).toEqual([
      'assets/index-abc.js',
      'favicon.svg',
      'icons/icon-192.png',
      'index.html',
      'licenses/OFL-Nunito.txt',
      'manifest.webmanifest',
    ]);
  });
});

describe('precacheVersion', () => {
  const files = [
    { name: 'index.html', content: '<html>' },
    { name: 'assets/a.js', content: new Uint8Array([1, 2, 3]) },
  ];

  it('is stable and order independent', async () => {
    const version = await precacheVersion(files);
    expect(version).toMatch(/^[0-9a-f]{12}$/);
    expect(await precacheVersion(files)).toBe(version);
    expect(await precacheVersion([...files].reverse())).toBe(version);
  });

  it('changes when one byte of one file changes', async () => {
    const changed = [files[0]!, { name: 'assets/a.js', content: new Uint8Array([1, 2, 4]) }];
    expect(await precacheVersion(changed)).not.toBe(await precacheVersion(files));
  });
});

describe('injectPrecache', () => {
  const code = 'const v=__INVOO_VERSION__,l=__INVOO_PRECACHE__;';

  it('replaces both placeholders', () => {
    expect(injectPrecache(code, ['index.html'], 'abc')).toBe('const v="abc",l=["index.html"];');
  });

  it('throws when a placeholder is missing', () => {
    expect(() => injectPrecache('const v=__INVOO_VERSION__;', [], 'abc')).toThrow('__INVOO_PRECACHE__');
    expect(() => injectPrecache('const l=__INVOO_PRECACHE__;', [], 'abc')).toThrow('__INVOO_VERSION__');
  });
});
