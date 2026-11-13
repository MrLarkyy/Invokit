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
import { appReducer, type AppAction } from '../storage/appReducer';
import { browserStorage } from './browserStorage';
import { useToast } from './components/Toast';

interface Store {
  data: AppData;
  /** Applies the action and stores the result right away (unless this session must not write). */
  dispatch: (action: AppAction) => void;
  /** The browser storage, or the in-memory stand-in. */
  storage: Storage;
  /** False when the browser blocks localStorage (nothing survives the visit). */
  persistent: boolean;
  /** False while unreadable data could not be kept aside: nothing is written this session. */
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
  const [data, setData] = useState(loaded.data);
  const current = useRef(loaded.data);
  const canWrite = !loaded.readOnly;

  const dispatch = useCallback(
    (action: AppAction) => {
      const next = appReducer(current.current, action);
      if (next === current.current) return;
      current.current = next;
      setData(next);
      if (!canWrite || saveAppData(storage, next)) return;
      toast(SAVE_FAILED);
      if (hasLegacyData(storage)) setLegacyBlocking(true);
    },
    [canWrite, storage, toast],
  );

  // Another tab wrote new data: take it over without writing it back.
  useEffect(() => {
    if (!persistent) return;
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== storage || event.key !== DATA_KEY || event.newValue === null) return;
      try {
        const next = parseAppData(event.newValue);
        current.current = next;
        setData(next);
      } catch {
        // Unreadable data from another tab is ignored; this tab keeps what it has.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [persistent, storage]);

  const removeLegacy = useCallback(() => {
    if (!removeLegacyData(storage) || !saveAppData(storage, current.current)) return false;
    setLegacyBlocking(false);
    return true;
  }, [storage]);

  return (
    <StoreContext.Provider
      value={{ data, dispatch, storage, persistent, canWrite, loaded, legacyBlocking, removeLegacy }}
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
