import { crc32, deflateSync } from 'node:zlib';

export type IconVariant = 'any' | 'maskable' | 'apple';

export interface Raster {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export type Rgb = readonly [number, number, number];

// Geometry of public/favicon.svg in its 64 x 64 viewBox; tools/iconGeometry.test.ts compares it with the file.
export const VIEW = 64;
export const ACCENT: Rgb = [0xff, 0x5b, 0x1f];
export const WHITE: Rgb = [0xff, 0xff, 0xff];
export const INK: Rgb = [0x11, 0x14, 0x13];
export const CORNER_RADIUS = 16;
export const EYES = [
  { x: 21, y: 32, pupilX: 25, pupilY: 28 },
  { x: 43, y: 32, pupilX: 47, pupilY: 28 },
] as const;
export const EYE_RADIUS = 11;
export const PUPIL_RADIUS = 4.6;
const SAMPLES = 4;

function inCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inRoundedSquare(x: number, y: number): boolean {
  const cx = Math.min(Math.max(x, CORNER_RADIUS), VIEW - CORNER_RADIUS);
  const cy = Math.min(Math.max(y, CORNER_RADIUS), VIEW - CORNER_RADIUS);
  return inCircle(x, y, cx, cy, CORNER_RADIUS);
}

// The eyes reach 22 units from the centre, inside the 25.6 radius of the 80 % maskable safe zone.
function colourAt(variant: IconVariant, x: number, y: number): Rgb | null {
  if (variant === 'any' && !inRoundedSquare(x, y)) return null;
  for (const eye of EYES) {
    if (inCircle(x, y, eye.pupilX, eye.pupilY, PUPIL_RADIUS)) return INK;
  }
  for (const eye of EYES) {
    if (inCircle(x, y, eye.x, eye.y, EYE_RADIUS)) return WHITE;
  }
  return ACCENT;
}

export function renderIcon(variant: IconVariant, size: number): Raster {
  const rgba = new Uint8Array(size * size * 4);
  const step = VIEW / (size * SAMPLES);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const colour = colourAt(variant, (px * SAMPLES + sx + 0.5) * step, (py * SAMPLES + sy + 0.5) * step);
          if (!colour) continue;
          covered++;
          sum[0] = (sum[0] ?? 0) + colour[0];
          sum[1] = (sum[1] ?? 0) + colour[1];
          sum[2] = (sum[2] ?? 0) + colour[2];
        }
      }
      const offset = (py * size + px) * 4;
      if (covered === 0) continue;
      rgba[offset] = Math.round((sum[0] ?? 0) / covered);
      rgba[offset + 1] = Math.round((sum[1] ?? 0) / covered);
      rgba[offset + 2] = Math.round((sum[2] ?? 0) / covered);
      rgba[offset + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return { width: size, height: size, rgba };
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

export function encodePng(raster: Raster): Buffer {
  const { width, height, rgba } = raster;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    rows.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
