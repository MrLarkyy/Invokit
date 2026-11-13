import type { AppData } from './appData';
import { saveAppData, type LoadedAppData } from './appDataStorage';
import { appReducer, type AppAction } from './appReducer';

/** The data of this page visit, and whether its changes go to the browser storage. */
export interface AppStore {
  data: AppData;
  /**
   * False while unreadable stored data has no safe copy: it has to stay where it is, so nothing is written. Saving
   * resumes once the user has that data in a file, or replaces it by restoring a backup.
   */
  canWrite: boolean;
}

/** `saving/resume`: the user downloaded the unreadable data and agreed to have it replaced. */
export type AppStoreAction = AppAction | { type: 'saving/resume' };

/** What a change did in the browser storage: `off` while saving is switched off, `failed` when the browser refused. */
export type AppStoreWrite = 'saved' | 'unchanged' | 'off' | 'failed';

export function openAppStore(loaded: Pick<LoadedAppData, 'data' | 'readOnly'>): AppStore {
  return { data: loaded.data, canWrite: !loaded.readOnly };
}

export function appStoreReducer(store: AppStore, action: AppStoreAction): AppStore {
  if (action.type === 'saving/resume') return store.canWrite ? store : { ...store, canWrite: true };
  const data = appReducer(store.data, action);
  // A confirmed restore replaces the unreadable data; a reload means another tab already replaced it.
  const canWrite = store.canWrite || action.type === 'backup/restore' || action.type === 'data/reload';
  return data === store.data && canWrite === store.canWrite ? store : { data, canWrite };
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
