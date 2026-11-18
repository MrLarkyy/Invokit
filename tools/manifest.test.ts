import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface IconEntry {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

const root = join(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8')) as Record<
  string,
  unknown
>;
const html = readFileSync(join(root, 'index.html'), 'utf8');
const icons = manifest.icons as IconEntry[];

describe('web app manifest', () => {
  it('describes a standalone app scoped to its own folder', () => {
    expect(manifest).toMatchObject({
      name: 'Invoo',
      short_name: 'Invoo',
      lang: 'cs',
      start_url: './',
      scope: './',
      display: 'standalone',
    });
  });

  it('has no id, which would resolve against the origin instead of the manifest', () => {
    expect(manifest).not.toHaveProperty('id');
  });

  it('uses only relative urls', () => {
    for (const url of [manifest.start_url, manifest.scope, ...icons.map((icon) => icon.src)]) {
      expect(String(url)).not.toMatch(/^(?:[a-z][a-z0-9+.-]*:|\/)/i);
    }
  });

  it('lists 192 and 512 any icons plus a 512 maskable one that exist on disk', () => {
    const key = (icon: IconEntry) => `${icon.sizes}/${icon.purpose}`;
    expect(icons.map(key).sort()).toEqual(['192x192/any', '512x512/any', '512x512/maskable']);
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(existsSync(join(root, 'public', icon.src))).toBe(true);
    }
  });

  it('matches the theme colour and description of index.html', () => {
    expect(html).toContain(`<meta name="theme-color" content="${String(manifest.theme_color)}" />`);
    expect(html).toContain(String(manifest.description));
  });

  it('is linked from index.html together with the apple touch icon, both relative', () => {
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />');
    expect(existsSync(join(root, 'public', 'icons', 'apple-touch-icon.png'))).toBe(true);
  });
});
