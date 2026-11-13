import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import type { AppData } from '../storage/appData';
import { parseAppData } from '../storage/appDataSchema';
import { DATA_KEY, loadAppData, saveAppData } from '../storage/appDataStorage';
import { appReducer, type AppAction } from '../storage/appReducer';
import { useToast } from './components/Toast';

interface Store {
  data: AppData;
  dispatch: Dispatch<AppAction>;
  /** The stored data could not be read at start; a copy was kept and the app started empty. */
  recovered: boolean;
}

const StoreContext = createContext<Store | null>(null);

const SAVE_FAILED = 'Data se nepodařilo uložit do prohlížeče. Stáhni si zálohu.';

/** Loads the data once, persists it after every change, and follows changes made in another tab. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [initial] = useState(() => loadAppData(window.localStorage));
  const [data, dispatch] = useReducer(appReducer, initial.data);
  // Data that is already in storage (loaded or written by another tab) is not written back.
  const stored = useRef<AppData>(initial.data);

  useEffect(() => {
    if (data === stored.current) return;
    stored.current = data;
    if (!saveAppData(window.localStorage, data)) toast(SAVE_FAILED);
  }, [data, toast]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== DATA_KEY || event.newValue === null) return;
      try {
        const next = parseAppData(event.newValue);
        stored.current = next;
        dispatch({ type: 'data/reload', data: next });
      } catch {
        // Unreadable data from another tab is ignored; this tab keeps what it has.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <StoreContext.Provider value={{ data, dispatch, recovered: initial.recovered }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore needs a StoreProvider.');
  return store;
}
