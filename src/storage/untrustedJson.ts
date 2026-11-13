// Field readers for parsed JSON from a file or localStorage. They read own properties only and return fresh
// values, so a hostile key (`__proto__`, `constructor`) is never followed, spread or assigned.

export type JsonRecord = Record<string, unknown>;

export function invalidData(path: string): never {
  throw new Error(`Záloha obsahuje neplatný údaj: ${path}.`);
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown, path: string): JsonRecord {
  return isRecord(value) ? value : invalidData(path);
}

export function own(record: JsonRecord, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** A string at most `max` long; `fallback` is used when the key is missing (older files), else it is required. */
export function readString(record: JsonRecord, key: string, path: string, max: number, fallback?: string): string {
  const value = own(record, key);
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string') return invalidData(`${path}, ${key}`);
  if (value.length > max) throw new Error(`Záloha obsahuje příliš dlouhý text: ${path}, ${key}.`);
  return value;
}

export function readBoolean(record: JsonRecord, key: string, path: string, fallback?: boolean): boolean {
  const value = own(record, key);
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === 'boolean' ? value : invalidData(`${path}, ${key}`);
}

/** An integer within ±`max`; `1.5`, `"100"` and `1e300` are rejected. */
export function readInteger(record: JsonRecord, key: string, path: string, max: number): number {
  const value = own(record, key);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Math.abs(value) > max) {
    return invalidData(`${path}, ${key}`);
  }
  return value;
}

/** An array of at most `max` entries; `tooMany` is the Czech message when it has more. */
export function readArray(record: JsonRecord, key: string, path: string, max: number, tooMany: string): unknown[] {
  const value = own(record, key);
  if (!Array.isArray(value)) return invalidData(`${path}, ${key}`);
  if (value.length > max) throw new Error(tooMany);
  return value;
}
