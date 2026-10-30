import { type AppData, emptyAppData } from './appData';

// Everything stays in this browser; the JSON backup is the way to move it or keep it safe.
const KEY = 'invokit.data.v1';

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseAppData(raw) : emptyAppData();
  } catch {
    return emptyAppData();
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private mode or a full quota: the app keeps working for this visit.
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Parses a backup or stored data; throws a Czech message when it is not Invokit data. */
export function parseAppData(text: string): AppData {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Soubor není platný JSON.');
  }
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !Array.isArray(value.customers) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.invoices)
  ) {
    throw new Error('Soubor není záloha Invokitu.');
  }
  return value as unknown as AppData;
}
