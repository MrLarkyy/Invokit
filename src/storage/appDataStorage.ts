import type { Invoice } from '../domain/invoice';
import { emptyAppData, type AppData } from './appData';
import { parseAppData, parseDraft } from './appDataSchema';
import { readInvoiceV1 } from './appDataV1';
import { migrateDraftV1 } from './migrateV1';

// Everything stays in this browser; the JSON backup is the way to move it or keep it safe.
export const DATA_KEY = 'invoo.data.v2';
export const BROKEN_DATA_KEY = 'invoo.data.v2.broken';
export const DRAFT_KEY = 'invoo.draft.v2';
// Written by the app before the rename; read once to migrate and never deleted.
export const LEGACY_DATA_KEY = 'invokit.data.v1';
export const LEGACY_DRAFT_KEY = 'invokit.draft.v1';

export interface LoadedAppData {
  data: AppData;
  /** The stored data could not be read: the app starts empty and says so. */
  recovered: boolean;
}

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Returns false when the browser refuses (private mode, full quota). */
export function saveAppData(storage: Storage, data: AppData): boolean {
  return write(storage, DATA_KEY, JSON.stringify(data));
}

function migrateLegacyDraft(storage: Storage, data: AppData): void {
  const raw = read(storage, LEGACY_DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = migrateDraftV1(readInvoiceV1(JSON.parse(raw), 'koncept'), new Set(data.invoices.map((i) => i.id)));
    write(storage, DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // An unreadable old draft is skipped; the old key stays as it was.
  }
}

/**
 * Loads `invoo.data.v2`. Corrupt data is copied to `invoo.data.v2.broken` before anything overwrites it. Without v2
 * data, the Invokit data and draft are migrated once and written as v2; the old keys are left untouched.
 */
export function loadAppData(storage: Storage): LoadedAppData {
  const raw = read(storage, DATA_KEY);
  if (raw !== null) {
    try {
      return { data: parseAppData(raw), recovered: false };
    } catch {
      write(storage, BROKEN_DATA_KEY, raw);
      return { data: emptyAppData(), recovered: true };
    }
  }
  const legacy = read(storage, LEGACY_DATA_KEY);
  let loaded: LoadedAppData = { data: emptyAppData(), recovered: false };
  if (legacy !== null) {
    try {
      loaded = { data: parseAppData(legacy), recovered: false };
    } catch {
      return { data: emptyAppData(), recovered: true };
    }
  }
  migrateLegacyDraft(storage, loaded.data);
  saveAppData(storage, loaded.data);
  return loaded;
}

/** The unsaved new invoice; null when there is none or it is not valid. */
export function loadDraft(storage: Storage): Invoice | null {
  const raw = read(storage, DRAFT_KEY);
  return raw === null ? null : parseDraft(raw);
}

/** Stores the draft, or removes it for null; false when the browser refuses. */
export function saveDraft(storage: Storage, draft: Invoice | null): boolean {
  if (draft) return write(storage, DRAFT_KEY, JSON.stringify(draft));
  try {
    storage.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}
