import { describe, expect, it } from 'vitest';
import { FIXTURE_LOGO } from '../test/invoiceFixture';
import { imageSize } from './imageSize';
import { fitWithin } from './logoFile';

const box = { width: 600, height: 240 };

describe('fitWithin', () => {
  it('shrinks to fit the box and keeps the aspect ratio', () => {
    expect(fitWithin({ width: 3000, height: 1000 }, box)).toEqual({ width: 600, height: 200 });
    expect(fitWithin({ width: 1000, height: 1000 }, box)).toEqual({ width: 240, height: 240 });
    expect(fitWithin({ width: 1200, height: 240 }, box)).toEqual({ width: 600, height: 120 });
  });

  it('never enlarges and never reaches 0 px', () => {
    expect(fitWithin({ width: 120, height: 40 }, box)).toEqual({ width: 120, height: 40 });
    expect(fitWithin({ width: 100_000, height: 1 }, box)).toEqual({ width: 600, height: 1 });
  });
});

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(parts.flatMap((part) => (typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part)));
const pad = (n: number) => new Array<number>(n).fill(0);

describe('imageSize', () => {
  it('reads the declared size of a PNG without decoding it', () => {
    const png = Uint8Array.from(atob(FIXTURE_LOGO.split(',')[1]!), (c) => c.charCodeAt(0));
    expect(imageSize(png)).toEqual({ width: 1, height: 1 });
    // An invented header declaring 20 000 × 20 000 px.
    const bomb = bytes('\x89PNG\r\n\x1a\n', [0, 0, 0, 13], 'IHDR', [0, 0, 0x4e, 0x20, 0, 0, 0x4e, 0x20], pad(20));
    expect(imageSize(bomb)).toEqual({ width: 20_000, height: 20_000 });
  });

  it('reads a JPEG size from its frame header, past other segments', () => {
    const jpeg = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 6], 'JFIF', [0xff, 0xc0, 0, 17, 8, 0x0b, 0xb8, 0x0f, 0xa0], pad(20));
    expect(imageSize(jpeg)).toEqual({ width: 4000, height: 3000 });
  });

  it('reads the three WebP headers', () => {
    const riff = (chunk: string, body: number[]) => bytes('RIFF', [0, 0, 0, 0], 'WEBP', chunk, body, pad(20));
    expect(imageSize(riff('VP8X', [0, 0, 0, 0, 0, 0, 0, 0, 0x1f, 0x03, 0, 0xc7, 0, 0]))).toEqual({
      width: 800,
      height: 200,
    });
    expect(imageSize(riff('VP8 ', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x03, 0xc8, 0]))).toEqual({
      width: 800,
      height: 200,
    });
    // VP8L: 14-bit width-1 and height-1 packed after the 0x2f signature byte.
    const w = 799;
    const h = 199;
    const vp8l = [0, 0, 0, 0, 0x2f, w & 0xff, ((w >> 8) & 0x3f) | ((h & 0x03) << 6), (h >> 2) & 0xff, (h >> 10) & 0x0f];
    expect(imageSize(riff('VP8L', vp8l))).toEqual({ width: 800, height: 200 });
  });

  it('gives null for anything else or a cut header', () => {
    expect(imageSize(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(imageSize(bytes('\x89PNG'))).toBeNull();
    expect(imageSize(bytes([0xff, 0xd8, 0x00], pad(40)))).toBeNull();
  });
});
