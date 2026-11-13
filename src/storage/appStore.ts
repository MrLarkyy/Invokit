import type { AppData } from './appData';
import { readDataText, readStoredChange, saveAppData, type LoadedAppData } from './appDataStorage';
import { appReducer, type AppAction } from './appReducer';

/** The data of this page visit, and whether its changes go to the browser storage. */
export interface AppStore {
  data: AppData;
  /**
   * False while unreadable stored data has no safe copy: it has to stay where it is, so nothing is written. Saving
   * resumes once the user has that data in a file, or replaces it by restoring a backup.
   */
  canWrite: boolean;
  /** A restored backup or another tab's data replaced what this visit started with. */
  dataReplaced: boolean;
  /** The browser refused the last attempt to store this tab's data, and no other tab's data replaced it since. */
  lastWriteFailed: boolean;
  /**
   * The browser storage held data in the current schema during this visit: loaded so, written here, or taken over
   * from another current tab. An older Invoo cannot read such data, so whatever it writes afterwards lacks it.
   */
  storedCurrent: boolean;
  /**
   * Another tab still runs an Invoo from before schema version 3: `followed` when its data was taken over (the
   * storage had held nothing newer), `overwrote` when it wrote over current data, which this tab then put back.
   */
  olderTab: 'followed' | 'overwrote' | null;
}

/** `saving/resume`: the user downloaded the unreadable data and agreed to have it replaced. */
export type AppStoreAction = AppAction | { type: 'saving/resume' };

/** What a change did in the browser storage: `off` while saving is switched off, `failed` when the browser refused. */
export type AppStoreWrite = 'saved' | 'unchanged' | 'off' | 'failed';

export function openAppStore(loaded: Pick<LoadedAppData, 'data' | 'readOnly' | 'storedCurrent'>): AppStore {
  return {
    data: loaded.data,
    canWrite: !loaded.readOnly,
    dataReplaced: false,
    lastWriteFailed: false,
    storedCurrent: loaded.storedCurrent,
    olderTab: null,
  };
}

export function appStoreReducer(store: AppStore, action: AppStoreAction): AppStore {
  if (action.type === 'saving/resume') return store.canWrite ? store : { ...store, canWrite: true };
  const data = appReducer(store.data, action);
  // A confirmed restore replaces the unreadable data; a reload means another tab already replaced it.
  const canWrite = store.canWrite || action.type === 'backup/restore' || action.type === 'data/reload';
  const dataReplaced = store.dataReplaced || action.type === 'backup/restore' || action.type === 'data/reload';
  // Reloaded data is what the storage holds: a write refused earlier leaves nothing unsaved behind.
  const lastWriteFailed = store.lastWriteFailed && action.type !== 'data/reload';
  return data === store.data &&
    canWrite === store.canWrite &&
    dataReplaced === store.dataReplaced &&
    lastWriteFailed === store.lastWriteFailed
    ? store
    : { ...store, data, canWrite, dataReplaced, lastWriteFailed };
}

/**
 * Notes the outcome of a write in the store; other outcomes leave it as it is. What is written is in the current
 * schema, so a stored write also means the storage holds current data.
 */
export function settleAppStore(store: AppStore, written: AppStoreWrite): AppStore {
  if (written !== 'saved' && written !== 'failed') return store;
  const lastWriteFailed = written === 'failed';
  const storedCurrent = store.storedCurrent || written === 'saved';
  return lastWriteFailed === store.lastWriteFailed && storedCurrent === store.storedCurrent
    ? store
    : { ...store, lastWriteFailed, storedCurrent };
}

function takeOver(store: AppStore, data: AppData): AppStore {
  return appStoreReducer(store, { type: 'data/reload', data });
}

/**
 * Follows a write of another tab to the data key: `text` is what it wrote, `replaced` what the key held before.
 * Anything unreadable is ignored. Current data is taken over without writing it back.
 *
 * Data an older Invoo wrote is taken over the same way while the storage has held nothing newer: that tab read all
 * there was, so writing over it would drop what the user saved there. Once current data was stored, the older tab
 * cannot have read it (looks, logos, invoices saved since) and its write is undone: the current data is written
 * back and the older tab noted, for a warning. That the storage held current data is known from this visit, not
 * only from `replaced`: after a refused write-back, or with two older writes in a row, `replaced` is the older
 * tab's own text.
 */
export function followOtherTab(storage: Storage, store: AppStore, text: string, replaced: string | null): AppStore {
  const change = readStoredChange(text);
  if (change.kind === 'unreadable') return store;
  if (change.kind === 'current') return { ...takeOver(store, change.data), storedCurrent: true };
  // What was overwritten matters only while this tab knows of no stored current data: then it may be data this tab
  // never saw (written and overwritten before it listened), which is the newest there is.
  const before = store.storedCurrent || replaced === null ? null : readStoredChange(replaced);
  const unseen = before?.kind === 'current' ? before.data : null;
  if (!store.storedCurrent && unseen === null) {
    return change.data === null ? store : { ...takeOver(store, change.data), olderTab: 'followed' };
  }
  const kept = unseen === null ? store : takeOver(store, unseen);
  const noted: AppStore = { ...kept, storedCurrent: true, olderTab: 'overwrote' };
  if (!noted.canWrite) return noted;
  return settleAppStore(noted, saveAppData(storage, noted.data) ? 'saved' : 'failed');
}

/**
 * Catches up with the data key once the page listens to it: what another tab wrote after `loadedText` was read
 * raised no event here. The key's text is followed like such an event, unless it is still that text or this tab's
 * own data (a change made before listening).
 */
export function catchUpOtherTab(storage: Storage, store: AppStore, loadedText: string | null): AppStore {
  const text = readDataText(storage);
  if (text === null || text === loadedText || text === JSON.stringify(store.data)) return store;
  return followOtherTab(storage, store, text, loadedText);
}

/**
 * Stores the result of a change. Resuming writes the data as it is now, so what was done while saving was off is
 * kept too; the unreadable text under the data key is replaced, a copy kept aside earlier stays.
 */
export function writeAppStore(storage: Storage, before: AppStore, after: AppStore): AppStoreWrite {
  if (after === before) return 'unchanged';
  if (!after.canWrite) return 'off';
  return saveAppData(storage, after.data) ? 'saved' : 'failed';
}
