import { DATA_KEY } from './appDataStorage';
import { MemoryStorage } from './memoryStorage';

export interface OpenedStorage {
  storage: Storage;
  /** False when the browser blocks localStorage: data lives in memory for this visit only. */
  persistent: boolean;
}

/**
 * The browser's localStorage, or an in-memory stand-in when reading it throws (storage disabled, some private
 * modes, sandboxed frames), so the app still opens instead of a blank page.
 */
export function openStorage(get: () => Storage): OpenedStorage {
  try {
    const storage = get();
    storage.getItem(DATA_KEY);
    return { storage, persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}
