import type { AppData } from './appData';
import { readStoredChange, saveAppData, type LoadedAppData } from './appDataStorage';
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
  /** The last attempt to store a change was refused by the browser. */
  lastWriteFailed: boolean;
  /** Another tab still runs an Invoo from before schema version 3 and wrote its older data over this one's. */
  olderTab: boolean;
}

/** `saving/resume`: the user downloaded the unreadable data and agreed to have it replaced. */
export type AppStoreAction = AppAction | { type: 'saving/resume' };

/** What a change did in the browser storage: `off` while saving is switched off, `failed` when the browser refused. */
export type AppStoreWrite = 'saved' | 'unchanged' | 'off' | 'failed';

export function openAppStore(loaded: Pick<LoadedAppData, 'data' | 'readOnly'>): AppStore {
  return {
    data: loaded.data,
    canWrite: !loaded.readOnly,
    dataReplaced: false,
    lastWriteFailed: false,
    olderTab: false,
  };
}

export function appStoreReducer(store: AppStore, action: AppStoreAction): AppStore {
  if (action.type === 'saving/resume') return store.canWrite ? store : { ...store, canWrite: true };
  const data = appReducer(store.data, action);
  // A confirmed restore replaces the unreadable data; a reload means another tab already replaced it.
  const canWrite = store.canWrite || action.type === 'backup/restore' || action.type === 'data/reload';
  const dataReplaced = store.dataReplaced || action.type === 'backup/restore' || action.type === 'data/reload';
  return data === store.data && canWrite === store.canWrite && dataReplaced === store.dataReplaced
    ? store
    : { ...store, data, canWrite, dataReplaced };
}

/** Notes the outcome of a write in the store; other outcomes leave it as it is. */
export function settleAppStore(store: AppStore, written: AppStoreWrite): AppStore {
  if (written !== 'saved' && written !== 'failed') return store;
  const lastWriteFailed = written === 'failed';
  return lastWriteFailed === store.lastWriteFailed ? store : { ...store, lastWriteFailed };
}

/**
 * Follows a write of another tab to the data key. Current data is taken over without writing it back. Data an older
 * Invoo wrote is never taken over: it lacks the looks and logos and would drop invoices saved here since, so this
 * tab writes its own data back and notes the older tab, for a warning. Anything unreadable is ignored.
 */
export function followOtherTab(storage: Storage, store: AppStore, text: string): AppStore {
  const change = readStoredChange(text);
  if (change.kind === 'current') return appStoreReducer(store, { type: 'data/reload', data: change.data });
  if (change.kind === 'unreadable') return store;
  const noted = store.olderTab ? store : { ...store, olderTab: true };
  if (!noted.canWrite) return noted;
  return settleAppStore(noted, saveAppData(storage, noted.data) ? 'saved' : 'failed');
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
