import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Invoice } from '../domain/invoice';
import type { AppData } from '../storage/appData';
import {
  DATA_KEY,
  hasLegacyData,
  loadAppData,
  PREVIOUS_DATA_KEY,
  readPreviousText,
  removeLegacyData,
  removePreviousData,
  type LoadedAppData,
} from '../storage/appDataStorage';
import {
  changeAppStore,
  openAppStore,
  rewriteAppStore,
  syncAppStore,
  type AppStore,
  type AppStoreAction,
} from '../storage/appStore';
import { downloadText } from '../storage/backupFile';
import { DraftSession } from '../storage/draftSession';
import { browserStorage } from './browserStorage';
import { todayIso } from './clock';
import { useToast } from './components/Toast';
import { olderTabFileName } from './olderTabNotice';

interface Store {
  data: AppData;
  /**
   * Applies the action and stores the result right away. True when the data is then stored in the browser; false
   * while saving is off, when the write was refused (a warning is shown), when the browser blocks storage and when
   * the action changed nothing in data another tab stored meanwhile (a warning is shown), so the caller never
   * reports an unsaved change as saved.
   */
  dispatch: (action: AppStoreAction) => boolean;
  /** The unsaved new invoice; null when there is none. */
  loadDraft: () => Invoice | null;
  /** Keeps the unsaved new invoice (null clears it): in the browser, or for this visit only while it cannot be written. */
  saveDraft: (draft: Invoice | null) => void;
  /** False when the browser blocks localStorage (nothing survives the visit). */
  persistent: boolean;
  /** False while unreadable data has no safe copy (until the user resumes saving) and once the data is newer. */
  canWrite: boolean;
  /** A restore or another tab's data replaced the data this visit started with. */
  dataReplaced: boolean;
  /** The browser refused the last write. */
  lastWriteFailed: boolean;
  /** An older Invoo saved in another tab: its data was taken over, or lies aside under the previous key. */
  olderTab: AppStore['olderTab'];
  /** The browser storage holds data of a newer Invoo: this tab writes nothing until it is reloaded. */
  newer: boolean;
  /** Offers the text an older Invoo saved aside as a file; returns that text, null when there is none any more. */
  downloadOlder: () => string | null;
  /** Removes that text while it is still the downloaded one; false when the older Invoo has saved again since. */
  dropOlder: (downloaded: string) => boolean;
  /** How loading went (unreadable data, Invokit data that does not fit). */
  loaded: LoadedAppData;
  /** The Invokit data is the only copy because the new data does not fit into the browser storage. */
  legacyBlocking: boolean;
  /** Removes the Invokit keys and writes the current data; the caller has the backup and the user's consent. */
  removeLegacy: () => boolean;
}

const StoreContext = createContext<Store | null>(null);

const SAVE_FAILED = 'Data se nepodařilo uložit do prohlížeče. Stáhni si zálohu.';
const CHANGED_ELSEWHERE = 'Data se mezitím změnila v jiné záložce a tahle změna se do nich nezapsala. Zkus to znovu.';

/** Loads the data once, stores it after every change, and follows changes made in another tab. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [{ storage, persistent }] = useState(browserStorage);
  const [loaded] = useState(() => loadAppData(storage));
  const [legacyBlocking, setLegacyBlocking] = useState(loaded.legacyBlocking);
  const [store, setStore] = useState(() => openAppStore(loaded));
  const current = useRef(store);
  const [drafts] = useState(() => new DraftSession(storage));
  const { canWrite, dataReplaced, lastWriteFailed, olderTab, newer } = store;
  const loadDraft = useCallback(() => drafts.load(), [drafts]);
  // A new function once saving resumes, so the open editor writes its draft again.
  const saveDraft = useCallback((draft: Invoice | null) => drafts.save(draft, canWrite), [drafts, canWrite]);

  const adopt = useCallback((next: AppStore) => {
    if (next === current.current) return;
    current.current = next;
    setStore(next);
  }, []);

  const dispatch = useCallback(
    (action: AppStoreAction): boolean => {
      const before = current.current;
      const { store: next, written } = changeAppStore(storage, before, action);
      adopt(next);
      if (written === 'unchanged') {
        if (next.data === before.data || action.type === 'saving/resume') return persistent && next.canWrite;
        // The page checked the action against data another tab has replaced since.
        toast(CHANGED_ELSEWHERE);
        return false;
      }
      if (written === 'failed') {
        toast(SAVE_FAILED);
        if (hasLegacyData(storage)) setLegacyBlocking(true);
      }
      return persistent && written === 'saved';
    },
    [adopt, persistent, storage, toast],
  );

  // What other tabs store is followed without writing anything (see syncAppStore). A write made between loading and
  // listening raised no event, and a page restored from the back/forward cache was sent none while it was away.
  useEffect(() => {
    if (!persistent) return;
    const sync = () => adopt(syncAppStore(storage, current.current));
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== storage) return;
      if (event.key === DATA_KEY || event.key === PREVIOUS_DATA_KEY) sync();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow);
    sync();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [adopt, persistent, storage]);

  const removeLegacy = useCallback(() => {
    if (!current.current.canWrite || !removeLegacyData(storage)) return false;
    const { store: next, written } = rewriteAppStore(storage, current.current);
    adopt(next);
    if (written !== 'saved') return false;
    setLegacyBlocking(false);
    return true;
  }, [adopt, storage]);

  const downloadOlder = useCallback(() => {
    const text = readPreviousText(storage);
    if (text === null) adopt(syncAppStore(storage, current.current));
    else downloadText(text, olderTabFileName(todayIso()));
    return text;
  }, [adopt, storage]);

  const dropOlder = useCallback(
    (downloaded: string) => {
      const removed = removePreviousData(storage, downloaded);
      adopt(syncAppStore(storage, current.current));
      return removed;
    },
    [adopt, storage],
  );

  return (
    <StoreContext.Provider
      value={{
        data: store.data,
        dispatch,
        loadDraft,
        saveDraft,
        persistent,
        canWrite,
        dataReplaced,
        lastWriteFailed,
        olderTab,
        newer,
        downloadOlder,
        dropOlder,
        loaded,
        legacyBlocking,
        removeLegacy,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore needs a StoreProvider.');
  return store;
}
