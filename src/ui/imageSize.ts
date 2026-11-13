export interface ImageSize {
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32be = (b: Uint8Array, i: number) => u16be(b, i) * 65_536 + u16be(b, i + 2);
const ascii = (b: Uint8Array, i: number, text: string) => [...text].every((char, n) => b[i + n] === char.charCodeAt(0));

function jpegSize(b: Uint8Array): ImageSize | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i += 1;
    } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: u16be(b, i + 7), height: u16be(b, i + 5) };
    } else {
      i += 2 + u16be(b, i + 2);
    }
  }
  return null;
}

function webpSize(b: Uint8Array): ImageSize | null {
  if (ascii(b, 12, 'VP8X')) return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  if (ascii(b, 12, 'VP8 ')) return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (ascii(b, 12, 'VP8L')) {
    const [b0, b1, b2, b3] = [b[21]!, b[22]!, b[23]!, b[24]!];
    return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
  }
  return null;
}

/**
 * The pixel size a PNG, JPEG or WebP file declares in its header, read without decoding it, so that a small file that
 * would decode into a huge bitmap is refused first. Null when the header is not one of these or is cut short.
 */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) return null;
  if (ascii(bytes, 0, '\x89PNG') && ascii(bytes, 12, 'IHDR')) {
    return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes);
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) return webpSize(bytes);
  return null;
}
