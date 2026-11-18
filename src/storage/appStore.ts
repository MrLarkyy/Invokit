import type { AppData } from './appData';
import { readDataText, readPreviousText, readStoredChange, writeDataText, type LoadedAppData } from './appDataStorage';
import { applyAppAction, type AppAction } from './appReducer';

/** The data of this page visit, and whether its changes go to the browser storage. */
export interface AppStore {
  data: AppData;
  /**
   * False while unreadable stored data has no safe copy: it has to stay where it is, so nothing is written. Saving
   * resumes once the user has that data in a file, or replaces it by restoring a backup. Also false, until the
   * page is reloaded, once the storage holds data of a newer Invoo.
   */
  canWrite: boolean;
  /** A restored backup or another tab's data replaced what this visit started with. */
  dataReplaced: boolean;
  /** The browser refused the last attempt to store this tab's data, and no other tab's data replaced it since. */
  lastWriteFailed: boolean;
  /** The text under the data key as this tab last read or wrote it (null: none): anything else is another tab's. */
  storedText: string | null;
  /** The text under the previous key this tab's data was read from; null once the data key is its source. */
  previousText: string | null;
  /**
   * An Invoo from before schema version 3 saved in another tab: `followed` while nothing is under the data key yet,
   * so its data was taken over; `aside` once there is, so its data stays under the previous key, to be downloaded.
   */
  olderTab: 'followed' | 'aside' | null;
  /** The data key holds data of a newer Invoo than this one: this tab no longer writes. */
  newer: boolean;
}

/** `saving/resume`: the user downloaded the unreadable data and agreed to have it replaced. */
export type AppStoreAction = AppAction | { type: 'saving/resume' };

/** What a change did in the browser storage: `off` while saving is switched off, `failed` when the browser refused. */
export type AppStoreWrite = 'saved' | 'unchanged' | 'off' | 'failed';

export interface AppStoreChange {
  store: AppStore;
  written: AppStoreWrite;
  /** The Czech reason the action was not applied to the data; null when it was. */
  problem: string | null;
}

/**
 * What became of a change, for the page that asked for it: `stored` in the browser; `kept` for this visit only
 * (saving off, write refused, storage blocked); `rejected`, so not applied at all.
 */
export type AppStoreOutcome = { result: 'stored' | 'kept' } | { result: 'rejected'; reason: string };

export function openAppStore(loaded: LoadedAppData): AppStore {
  return {
    data: loaded.data,
    canWrite: !loaded.readOnly,
    dataReplaced: false,
    lastWriteFailed: false,
    storedText: loaded.storedText,
    previousText: loaded.previousText,
    olderTab: loaded.olderAside ? 'aside' : null,
    newer: loaded.newer,
  };
}

function reduce(store: AppStore, action: AppStoreAction): { store: AppStore; problem: string | null } {
  if (action.type === 'saving/resume') {
    return { store: store.canWrite || store.newer ? store : { ...store, canWrite: true }, problem: null };
  }
  const { data, problem } = applyAppAction(store.data, action);
  const replaces = action.type === 'backup/restore' || action.type === 'data/reload';
  // A confirmed restore replaces the unreadable data; a reload means another tab already replaced it.
  const canWrite = !store.newer && (store.canWrite || replaces);
  const dataReplaced = store.dataReplaced || replaces;
  // Reloaded data is what the storage holds: a write refused earlier leaves nothing unsaved behind.
  const lastWriteFailed = store.lastWriteFailed && action.type !== 'data/reload';
  const same =
    data === store.data &&
    canWrite === store.canWrite &&
    dataReplaced === store.dataReplaced &&
    lastWriteFailed === store.lastWriteFailed;
  return { store: same ? store : { ...store, data, canWrite, dataReplaced, lastWriteFailed }, problem };
}

export function appStoreReducer(store: AppStore, action: AppStoreAction): AppStore {
  return reduce(store, action).store;
}

function takeOver(store: AppStore, data: AppData): AppStore {
  return appStoreReducer(store, { type: 'data/reload', data });
}

/** Takes over what another tab stored under the data key; a newer schema there ends this tab's writing. */
function followDataKey(store: AppStore, text: string): AppStore {
  const change = readStoredChange(text);
  if (change.kind === 'newer') return { ...store, canWrite: false, newer: true, storedText: text };
  if (change.kind === 'unreadable') return store;
  return { ...takeOver(store, change.data), storedText: text, previousText: null };
}

function withOlderTab(store: AppStore, olderTab: AppStore['olderTab']): AppStore {
  return store.olderTab === olderTab ? store : { ...store, olderTab };
}

/**
 * Brings the store up to date with the browser storage, and never writes there. It reads the keys as they are now
 * instead of trusting an event's payload, so it is right after a storage event (also a late one), after loading
 * (a write made before the page listened raised no event), for a page restored from the back/forward cache (it was
 * sent none) and before every write (nothing another tab stored is overwritten unseen).
 *
 * Data another tab stored under the data key is taken over; unreadable text there is ignored. What an older Invoo
 * saves under the previous key is taken over only while the data key is empty and this tab has seen nothing there:
 * that tab read all there was. Next to data under the data key it is only noted, and stays where it is.
 */
export function syncAppStore(storage: Storage, store: AppStore): AppStore {
  const text = readDataText(storage);
  const previous = readPreviousText(storage);
  if (text !== null) {
    const followed = text === store.storedText ? store : followDataKey(store, text);
    if (previous !== null) return withOlderTab(followed, 'aside');
    return followed.olderTab === 'aside' ? withOlderTab(followed, null) : followed;
  }
  if (store.storedText !== null || previous === null || previous === store.previousText) return store;
  const change = readStoredChange(previous);
  if (change.kind !== 'data') return store;
  return { ...takeOver(store, change.data), previousText: previous, olderTab: 'followed' };
}

function write(storage: Storage, store: AppStore): AppStoreChange {
  if (!store.canWrite) return { store, written: 'off', problem: null };
  const text = JSON.stringify(store.data);
  if (writeDataText(storage, text, store.previousText)) {
    const stored = { ...store, lastWriteFailed: false, storedText: text, previousText: null };
    return { store: stored, written: 'saved', problem: null };
  }
  return {
    store: store.lastWriteFailed ? store : { ...store, lastWriteFailed: true },
    written: 'failed',
    problem: null,
  };
}

/**
 * Applies a change and stores its result. The store is first brought up to date (see syncAppStore), so the change
 * lands on what the storage holds now, not on what this tab last saw. `unchanged` then means the action changed
 * nothing in that data, and `problem` says why it could not. Resuming writes the data as it is now, so what was
 * done while saving was off is kept too; the unreadable text is replaced, a copy kept aside earlier stays.
 */
export function changeAppStore(storage: Storage, store: AppStore, action: AppStoreAction): AppStoreChange {
  const current = syncAppStore(storage, store);
  const { store: next, problem } = reduce(current, action);
  return next === current ? { store: current, written: 'unchanged', problem } : write(storage, next);
}

/** `persistent`: false when the browser blocks its storage, so nothing outlives the visit. */
export function outcomeOf(change: AppStoreChange, persistent: boolean): AppStoreOutcome {
  if (change.problem !== null) return { result: 'rejected', reason: change.problem };
  const { canWrite, lastWriteFailed } = change.store;
  const inStorage = change.written === 'saved' || (change.written === 'unchanged' && canWrite && !lastWriteFailed);
  return { result: persistent && inStorage ? 'stored' : 'kept' };
}

/** Stores the data as it is now, brought up to date first: the write that follows removing the Invokit keys. */
export function rewriteAppStore(storage: Storage, store: AppStore): AppStoreChange {
  return write(storage, syncAppStore(storage, store));
}
