import type { Invoice } from '../domain/invoice';
import { emptyAppData, type AppData } from './appData';
import { parseAppData, parseDraft } from './appDataSchema';
import { isRecord, own } from './untrustedJson';
import { readInvoiceV1 } from './appDataV1';
import { migrateDraftV1 } from './migrateV1';

// Everything stays in this browser; the JSON backup is the way to move it or keep it safe.
// The key keeps its name: the schema version is inside the data (3 since templates), older ones are migrated on load.
export const DATA_KEY = 'invoo.data.v2';
export const BROKEN_DATA_KEY = 'invoo.data.v2.broken';
export const DRAFT_KEY = 'invoo.draft.v2';
// Written by the app before the rename; read to migrate, removed only on the user's request after a backup.
export const LEGACY_DATA_KEY = 'invokit.data.v1';
export const LEGACY_DRAFT_KEY = 'invokit.draft.v1';

const CURRENT_VERSION: AppData['version'] = 3;

export interface LoadedAppData {
  data: AppData;
  /** The stored data could not be read: the app starts empty and says so. */
  recovered: boolean;
  /** The unreadable stored text, offered to the user as a download. */
  unreadableText: string | null;
  /** The unreadable text could not be kept aside, so nothing may be written this session (it stays in place). */
  readOnly: boolean;
  /** The Invokit data was migrated but could not be written (storage full): the old key is the only copy. */
  legacyBlocking: boolean;
  /**
   * The data key holds the current schema: read so, or written just now. Older data is migrated in memory only and
   * stays as it is stored until the first change.
   */
  storedCurrent: boolean;
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
  // A draft already stored as v2 is the user's current one: a start that migrates again must not replace it.
  if (!raw || loadDraft(storage) !== null) return;
  try {
    const draftV1 = readInvoiceV1(JSON.parse(raw), 'koncept');
    // Invokit kept the last printed invoice as its draft: one already saved is not a new invoice.
    if (data.invoices.some((i) => i.number.trim() === draftV1.number.trim())) return;
    const draft = migrateDraftV1(draftV1, new Set(data.invoices.map((i) => i.id)));
    write(storage, DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // An unreadable old draft is skipped; the old key stays as it was.
  }
}

function unreadable(text: string, readOnly: boolean): LoadedAppData {
  return {
    data: emptyAppData(),
    recovered: true,
    unreadableText: text,
    readOnly,
    legacyBlocking: false,
    storedCurrent: false,
  };
}

/** The schema version a stored text names; undefined when it is not a JSON object. */
function storedVersion(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? own(value, 'version') : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads `invoo.data.v2` (which holds schema version 3; older versions are migrated). Corrupt data is first kept as
 * `invoo.data.v2.broken` (an older copy there is never overwritten); when that is impossible the session writes
 * nothing. Without data under that key, the Invokit data and draft are migrated and written there in the current
 * schema; the old keys are left untouched.
 */
export function loadAppData(storage: Storage): LoadedAppData {
  const raw = read(storage, DATA_KEY);
  if (raw !== null) {
    try {
      return {
        data: parseAppData(raw),
        recovered: false,
        unreadableText: null,
        readOnly: false,
        legacyBlocking: false,
        storedCurrent: storedVersion(raw) === CURRENT_VERSION,
      };
    } catch {
      const kept = read(storage, BROKEN_DATA_KEY);
      const safe = kept === raw || (kept === null && write(storage, BROKEN_DATA_KEY, raw));
      return unreadable(raw, !safe);
    }
  }
  const legacy = read(storage, LEGACY_DATA_KEY);
  let data = emptyAppData();
  if (legacy !== null) {
    try {
      data = parseAppData(legacy);
    } catch {
      // The old key is never written, so the new data may be stored next to it.
      return unreadable(legacy, false);
    }
  }
  migrateLegacyDraft(storage, data);
  const saved = saveAppData(storage, data);
  return {
    data,
    recovered: false,
    unreadableText: null,
    readOnly: false,
    legacyBlocking: legacy !== null && !saved,
    storedCurrent: saved,
  };
}

/** What another tab wrote under DATA_KEY. */
export type StoredDataChange =
  | { kind: 'current'; data: AppData }
  /**
   * An Invoo from before schema version 3 is still open and wrote its own, older data: here migrated to the current
   * schema, or null when it does not pass the checks.
   */
  | { kind: 'older'; data: AppData | null }
  | { kind: 'unreadable' };

/** Sorts a text of the data key: current data, data of an older Invoo, or something unreadable. */
export function readStoredChange(text: string): StoredDataChange {
  const version = storedVersion(text);
  const older = version === 1 || version === 2;
  if (!older && version !== CURRENT_VERSION) return { kind: 'unreadable' };
  let data: AppData | null = null;
  try {
    data = parseAppData(text);
  } catch {
    // Left null: an older text is told apart by its version alone.
  }
  if (older) return { kind: 'older', data };
  return data ? { kind: 'current', data } : { kind: 'unreadable' };
}

export function hasLegacyData(storage: Storage): boolean {
  return read(storage, LEGACY_DATA_KEY) !== null;
}

/** Removes the Invokit keys; the UI calls it only after a backup download and the user's confirmation. */
export function removeLegacyData(storage: Storage): boolean {
  try {
    storage.removeItem(LEGACY_DATA_KEY);
    storage.removeItem(LEGACY_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
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
