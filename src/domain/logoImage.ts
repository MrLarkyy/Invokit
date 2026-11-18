import { LIMITS } from './limits';

// Raster formats only: an SVG may carry script and references to other servers.
const LOGO_DATA_URL =
  /^data:image\/(png|jpeg|webp);base64,((?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/;

const startsWith = (bytes: string, magic: string, at = 0) => bytes.slice(at, at + magic.length) === magic;

function matchesMagic(type: string, base64: string): boolean {
  // 16 base64 characters are the first 12 bytes: enough for every signature below.
  const bytes = atob(base64.slice(0, 16));
  if (type === 'png') return startsWith(bytes, '\x89PNG\r\n\x1a\n');
  if (type === 'jpeg') return startsWith(bytes, '\xff\xd8\xff');
  return startsWith(bytes, 'RIFF') && startsWith(bytes, 'WEBP', 8);
}

/**
 * A stored logo: a base64 PNG, JPEG or WebP data URL within LIMITS.logoChars whose bytes start like its declared type.
 * It is only ever shown through an <img>, so a valid one cannot run anything or load anything from elsewhere.
 */
export function isLogoDataUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > LIMITS.logoChars) return false;
  const match = LOGO_DATA_URL.exec(value);
  if (!match || match[2]!.length < 16) return false;
  return matchesMagic(match[1]!, match[2]!);
}
