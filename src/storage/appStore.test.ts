import { describe, expect, it } from 'vitest';
import { fixtureInvoice, fixtureProfile } from '../test/invoiceFixture';
import { emptyAppData } from './appData';
import { BROKEN_DATA_KEY, DATA_KEY, loadAppData } from './appDataStorage';
import {
  appStoreReducer,
  openAppStore,
  settleAppStore,
  writeAppStore,
  type AppStore,
  type AppStoreAction,
} from './appStore';
import { MemoryStorage } from './memoryStorage';

const CORRUPT = '{"version":2,"invoices":"broken"';
const OLDER_COPY = 'first corruption';

/** Unreadable data next to a different older copy: nothing may be written. */
function blockedByOlderCopy(): MemoryStorage {
  const storage = new MemoryStorage();
  storage.setItem(BROKEN_DATA_KEY, OLDER_COPY);
  storage.setItem(DATA_KEY, CORRUPT);
  return storage;
}

function apply(storage: Storage, store: AppStore, action: AppStoreAction) {
  const next = appStoreReducer(store, action);
  return { store: next, written: writeAppStore(storage, store, next) };
}

const saveInvoice: AppStoreAction = { type: 'invoice/save', invoice: fixtureInvoice(), now: '2026-09-02T10:00:00Z' };

describe('app store', () => {
  it('saves every change when the stored data was readable', () => {
    const storage = new MemoryStorage();
    const opened = openAppStore(loadAppData(storage));
    expect(opened.canWrite).toBe(true);
    const { store, written } = apply(storage, opened, saveInvoice);
    expect(written).toBe('saved');
    expect(loadAppData(storage).data).toEqual(store.data);
  });

  it('writes nothing while unreadable data has no safe copy', () => {
    const storage = blockedByOlderCopy();
    const opened = openAppStore(loadAppData(storage));
    expect(opened.canWrite).toBe(false);
    const { store, written } = apply(storage, opened, saveInvoice);
    expect(written).toBe('off');
    expect(store.canWrite).toBe(false);
    expect(store.data.invoices).toHaveLength(1);
    expect(storage.getItem(DATA_KEY)).toBe(CORRUPT);
    expect(storage.getItem(BROKEN_DATA_KEY)).toBe(OLDER_COPY);
  });

  it('resumes saving on request and stores what was done meanwhile; the older copy stays', () => {
    const storage = blockedByOlderCopy();
    const unsaved = apply(storage, openAppStore(loadAppData(storage)), saveInvoice).store;
    const resumed = apply(storage, unsaved, { type: 'saving/resume' });
    expect(resumed.written).toBe('saved');
    expect(resumed.store).toEqual({ ...unsaved, canWrite: true });
    expect(storage.getItem(BROKEN_DATA_KEY)).toBe(OLDER_COPY);

    const later = apply(storage, resumed.store, { type: 'supplier/save', supplier: fixtureProfile() });
    expect(later.written).toBe('saved');
    const reloaded = loadAppData(storage);
    expect(reloaded).toMatchObject({ recovered: false, readOnly: false });
    expect(reloaded.data).toEqual(later.store.data);
  });

  it('resumes saving with a confirmed restore: the restored data replaces the unreadable text', () => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, CORRUPT);
    storage.failingKeys.add(BROKEN_DATA_KEY);
    const opened = openAppStore(loadAppData(storage));
    expect(opened.canWrite).toBe(false);
    const backup = { ...emptyAppData(), supplier: fixtureProfile(), invoices: [fixtureInvoice()] };
    const { store, written } = apply(storage, opened, { type: 'backup/restore', data: backup });
    expect(written).toBe('saved');
    expect(store.canWrite).toBe(true);
    expect(storage.getItem(BROKEN_DATA_KEY)).toBeNull();
    const reloaded = loadAppData(storage);
    expect(reloaded).toMatchObject({ recovered: false, readOnly: false });
    expect(reloaded.data).toEqual(backup);
  });

  it('resumes saving when another tab replaced the unreadable data', () => {
    const blocked: AppStore = { data: emptyAppData(), canWrite: false, dataReplaced: false, lastWriteFailed: false };
    const fromOtherTab = { ...emptyAppData(), supplier: fixtureProfile() };
    expect(appStoreReducer(blocked, { type: 'data/reload', data: fromOtherTab })).toEqual({
      data: fromOtherTab,
      canWrite: true,
      dataReplaced: true,
      lastWriteFailed: false,
    });
  });

  it('notes a replaced data set only for a restore or a reload', () => {
    const opened = openAppStore(loadAppData(new MemoryStorage()));
    expect(opened).toMatchObject({ dataReplaced: false, lastWriteFailed: false });
    expect(appStoreReducer(opened, saveInvoice).dataReplaced).toBe(false);
    const restored = appStoreReducer(opened, { type: 'backup/restore', data: emptyAppData() });
    expect(restored.dataReplaced).toBe(true);
    expect(appStoreReducer(restored, saveInvoice).dataReplaced).toBe(true);
  });

  it('follows the outcome of the last write', () => {
    const opened = openAppStore(loadAppData(new MemoryStorage()));
    const failed = settleAppStore(opened, 'failed');
    expect(failed.lastWriteFailed).toBe(true);
    expect(settleAppStore(failed, 'off')).toBe(failed);
    expect(settleAppStore(failed, 'unchanged')).toBe(failed);
    expect(settleAppStore(failed, 'saved').lastWriteFailed).toBe(false);
    expect(settleAppStore(opened, 'saved')).toBe(opened);
    // removeLegacy settles a successful save this way, so the settings stop saying nothing is stored.
    expect(settleAppStore(settleAppStore(opened, 'failed'), 'saved')).toEqual(opened);
  });

  it('keeps saving off for every other action', () => {
    let store: AppStore = { data: emptyAppData(), canWrite: false, dataReplaced: false, lastWriteFailed: false };
    const others: AppStoreAction[] = [
      saveInvoice,
      { type: 'invoice/setPaid', id: '2026-09-001', paidAt: '2026-09-10' },
      { type: 'supplier/save', supplier: fixtureProfile() },
      { type: 'backup/exported', at: '2026-09-30' },
      { type: 'customer/delete', customer: fixtureInvoice().customer },
      { type: 'catalog/delete', description: 'Vývoj' },
      { type: 'invoice/delete', id: '2026-09-001' },
    ];
    for (const action of others) {
      store = appStoreReducer(store, action);
      expect(store.canWrite).toBe(false);
    }
  });

  it('reports a refused write and stays on, so the next change is tried again', () => {
    const storage = blockedByOlderCopy();
    storage.failingKeys.add(DATA_KEY);
    const resumed = apply(storage, openAppStore(loadAppData(storage)), { type: 'saving/resume' });
    expect(resumed.written).toBe('failed');
    expect(resumed.store.canWrite).toBe(true);
    expect(storage.getItem(DATA_KEY)).toBe(CORRUPT);
    storage.failingKeys.delete(DATA_KEY);
    expect(apply(storage, resumed.store, saveInvoice).written).toBe('saved');
  });

  it('writes nothing for an action that changes nothing', () => {
    const storage = new MemoryStorage();
    const { store } = apply(storage, openAppStore(loadAppData(storage)), saveInvoice);
    storage.failWrites = true;
    expect(apply(storage, store, { type: 'saving/resume' })).toEqual({ store, written: 'unchanged' });
    const sameNumber: AppStoreAction = { ...saveInvoice, invoice: fixtureInvoice({ id: 'other' }) };
    expect(apply(storage, store, sameNumber)).toEqual({ store, written: 'unchanged' });
  });
});
