import type { Invoice } from '../domain/invoice';
import { emptyAppData, type AppData } from './appData';
import { parseAppData, parseDraft } from './appDataSchema';
import { isRecord, own } from './untrustedJson';
import { readInvoiceV1 } from './appDataV1';
import { migrateDraftV1 } from './migrateV1';

// Everything stays in this browser; the JSON backup is the way to move it or keep it safe.
// Schema version 3 has its own keys: an Invoo from before it, still open in another tab, cannot read version 3 and
// keeps saving under the previous keys, where it can no longer overwrite anything of this version.
export const DATA_KEY = 'invoo.data.v3';
export const BROKEN_DATA_KEY = 'invoo.data.v3.broken';
export const DRAFT_KEY = 'invoo.draft.v3';
// Read until the first stored write under the data key, which removes them. Never written, except to put the very
// same text back when that first write does not fit.
export const PREVIOUS_DATA_KEY = 'invoo.data.v2';
export const PREVIOUS_BROKEN_KEY = 'invoo.data.v2.broken';
export const PREVIOUS_DRAFT_KEY = 'invoo.draft.v2';
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
  /** Nothing may be written: unreadable text could not be kept aside (it stays in place), or the data is newer. */
  readOnly: boolean;
  /** The Invokit data was migrated but could not be written (storage full): the old key is the only copy. */
  legacyBlocking: boolean;
  /** The text under the data key when loading finished (null: none), to tell a write another tab made since. */
  storedText: string | null;
  /** The text under the previous key the data was read from, nothing being under the data key yet; else null. */
  previousText: string | null;
  /** Text lies under the previous key next to the data key: an older Invoo saved it after the data moved on. */
  olderAside: boolean;
  /** The data key holds a schema newer than this Invoo knows: it is left as it is. */
  newer: boolean;
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

function remove(storage: Storage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
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

function isNewer(text: string): boolean {
  const version = storedVersion(text);
  return typeof version === 'number' && version > CURRENT_VERSION;
}

/**
 * Stores the text of the data under the data key; false when the browser refuses (private mode, full quota). The
 * caller has just read the key, so what it replaces is known to it.
 *
 * The first write under the data key is the move from the previous key: `previousText` is the text this tab's data
 * was read from. Once the data is stored, the previous key is removed if it still holds that text; anything else
 * there was saved by an older Invoo since and stays. When both texts do not fit, the previous one makes room first
 * and is put back unchanged if the write is refused again.
 */
export function writeDataText(storage: Storage, text: string, previousText: string | null): boolean {
  if (read(storage, DATA_KEY) !== null) return write(storage, DATA_KEY, text);
  const superseded = () => previousText !== null && read(storage, PREVIOUS_DATA_KEY) === previousText;
  if (write(storage, DATA_KEY, text)) {
    if (superseded()) remove(storage, PREVIOUS_DATA_KEY);
    return true;
  }
  if (previousText === null || !superseded() || !remove(storage, PREVIOUS_DATA_KEY)) return false;
  if (write(storage, DATA_KEY, text)) return true;
  // An older Invoo may have saved in between: its text is newer than the one taken away.
  if (read(storage, PREVIOUS_DATA_KEY) === null) write(storage, PREVIOUS_DATA_KEY, previousText);
  return false;
}

function migrateLegacyDraft(storage: Storage, data: AppData): void {
  const raw = read(storage, LEGACY_DRAFT_KEY);
  // A draft already stored is the user's current one: a start that migrates again must not replace it.
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

function loaded(data: AppData, special: Partial<LoadedAppData>): LoadedAppData {
  return {
    data,
    recovered: false,
    unreadableText: null,
    readOnly: false,
    legacyBlocking: false,
    storedText: null,
    previousText: null,
    olderAside: false,
    newer: false,
    ...special,
  };
}

/** An empty start for unreadable text; `brokenKey` takes a copy unless it holds another one (null: none needed). */
function unreadable(
  storage: Storage,
  text: string,
  brokenKey: string | null,
  special: Partial<LoadedAppData>,
): LoadedAppData {
  const kept = brokenKey === null ? text : read(storage, brokenKey);
  const safe = kept === text || (brokenKey !== null && kept === null && write(storage, brokenKey, text));
  return loaded(emptyAppData(), { ...special, recovered: true, unreadableText: text, readOnly: !safe });
}

/** What a text of the data key or the previous key holds. */
export type StoredDataChange = { kind: 'data'; data: AppData } | { kind: 'newer' } | { kind: 'unreadable' };

/** Reads a stored text: its data in the current schema (older versions migrated), a newer schema, or neither. */
export function readStoredChange(text: string): StoredDataChange {
  try {
    return { kind: 'data', data: parseAppData(text) };
  } catch {
    return { kind: isNewer(text) ? 'newer' : 'unreadable' };
  }
}

/**
 * Loads the data key `invoo.data.v3`; without it the previous key `invoo.data.v2`, migrated in memory only (nothing
 * is written until the first change, so an older Invoo in another tab keeps working on it); without both, the
 * Invokit data and draft, migrated and written under the data key (the Invokit keys are left untouched).
 *
 * Unreadable text is first copied to the key's `.broken` twin (a different copy there is never overwritten); when
 * that is impossible the session writes nothing. A newer schema under the data key is neither copied nor replaced:
 * the tab starts empty and writes nothing.
 */
export function loadAppData(storage: Storage): LoadedAppData {
  const raw = read(storage, DATA_KEY);
  const previous = read(storage, PREVIOUS_DATA_KEY);
  if (raw !== null) {
    const stored = { storedText: raw, olderAside: previous !== null };
    const change = readStoredChange(raw);
    if (change.kind === 'data') return loaded(change.data, stored);
    if (change.kind === 'newer') return loaded(emptyAppData(), { ...stored, readOnly: true, newer: true });
    return unreadable(storage, raw, BROKEN_DATA_KEY, stored);
  }
  if (previous !== null) {
    const change = readStoredChange(previous);
    if (change.kind === 'data') return loaded(change.data, { previousText: previous });
    return unreadable(storage, previous, PREVIOUS_BROKEN_KEY, { previousText: previous });
  }
  const legacy = read(storage, LEGACY_DATA_KEY);
  let data = emptyAppData();
  if (legacy !== null) {
    try {
      data = parseAppData(legacy);
    } catch {
      // The old key is never written, so the new data may be stored next to it.
      return unreadable(storage, legacy, null, {});
    }
  }
  migrateLegacyDraft(storage, data);
  const text = JSON.stringify(data);
  const saved = write(storage, DATA_KEY, text);
  return loaded(data, { legacyBlocking: legacy !== null && !saved, storedText: saved ? text : null });
}

/** The text under the data key as it is now; null when there is none or it cannot be read. */
export function readDataText(storage: Storage): string | null {
  return read(storage, DATA_KEY);
}

/** The text under the previous key as it is now; null when there is none or it cannot be read. */
export function readPreviousText(storage: Storage): string | null {
  return read(storage, PREVIOUS_DATA_KEY);
}

/**
 * Removes the previous key while it holds `expected`, the text the user has just downloaded: what an older Invoo
 * saved after that download stays. True when nothing is left under the key.
 */
export function removePreviousData(storage: Storage, expected: string): boolean {
  const text = read(storage, PREVIOUS_DATA_KEY);
  return text === null || (text === expected && remove(storage, PREVIOUS_DATA_KEY));
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

/**
 * The unsaved new invoice; null when there is none or it is not valid. One an Invoo from before version 3 left
 * under the previous draft key is read while this version has stored none.
 */
export function loadDraft(storage: Storage): Invoice | null {
  const raw = read(storage, DRAFT_KEY) ?? read(storage, PREVIOUS_DRAFT_KEY);
  return raw === null ? null : parseDraft(raw);
}

/**
 * Stores the draft, or removes it for null; false when the browser refuses. The draft has its own key: an older
 * Invoo reads a draft without its look and removes its draft key with every invoice it saves. The previous draft
 * goes with either: it lives on in the stored one, or was discarded with it.
 */
export function saveDraft(storage: Storage, draft: Invoice | null): boolean {
  if (draft) {
    if (!write(storage, DRAFT_KEY, JSON.stringify(draft))) return false;
    remove(storage, PREVIOUS_DRAFT_KEY);
    return true;
  }
  const removed = remove(storage, DRAFT_KEY);
  return remove(storage, PREVIOUS_DRAFT_KEY) && removed;
}
