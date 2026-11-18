export interface HashedFile {
  name: string;
  content: Uint8Array | string;
}

const EXCLUDED_NAMES = new Set(['sw.js', 'CNAME']);

export function normalise(name: string): string {
  return name.replaceAll('\\', '/').replace(/^\.?\//, '');
}

function isPrecached(name: string): boolean {
  if (EXCLUDED_NAMES.has(name) || name.endsWith('.map')) return false;
  return !name.split('/').some((part) => part.startsWith('.'));
}

export function precacheEntries(bundleNames: readonly string[], publicNames: readonly string[]): string[] {
  const names = [...bundleNames, ...publicNames].map(normalise).filter(isPrecached);
  return [...new Set(names)].sort();
}

function toBytes(content: Uint8Array | string): Uint8Array {
  return typeof content === 'string' ? new TextEncoder().encode(content) : content;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Order-independent: every file contributes its name and the hash of its bytes, sorted by name.
export async function precacheVersion(files: readonly HashedFile[]): Promise<string> {
  const lines = await Promise.all(
    files.map(async (file) => `${normalise(file.name)}\0${await sha256Hex(toBytes(file.content))}`),
  );
  return (await sha256Hex(new TextEncoder().encode(lines.sort().join('\n')))).slice(0, 12);
}

const PLACEHOLDERS = { precache: '__INVOO_PRECACHE__', version: '__INVOO_VERSION__' } as const;

function replacePlaceholder(code: string, name: string, value: string): string {
  if (!code.includes(name)) throw new Error(`Service worker lacks the placeholder ${name}.`);
  const replaced = code.split(name).join(value);
  if (replaced.includes(name)) throw new Error(`Placeholder ${name} is still present.`);
  return replaced;
}

export function injectPrecache(code: string, entries: readonly string[], version: string): string {
  const withList = replacePlaceholder(code, PLACEHOLDERS.precache, JSON.stringify(entries));
  return replacePlaceholder(withList, PLACEHOLDERS.version, JSON.stringify(version));
}
