import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng, renderIcon, type IconVariant } from './iconPng.ts';

const ICONS: ReadonlyArray<{ file: string; variant: IconVariant; size: number }> = [
  { file: 'icon-192.png', variant: 'any', size: 192 },
  { file: 'icon-512.png', variant: 'any', size: 512 },
  { file: 'icon-maskable-512.png', variant: 'maskable', size: 512 },
  { file: 'apple-touch-icon.png', variant: 'apple', size: 180 },
];

const directory = join(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(directory, { recursive: true });
for (const icon of ICONS) {
  writeFileSync(join(directory, icon.file), encodePng(renderIcon(icon.variant, icon.size)));
}
