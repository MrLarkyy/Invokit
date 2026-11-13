import { openStorage, type OpenedStorage } from '../storage/openStorage';

let opened: OpenedStorage | null = null;

/** localStorage, or the in-memory stand-in when the browser blocks it; opened once per page. */
export function browserStorage(): OpenedStorage {
  opened ??= openStorage(() => window.localStorage);
  return opened;
}
