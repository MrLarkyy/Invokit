import { isLogoDataUrl } from '../domain/logoImage';
import { imageSize, type ImageSize } from './imageSize';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
// Twice the size the logo prints at, so it stays sharp on paper.
const BOX = { width: 600, height: 240 };

export const LOGO_ERRORS = {
  type: 'Logo musí být PNG, JPEG nebo WebP.',
  fileSize: 'Logo je příliš velké (nejvýš 5 MB).',
  pixels: 'Logo má příliš mnoho pixelů (nejvýš 40 megapixelů).',
  unreadable: 'Obrázek se nepodařilo načíst.',
  tooLarge: 'Logo se nepodařilo zmenšit pod 50 kB.',
} as const;

/** The size that fits within the box with the same aspect ratio; never larger than the original, at least 1 px. */
export function fitWithin(size: ImageSize, box: ImageSize): ImageSize {
  const scale = Math.min(1, box.width / size.width, box.height / size.height);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

function encode(bitmap: ImageBitmap, size: ImageSize, type: string): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  // JPEG has no transparency: a transparent logo would turn black without a white ground.
  if (type === 'image/jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const url = canvas.toDataURL(type, 0.85);
  // A browser without a WebP encoder returns PNG instead.
  return url.startsWith(`data:${type};`) && isLogoDataUrl(url) ? url : null;
}

/**
 * Reads a logo the user picked into a small data URL: checked by type, file size and pixel count before it is
 * decoded and drawn, shrunk to fit 600 × 240, and re-encoded (PNG, else WebP, else JPEG), so nothing of the original
 * file but its pixels is kept. Everything happens in the browser; nothing is sent anywhere. Throws a Czech message.
 */
export async function readLogoFile(file: File): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error(LOGO_ERRORS.type);
  if (file.size > MAX_FILE_BYTES) throw new Error(LOGO_ERRORS.fileSize);
  let bitmap: ImageBitmap;
  try {
    const declared = imageSize(new Uint8Array(await file.arrayBuffer()));
    if (declared && declared.width * declared.height > MAX_PIXELS) throw new Error(LOGO_ERRORS.pixels);
    bitmap = await createImageBitmap(file);
  } catch (error) {
    throw error instanceof Error && error.message === LOGO_ERRORS.pixels ? error : new Error(LOGO_ERRORS.unreadable);
  }
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error(LOGO_ERRORS.pixels);
    for (const scale of [1, 0.5]) {
      const size = fitWithin(bitmap, { width: BOX.width * scale, height: BOX.height * scale });
      for (const type of ['image/png', 'image/webp', 'image/jpeg']) {
        const url = encode(bitmap, size, type);
        if (url) return url;
      }
    }
    throw new Error(LOGO_ERRORS.tooLarge);
  } finally {
    bitmap.close();
  }
}
