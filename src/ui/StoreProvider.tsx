import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../storage/appData';
import { parseAppData } from '../storage/appDataSchema';
import {
  DATA_KEY,
  hasLegacyData,
  loadAppData,
  removeLegacyData,
  saveAppData,
  type LoadedAppData,
} from '../storage/appDataStorage';
import { appStoreReducer, openAppStore, writeAppStore, type AppStoreAction } from '../storage/appStore';
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
  /** The browser storage, or the in-memory stand-in. */
  storage: Storage;
  /** False when the browser blocks localStorage (nothing survives the visit). */
  persistent: boolean;
  /** False while unreadable data has no safe copy: nothing is written until the user resumes saving. */
  canWrite: boolean;
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

  const dispatch = useCallback(
    (action: AppStoreAction): boolean => {
      const before = current.current;
      const next = appStoreReducer(before, action);
      const written = writeAppStore(storage, before, next);
      if (written === 'unchanged') return persistent && before.canWrite;
      current.current = next;
      setStore(next);
      if (written === 'failed') {
        toast(SAVE_FAILED);
        if (hasLegacyData(storage)) setLegacyBlocking(true);
      }
      return persistent && written === 'saved';
    },
    [persistent, storage, toast],
  );

  // Another tab wrote new data: take it over without writing it back.
  useEffect(() => {
    if (!persistent) return;
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== storage || event.key !== DATA_KEY || event.newValue === null) return;
      try {
        const next = appStoreReducer(current.current, { type: 'data/reload', data: parseAppData(event.newValue) });
        current.current = next;
        setStore(next);
      } catch {
        // Unreadable data from another tab is ignored; this tab keeps what it has.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [persistent, storage]);

  const removeLegacy = useCallback(() => {
    if (!removeLegacyData(storage) || !saveAppData(storage, current.current.data)) return false;
    setLegacyBlocking(false);
    return true;
  }, [storage]);

  return (
    <StoreContext.Provider
      value={{
        data: store.data,
        dispatch,
        storage,
        persistent,
        canWrite: store.canWrite,
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
