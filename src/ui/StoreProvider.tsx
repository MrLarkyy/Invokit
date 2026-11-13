import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Invoice } from '../domain/invoice';
import type { AppData } from '../storage/appData';
import {
  DATA_KEY,
  hasLegacyData,
  loadAppData,
  removeLegacyData,
  saveAppData,
  type LoadedAppData,
} from '../storage/appDataStorage';
import {
  appStoreReducer,
  followOtherTab,
  openAppStore,
  settleAppStore,
  writeAppStore,
  type AppStore,
  type AppStoreAction,
} from '../storage/appStore';
import { DraftSession } from '../storage/draftSession';
import { browserStorage } from './browserStorage';
import { useToast } from './components/Toast';

interface Store {
  data: AppData;
  /**
   * Applies the action and stores the result right away. True when the data is then stored in the browser; false
   * while saving is off, when the write was refused (a warning is shown) and when the browser blocks storage, so
   * the caller never reports an unsaved change as saved.
   */
  dispatch: (action: AppStoreAction) => boolean;
  /** The unsaved new invoice; null when there is none. */
  loadDraft: () => Invoice | null;
  /** Keeps the unsaved new invoice (null clears it): in the browser, or for this visit only while it cannot be written. */
  saveDraft: (draft: Invoice | null) => void;
  /** False when the browser blocks localStorage (nothing survives the visit). */
  persistent: boolean;
  /** False while unreadable data has no safe copy: nothing is written until the user resumes saving. */
  canWrite: boolean;
  /** A restore or another tab's data replaced the data this visit started with. */
  dataReplaced: boolean;
  /** The browser refused the last write. */
  lastWriteFailed: boolean;
  /** Another tab runs an older Invoo: its data was taken over, or it overwrote current data (then written back). */
  olderTab: AppStore['olderTab'];
  /** How loading went (unreadable data, Invokit data that does not fit). */
  loaded: LoadedAppData;
  /** The Invokit data is the only copy because the new data does not fit into the browser storage. */
  legacyBlocking: boolean;
  /** Removes the Invokit keys and writes the current data; the caller has the backup and the user's consent. */
  removeLegacy: () => boolean;
}

const StoreContext = createContext<Store | null>(null);

const SAVE_FAILED = 'Data se nepodařilo uložit do prohlížeče. Stáhni si zálohu.';

/** Loads the data once, stores it after every change, and follows changes made in another tab. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [{ storage, persistent }] = useState(browserStorage);
  const [loaded] = useState(() => loadAppData(storage));
  const [legacyBlocking, setLegacyBlocking] = useState(loaded.legacyBlocking);
  const [store, setStore] = useState(() => openAppStore(loaded));
  const current = useRef(store);
  const [drafts] = useState(() => new DraftSession(storage));
  const { canWrite, dataReplaced, lastWriteFailed, olderTab } = store;
  const loadDraft = useCallback(() => drafts.load(), [drafts]);
  // A new function once saving resumes, so the open editor writes its draft again.
  const saveDraft = useCallback((draft: Invoice | null) => drafts.save(draft, canWrite), [drafts, canWrite]);

  const dispatch = useCallback(
    (action: AppStoreAction): boolean => {
      const before = current.current;
      const next = appStoreReducer(before, action);
      const written = writeAppStore(storage, before, next);
      if (written === 'unchanged') return persistent && before.canWrite;
      const settled = settleAppStore(next, written);
      current.current = settled;
      setStore(settled);
      if (written === 'failed') {
        toast(SAVE_FAILED);
        if (hasLegacyData(storage)) setLegacyBlocking(true);
      }
      return persistent && written === 'saved';
    },
    [persistent, storage, toast],
  );

  // Another tab wrote the data: it is taken over, or undone when an older Invoo overwrote current data (see
  // followOtherTab).
  useEffect(() => {
    if (!persistent) return;
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== storage || event.key !== DATA_KEY || event.newValue === null) return;
      const next = followOtherTab(storage, current.current, event.newValue, event.oldValue);
      if (next === current.current) return;
      current.current = next;
      setStore(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [persistent, storage]);

  const removeLegacy = useCallback(() => {
    if (!removeLegacyData(storage) || !saveAppData(storage, current.current.data)) return false;
    const settled = settleAppStore(current.current, 'saved');
    current.current = settled;
    setStore(settled);
    setLegacyBlocking(false);
    return true;
  }, [storage]);

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
