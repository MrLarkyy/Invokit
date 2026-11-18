import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng, renderIcon, type IconVariant } from './iconPng.ts';

const ICONS: ReadonlyArray<[string, IconVariant, number]> = [
  ['icon-192.png', 'any', 192],
  ['icon-512.png', 'any', 512],
  ['icon-maskable-512.png', 'maskable', 512],
  ['apple-touch-icon.png', 'apple', 180],
];

function decode(png: Buffer): { width: number; height: number; colourType: number; pixels: Buffer } {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const data: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      data.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (stride + 1)]).toBe(0);
    raw.copy(pixels, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1));
  }
  return { width, height, colourType: png[25] ?? -1, pixels };
}

function pixel(rgba: Uint8Array, size: number, x: number, y: number): number[] {
  const offset = (y * size + x) * 4;
  return [...rgba.subarray(offset, offset + 4)];
}

describe('renderIcon', () => {
  it('leaves the corner of an any icon transparent and the body accent coloured', () => {
    const { rgba } = renderIcon('any', 192);
    expect(pixel(rgba, 192, 0, 0)[3]).toBe(0);
    expect(pixel(rgba, 192, 96, 10)).toEqual([0xff, 0x5b, 0x1f, 255]);
  });

  it('fills the corner of a maskable icon with the accent', () => {
    expect(pixel(renderIcon('maskable', 512).rgba, 512, 0, 0)).toEqual([0xff, 0x5b, 0x1f, 255]);
  });

  it('draws white eyes with dark pupils', () => {
    const { rgba } = renderIcon('maskable', 512);
    expect(pixel(rgba, 512, 168, 256)).toEqual([255, 255, 255, 255]);
    expect(pixel(rgba, 512, 200, 224)).toEqual([0x11, 0x14, 0x13, 255]);
  });
});

describe('committed icons', () => {
  it.each(ICONS)('%s is RGBA at the right size and matches the generator', (file, variant, size) => {
    const decoded = decode(readFileSync(join(import.meta.dirname, '..', 'public', 'icons', file)));
    expect([decoded.width, decoded.height, decoded.colourType]).toEqual([size, size, 6]);
    expect(decoded.pixels.equals(Buffer.from(renderIcon(variant, size).rgba))).toBe(true);
  });

  it('encodes a valid PNG signature and size', () => {
    const png = encodePng(renderIcon('apple', 180));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(decode(png).width).toBe(180);
  });
});
