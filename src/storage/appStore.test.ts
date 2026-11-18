import { describe, expect, it } from 'vitest';
import { createBlankInvoice } from '../domain/newInvoice';
import { TOO_MANY_LOGOS } from '../domain/logos';
import { fullLogoData, printedLogos } from '../test/fullLogoData';
import { FIXTURE_LOGO, fixtureInvoice, fixtureItem, fixtureLogo, fixtureProfile } from '../test/invoiceFixture';
import { olderAppData } from '../test/olderAppData';
import { QuotaStorage } from '../test/quotaStorage';
import { emptyAppData, type AppData } from './appData';
import { INVOICE_GONE } from './appReducer';
import {
  BROKEN_DATA_KEY,
  DATA_KEY,
  LEGACY_DATA_KEY,
  loadAppData,
  PREVIOUS_BROKEN_KEY,
  PREVIOUS_DATA_KEY,
  removePreviousData,
} from './appDataStorage';
import {
  appStoreReducer,
  changeAppStore,
  openAppStore,
  outcomeOf,
  rewriteAppStore,
  syncAppStore,
  type AppStore,
  type AppStoreAction,
  type AppStoreChange,
} from './appStore';
import { MemoryStorage } from './memoryStorage';

const CORRUPT = '{"version":2,"invoices":"broken"';
const OLDER_COPY = 'first corruption';

const saveInvoice: AppStoreAction = {
  type: 'invoice/save',
  invoice: fixtureInvoice(),
  now: '2026-09-02T10:00:00Z',
  create: true,
};
const saveProfile: AppStoreAction = { type: 'supplier/save', supplier: fixtureProfile(), logo: null };
const saveLogo: AppStoreAction = { type: 'supplier/save', supplier: fixtureProfile(), logo: FIXTURE_LOGO };

const other = (n: number) => fixtureInvoice({ id: `other-${n}`, number: `2026-10-00${n}` });
const withInvoices = (...invoices: AppData['invoices']): AppData => ({ ...emptyAppData(), invoices });
const text = (data: AppData) => JSON.stringify(data);

/** What an Invoo from before version 3 holds and stores: one invoice, then a second one. */
const OLD = withInvoices(other(1));
const OLD_SINCE = withInvoices(other(1), other(2));
const V2 = olderAppData(OLD);
const V2_SINCE = olderAppData(OLD_SINCE);
const NEWER = JSON.stringify({ ...OLD, version: 4, somethingNew: [1] });

/** Every key the storage holds, to prove that nothing was written or removed. */
function snapshot(storage: Storage): Record<string, string | null> {
  const all: Record<string, string | null> = {};
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null) all[key] = storage.getItem(key);
  }
  return all;
}

/** A storage that notes every key written, however the write ends. */
class WatchedStorage extends MemoryStorage {
  readonly written: string[] = [];

  override setItem(key: string, value: string): void {
    this.written.push(key);
    super.setItem(key, value);
  }
}

function holding(entries: Record<string, string>, storage: MemoryStorage = new MemoryStorage()): MemoryStorage {
  for (const [key, value] of Object.entries(entries)) storage.setItem(key, value);
  return storage;
}

const open = (storage: Storage) => openAppStore(loadAppData(storage));

/** Unreadable data next to a different older copy: nothing may be written. */
const blockedByOlderCopy = () => holding({ [BROKEN_DATA_KEY]: OLDER_COPY, [DATA_KEY]: CORRUPT });

/** Follows what another tab did and proves that following wrote and removed nothing, though it could have. */
function synced(storage: MemoryStorage, store: AppStore): AppStore {
  const before = snapshot(storage);
  const next = syncAppStore(storage, store);
  expect(snapshot(storage)).toEqual(before);
  // Refused writes would leave the storage unchanged too: none may even be tried.
  const watched = holding(before as Record<string, string>, new WatchedStorage()) as WatchedStorage;
  watched.written.length = 0;
  expect(syncAppStore(watched, store)).toEqual(next);
  expect(watched.written).toEqual([]);
  return next;
}

describe('app store', () => {
  it('saves every change when the stored data was readable, and knows the text it stored', () => {
    const storage = new MemoryStorage();
    const opened = open(storage);
    expect(opened).toMatchObject({ canWrite: true, storedText: text(emptyAppData()), previousText: null });
    const { store, written } = changeAppStore(storage, opened, saveInvoice);
    expect(written).toBe('saved');
    expect(loadAppData(storage).data).toEqual(store.data);
    expect(store.storedText).toBe(storage.getItem(DATA_KEY));
    expect(store.storedText).toBe(text(store.data));
  });

  it('writes nothing while unreadable data has no safe copy', () => {
    const storage = blockedByOlderCopy();
    const opened = open(storage);
    expect(opened.canWrite).toBe(false);
    const { store, written } = changeAppStore(storage, opened, saveInvoice);
    expect(written).toBe('off');
    expect(store.canWrite).toBe(false);
    expect(store.data.invoices).toHaveLength(1);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: CORRUPT, [BROKEN_DATA_KEY]: OLDER_COPY });
  });

  it('resumes saving on request and stores what was done meanwhile; the older copy stays', () => {
    const storage = blockedByOlderCopy();
    const unsaved = changeAppStore(storage, open(storage), saveInvoice).store;
    const resumed = changeAppStore(storage, unsaved, { type: 'saving/resume' });
    expect(resumed.written).toBe('saved');
    expect(resumed.store).toEqual({ ...unsaved, canWrite: true, storedText: text(unsaved.data) });
    expect(storage.getItem(BROKEN_DATA_KEY)).toBe(OLDER_COPY);

    const later = changeAppStore(storage, resumed.store, saveProfile);
    expect(later.written).toBe('saved');
    const reloaded = loadAppData(storage);
    expect(reloaded).toMatchObject({ recovered: false, readOnly: false });
    expect(reloaded.data).toEqual(later.store.data);
  });

  it('resumes saving with a confirmed restore: the restored data replaces the unreadable text', () => {
    const storage = holding({ [DATA_KEY]: CORRUPT });
    storage.failingKeys.add(BROKEN_DATA_KEY);
    const opened = open(storage);
    expect(opened.canWrite).toBe(false);
    const backup = { ...emptyAppData(), supplier: fixtureProfile(), invoices: [fixtureInvoice()] };
    const { store, written } = changeAppStore(storage, opened, { type: 'backup/restore', data: backup });
    expect(written).toBe('saved');
    expect(store.canWrite).toBe(true);
    expect(storage.getItem(BROKEN_DATA_KEY)).toBeNull();
    const reloaded = loadAppData(storage);
    expect(reloaded).toMatchObject({ recovered: false, readOnly: false });
    expect(reloaded.data).toEqual(backup);
  });

  it('resumes saving when another tab replaced the unreadable data', () => {
    const storage = blockedByOlderCopy();
    const blocked = open(storage);
    const fromOtherTab = { ...emptyAppData(), supplier: fixtureProfile() };
    storage.setItem(DATA_KEY, text(fromOtherTab));
    expect(synced(storage, blocked)).toEqual({
      ...blocked,
      data: fromOtherTab,
      canWrite: true,
      dataReplaced: true,
      storedText: text(fromOtherTab),
    });
  });

  it('notes a replaced data set only for a restore or a reload', () => {
    const opened = open(new MemoryStorage());
    expect(opened).toMatchObject({ dataReplaced: false, lastWriteFailed: false });
    expect(appStoreReducer(opened, saveInvoice).dataReplaced).toBe(false);
    const restored = appStoreReducer(opened, { type: 'backup/restore', data: emptyAppData() });
    expect(restored.dataReplaced).toBe(true);
    expect(appStoreReducer(restored, saveInvoice).dataReplaced).toBe(true);
    expect(appStoreReducer(opened, { type: 'data/reload', data: emptyAppData() }).dataReplaced).toBe(true);
  });

  it('follows the outcome of the last write', () => {
    const storage = new MemoryStorage();
    const opened = open(storage);
    storage.failWrites = true;
    const failed = changeAppStore(storage, opened, saveInvoice);
    expect(failed.written).toBe('failed');
    expect(failed.store).toMatchObject({ lastWriteFailed: true, storedText: opened.storedText });
    expect(storage.getItem(DATA_KEY)).toBe(opened.storedText);
    const again = changeAppStore(storage, failed.store, saveProfile);
    expect(again.written).toBe('failed');
    expect(again.store.lastWriteFailed).toBe(true);
    storage.failWrites = false;
    const stored = changeAppStore(storage, again.store, { type: 'backup/exported', at: '2026-09-30' });
    expect(stored.written).toBe('saved');
    expect(stored.store.lastWriteFailed).toBe(false);
    // The change the browser refused went along: nothing of this tab was lost.
    expect(loadAppData(storage).data).toMatchObject({ invoices: [{ id: '2026-09-001' }], lastBackupAt: '2026-09-30' });
  });

  it('drops the note of a refused write once another tab’s data replaces this tab’s', () => {
    const failed: AppStore = { ...open(new MemoryStorage()), lastWriteFailed: true };
    expect(appStoreReducer(failed, saveInvoice).lastWriteFailed).toBe(true);
    expect(appStoreReducer(failed, { type: 'backup/restore', data: emptyAppData() }).lastWriteFailed).toBe(true);
    expect(appStoreReducer(failed, { type: 'data/reload', data: emptyAppData() }).lastWriteFailed).toBe(false);
    // The same data again still clears the note.
    expect(appStoreReducer(failed, { type: 'data/reload', data: failed.data })).toEqual({
      ...failed,
      dataReplaced: true,
      lastWriteFailed: false,
    });
  });

  it('keeps saving off for every other action', () => {
    const storage = blockedByOlderCopy();
    let store = open(storage);
    const others: AppStoreAction[] = [
      saveInvoice,
      { type: 'invoice/setPaid', id: '2026-09-001', paidAt: '2026-09-10' },
      saveProfile,
      { type: 'backup/exported', at: '2026-09-30' },
      { type: 'customer/delete', customer: fixtureInvoice().customer },
      { type: 'catalog/delete', description: 'Vývoj' },
      { type: 'invoice/delete', id: '2026-09-001' },
    ];
    for (const action of others) {
      const change = changeAppStore(storage, store, action);
      expect(change.written).toBe('off');
      store = change.store;
      expect(store.canWrite).toBe(false);
    }
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: CORRUPT, [BROKEN_DATA_KEY]: OLDER_COPY });
  });

  it('reports a refused write and stays on, so the next change is tried again', () => {
    const storage = blockedByOlderCopy();
    storage.failingKeys.add(DATA_KEY);
    const resumed = changeAppStore(storage, open(storage), { type: 'saving/resume' });
    expect(resumed.written).toBe('failed');
    expect(resumed.store).toMatchObject({ canWrite: true, lastWriteFailed: true });
    expect(storage.getItem(DATA_KEY)).toBe(CORRUPT);
    storage.failingKeys.delete(DATA_KEY);
    expect(changeAppStore(storage, resumed.store, saveInvoice).written).toBe('saved');
  });

  it('writes nothing for an action that changes nothing', () => {
    const storage = new MemoryStorage();
    const { store } = changeAppStore(storage, open(storage), saveInvoice);
    storage.failWrites = true;
    const nothing = { store, written: 'unchanged', problem: null };
    expect(changeAppStore(storage, store, { type: 'saving/resume' })).toEqual(nothing);
  });

  it('writes nothing for an action it cannot apply, and says why', () => {
    const storage = new MemoryStorage();
    const { store } = changeAppStore(storage, open(storage), saveInvoice);
    storage.failWrites = true;
    const taken = 'Faktura s číslem 2026-09-001 už existuje.';
    expect(changeAppStore(storage, store, saveInvoice)).toEqual({ store, written: 'unchanged', problem: taken });
    const sameNumber: AppStoreAction = { ...saveInvoice, invoice: fixtureInvoice({ id: 'other' }) };
    expect(changeAppStore(storage, store, sameNumber)).toEqual({ store, written: 'unchanged', problem: taken });
    expect(changeAppStore(storage, store, { type: 'invoice/delete', id: 'smazana' })).toEqual({
      store,
      written: 'unchanged',
      problem: INVOICE_GONE,
    });
  });

  it('stores the data as it is after the Invokit keys were removed', () => {
    const storage = holding({
      [LEGACY_DATA_KEY]: JSON.stringify({ version: 1, customers: [], items: [], invoices: [] }),
    });
    storage.failingKeys.add(DATA_KEY);
    const opened = open(storage);
    expect(opened.storedText).toBeNull();
    const refused = rewriteAppStore(storage, opened);
    expect(refused.written).toBe('failed');
    expect(refused.store.lastWriteFailed).toBe(true);
    storage.failingKeys.delete(DATA_KEY);
    const stored = rewriteAppStore(storage, refused.store);
    expect(stored.written).toBe('saved');
    expect(stored.store).toMatchObject({ lastWriteFailed: false, storedText: text(opened.data) });
    expect(storage.getItem(DATA_KEY)).toBe(text(opened.data));
  });
});

describe('the move from the previous key', () => {
  it('reads version 2 data without writing, then moves it with the first change', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 }, new WatchedStorage()) as WatchedStorage;
    storage.written.length = 0;
    const opened = open(storage);
    expect(opened).toMatchObject({ data: OLD, canWrite: true, storedText: null, previousText: V2, olderTab: null });
    expect(synced(storage, opened)).toBe(opened);
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2 });
    expect(storage.written).toEqual([]);

    const { store, written } = changeAppStore(storage, opened, saveLogo);
    expect(written).toBe('saved');
    expect(store).toMatchObject({ previousText: null, storedText: text(store.data), olderTab: null });
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(store.data) });
    expect(store.data.invoices).toEqual(OLD.invoices);
    expect(store.data.logos).toEqual([{ id: 'logo-1', dataUrl: FIXTURE_LOGO }]);
    // Version 3 was stored before version 2 went, and the previous key was never written.
    expect(storage.written).toEqual([DATA_KEY]);

    const reloaded = loadAppData(storage);
    expect(reloaded).toMatchObject({ recovered: false, previousText: null, olderAside: false });
    expect(reloaded.data).toEqual(store.data);
  });

  it('keeps the version 2 text when the first change cannot be stored, and moves with the next one that can', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    storage.failingKeys.add(DATA_KEY);
    const refused = changeAppStore(storage, open(storage), saveInvoice);
    expect(refused.written).toBe('failed');
    expect(refused.store).toMatchObject({ lastWriteFailed: true, storedText: null, previousText: V2 });
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2 });

    storage.failingKeys.delete(DATA_KEY);
    const stored = changeAppStore(storage, refused.store, saveProfile);
    expect(stored.written).toBe('saved');
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(stored.store.data) });
    expect(stored.store.data.invoices.map((i) => i.id).sort()).toEqual(['2026-09-001', 'other-1']);
  });

  it('makes room for version 3 by removing version 2 when both do not fit', () => {
    const storage = new QuotaStorage(DATA_KEY.length + V2.length + 400);
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    const { store, written } = changeAppStore(storage, open(storage), { type: 'backup/exported', at: '2026-09-30' });
    expect(written).toBe('saved');
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(store.data) });
  });

  it('puts version 2 back, byte for byte, when version 3 does not fit even alone', () => {
    const storage = new QuotaStorage(PREVIOUS_DATA_KEY.length + V2.length);
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    const { store, written } = changeAppStore(storage, open(storage), saveInvoice);
    expect(written).toBe('failed');
    expect(store).toMatchObject({ lastWriteFailed: true, storedText: null, previousText: V2 });
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2 });
    expect(open(storage).data).toEqual(OLD);
  });

  it('replaces unreadable version 2 text that has a safe copy with the first change', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: CORRUPT });
    const opened = open(storage);
    expect(opened).toMatchObject({ canWrite: true, previousText: CORRUPT });
    const { store, written } = changeAppStore(storage, opened, saveInvoice);
    expect(written).toBe('saved');
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(store.data), [PREVIOUS_BROKEN_KEY]: CORRUPT });
    expect(loadAppData(storage)).toMatchObject({ recovered: false, olderAside: false });
  });

  it('leaves unreadable version 2 text without a safe copy in place until saving is resumed', () => {
    const storage = holding({ [PREVIOUS_BROKEN_KEY]: OLDER_COPY, [PREVIOUS_DATA_KEY]: CORRUPT });
    const opened = open(storage);
    expect(opened.canWrite).toBe(false);
    const unsaved = changeAppStore(storage, opened, saveInvoice);
    expect(unsaved.written).toBe('off');
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: CORRUPT, [PREVIOUS_BROKEN_KEY]: OLDER_COPY });
    const resumed = changeAppStore(storage, unsaved.store, { type: 'saving/resume' });
    expect(resumed.written).toBe('saved');
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(resumed.store.data), [PREVIOUS_BROKEN_KEY]: OLDER_COPY });
  });
});

describe('two tabs of this version on version 2 data', () => {
  it('move it once: the second tab takes over what the first stored and writes to the data key only', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 }, new WatchedStorage()) as WatchedStorage;
    const first = open(storage);
    const second = open(storage);
    storage.written.length = 0;
    const moved = changeAppStore(storage, first, saveLogo).store;

    const followed = synced(storage, second);
    expect(followed).toEqual({ ...moved, dataReplaced: true });
    const later = changeAppStore(storage, followed, saveInvoice);
    expect(later.written).toBe('saved');
    expect(later.store.data.logos).toEqual(moved.data.logos);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(later.store.data) });
    expect(new Set(storage.written)).toEqual(new Set([DATA_KEY]));
  });

  it('move it once also when the second tab changes something before any event reached it', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    const first = open(storage);
    const second = open(storage);
    const moved = changeAppStore(storage, first, saveLogo).store;
    const { store, written } = changeAppStore(storage, second, saveInvoice);
    expect(written).toBe('saved');
    expect(store.data.logos).toEqual(moved.data.logos);
    expect(store.data.invoices.map((i) => i.id).sort()).toEqual(['2026-09-001', 'other-1']);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(store.data) });
    expect(synced(storage, moved)).toEqual({ ...store, dataReplaced: true });
  });

  it('take the version 2 text seen for a moment next to the stored version 3 for an older tab’s only until it is gone', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    const second = open(storage);
    // The first tab has stored version 3 and is about to remove the version 2 text.
    storage.setItem(DATA_KEY, text(OLD));
    const between = synced(storage, second);
    expect(between).toMatchObject({ data: OLD, olderTab: 'aside', previousText: null, storedText: text(OLD) });
    storage.removeItem(PREVIOUS_DATA_KEY);
    expect(synced(storage, between)).toEqual({ ...between, olderTab: null });
  });
});

describe('an older Invoo saving in another tab', () => {
  it('is followed while nothing is under the data key: its saves are taken over and nothing is written', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    const opened = open(storage);
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    const followed = synced(storage, opened);
    expect(followed).toEqual({
      ...opened,
      data: OLD_SINCE,
      dataReplaced: true,
      previousText: V2_SINCE,
      olderTab: 'followed',
    });
    expect(synced(storage, followed)).toBe(followed);

    const third = olderAppData(withInvoices(other(1), other(2), other(3)));
    storage.setItem(PREVIOUS_DATA_KEY, third);
    const again = synced(storage, followed);
    expect(again.data.invoices.map((i) => i.id)).toEqual(['other-1', 'other-2', 'other-3']);
    expect(again).toMatchObject({ previousText: third, olderTab: 'followed', storedText: null });
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: third });
  });

  it('is followed from an empty start too, and from unreadable version 2 text it has replaced', () => {
    const blocked = new MemoryStorage();
    blocked.failWrites = true;
    const empty = open(blocked);
    blocked.failWrites = false;
    expect(empty).toMatchObject({ storedText: null, previousText: null });
    blocked.setItem(PREVIOUS_DATA_KEY, V2);
    expect(synced(blocked, empty)).toMatchObject({ data: OLD, previousText: V2, olderTab: 'followed' });

    const corrupt = holding({ [PREVIOUS_BROKEN_KEY]: OLDER_COPY, [PREVIOUS_DATA_KEY]: CORRUPT });
    const readOnly = open(corrupt);
    expect(readOnly.canWrite).toBe(false);
    corrupt.setItem(PREVIOUS_DATA_KEY, V2);
    expect(synced(corrupt, readOnly)).toMatchObject({ data: OLD, canWrite: true, previousText: V2 });
  });

  it('has its saves included in the move: the first change here lands on what it saved last', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    const opened = open(storage);
    // No event reached this tab before its own change.
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    const { store, written } = changeAppStore(storage, opened, saveInvoice);
    expect(written).toBe('saved');
    expect(store.data.invoices.map((i) => i.id).sort()).toEqual(['2026-09-001', 'other-1', 'other-2']);
    expect(store.olderTab).toBe('followed');
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(store.data) });
  });

  it('takes over that tab’s save after a change the browser refused here: the stored data is still its own', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    storage.failingKeys.add(DATA_KEY);
    const refused = changeAppStore(storage, open(storage), saveInvoice).store;
    expect(refused).toMatchObject({ lastWriteFailed: true, previousText: V2 });
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    const followed = synced(storage, refused);
    expect(followed).toMatchObject({ data: OLD_SINCE, lastWriteFailed: false, olderTab: 'followed' });
  });

  it('cannot change version 3 data: what it saves after the move stays aside, and this tab’s data as it is', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    const moved = changeAppStore(storage, open(storage), saveLogo).store;
    const stored = text(moved.data);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: stored });

    // The older tab never read version 3: it saves the data it holds plus its own change.
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    const noted = synced(storage, moved);
    expect(noted).toEqual({ ...moved, olderTab: 'aside' });
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: stored, [PREVIOUS_DATA_KEY]: V2_SINCE });
    expect(synced(storage, noted)).toBe(noted);

    // Later changes here go to the data key only.
    const later = changeAppStore(storage, noted, saveInvoice);
    expect(later.written).toBe('saved');
    expect(later.store.olderTab).toBe('aside');
    expect(later.store.data.logos).toEqual(moved.data.logos);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(later.store.data), [PREVIOUS_DATA_KEY]: V2_SINCE });
  });

  it('cannot change version 3 data with no tab of this version open: the next visit finds both', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    const moved = changeAppStore(storage, open(storage), saveLogo).store;
    const stored = text(moved.data);
    // This tab is closed; the older one, opened before the move, saves twice.
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    expect(storage.getItem(DATA_KEY)).toBe(stored);

    const next = open(storage);
    expect(next).toMatchObject({ data: moved.data, olderTab: 'aside', storedText: stored, previousText: null });
    expect(synced(storage, next)).toBe(next);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: stored, [PREVIOUS_DATA_KEY]: V2_SINCE });
  });

  it('is noted by a tab that loaded version 3, also when it saved before that tab listened', () => {
    const storage = holding({ [DATA_KEY]: text(OLD) });
    const opened = open(storage);
    expect(opened.olderTab).toBeNull();
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    expect(synced(storage, opened)).toEqual({ ...opened, olderTab: 'aside' });
  });

  it('is no longer noted once its data was removed after a download, and noted again when it saves again', () => {
    const storage = holding({ [DATA_KEY]: text(OLD), [PREVIOUS_DATA_KEY]: V2 });
    const opened = open(storage);
    expect(opened.olderTab).toBe('aside');
    // It saved again after the download: nothing is removed and the note stays.
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    expect(removePreviousData(storage, V2)).toBe(false);
    expect(synced(storage, opened)).toBe(opened);

    expect(removePreviousData(storage, V2_SINCE)).toBe(true);
    const cleared = synced(storage, opened);
    expect(cleared).toEqual({ ...opened, olderTab: null });
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(OLD) });

    storage.setItem(PREVIOUS_DATA_KEY, V2);
    expect(synced(storage, cleared).olderTab).toBe('aside');
  });

  it('is never taken over by a tab that has seen version 3 data, even if the data key is emptied', () => {
    const storage = holding({ [DATA_KEY]: text(OLD_SINCE) });
    const opened = open(storage);
    storage.removeItem(DATA_KEY);
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    expect(synced(storage, opened)).toBe(opened);
    // The next change stores this tab's data again; the older text stays aside.
    const { store, written } = changeAppStore(storage, opened, saveProfile);
    expect(written).toBe('saved');
    expect(store.data.invoices).toEqual(OLD_SINCE.invoices);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(store.data), [PREVIOUS_DATA_KEY]: V2 });
  });

  it('is ignored while what it left under the previous key cannot be read', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 });
    const opened = open(storage);
    for (const unreadable of [CORRUPT, '{"version":2}', NEWER, 'null']) {
      storage.setItem(PREVIOUS_DATA_KEY, unreadable);
      expect(synced(storage, opened)).toBe(opened);
    }
    storage.removeItem(PREVIOUS_DATA_KEY);
    expect(synced(storage, opened)).toBe(opened);
  });

  it('never has the previous key written by this version, whatever both tabs do', () => {
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2 }, new WatchedStorage()) as WatchedStorage;
    storage.written.length = 0;
    let store = open(storage);
    const step = (action: AppStoreAction) => {
      store = changeAppStore(storage, syncAppStore(storage, store), action).store;
    };
    const olderSaves = (value: string) => {
      storage.setItem(PREVIOUS_DATA_KEY, value);
      storage.written.pop();
      store = syncAppStore(storage, store);
    };
    olderSaves(V2_SINCE);
    step(saveInvoice);
    olderSaves(V2);
    step(saveLogo);
    olderSaves(V2_SINCE);
    step({ type: 'backup/restore', data: OLD });
    step({ type: 'saving/resume' });
    store = rewriteAppStore(storage, store).store;
    expect(new Set(storage.written)).toEqual(new Set([DATA_KEY]));
    expect(storage.getItem(PREVIOUS_DATA_KEY)).toBe(V2_SINCE);
    expect(storage.getItem(DATA_KEY)).toBe(text(OLD));
  });
});

describe('another tab of this version', () => {
  it('has what it stored taken over, without anything being written', () => {
    const storage = new MemoryStorage();
    const opened = open(storage);
    expect(synced(storage, opened)).toBe(opened);
    const theirs = { ...OLD, supplier: fixtureProfile(), logos: [] };
    storage.setItem(DATA_KEY, text(theirs));
    const followed = synced(storage, opened);
    expect(followed).toEqual({ ...opened, data: theirs, dataReplaced: true, storedText: text(theirs) });
    expect(synced(storage, followed)).toBe(followed);
  });

  it('leaves the store as it is while the storage holds what this tab loaded or stored', () => {
    const starts: Record<string, string>[] = [
      {},
      { [DATA_KEY]: text(OLD) },
      { [PREVIOUS_DATA_KEY]: V2 },
      { [DATA_KEY]: CORRUPT },
      { [PREVIOUS_DATA_KEY]: CORRUPT },
      { [DATA_KEY]: NEWER },
      { [DATA_KEY]: text(OLD), [PREVIOUS_DATA_KEY]: V2 },
      { [DATA_KEY]: CORRUPT, [BROKEN_DATA_KEY]: OLDER_COPY },
    ];
    for (const entries of starts) {
      const storage = holding(entries);
      const opened = open(storage);
      expect(synced(storage, opened)).toBe(opened);
      const changed = changeAppStore(storage, opened, saveInvoice).store;
      expect(synced(storage, changed)).toBe(changed);
    }
  });

  it('has nothing unsaved left after a take-over, so a write refused before is no longer noted', () => {
    const storage = new MemoryStorage();
    const opened = open(storage);
    storage.failWrites = true;
    const failed = changeAppStore(storage, opened, saveInvoice).store;
    expect(failed.lastWriteFailed).toBe(true);
    expect(synced(storage, failed)).toBe(failed);
    storage.failWrites = false;
    storage.setItem(DATA_KEY, text(OLD));
    expect(synced(storage, failed)).toMatchObject({ data: OLD, lastWriteFailed: false, storedText: text(OLD) });
  });

  it('never has its newer save overwritten by a change made here before its event arrived', () => {
    const storage = holding({ [DATA_KEY]: text(OLD) });
    const opened = open(storage);
    // The other tab saved a second invoice; this tab still shows one and changes something.
    storage.setItem(DATA_KEY, text(OLD_SINCE));
    const { store, written } = changeAppStore(storage, opened, saveInvoice);
    expect(written).toBe('saved');
    expect(store.data.invoices.map((i) => i.id).sort()).toEqual(['2026-09-001', 'other-1', 'other-2']);
    expect(storage.getItem(DATA_KEY)).toBe(text(store.data));
    // The late event finds the storage and this tab agreeing: the two tabs cannot swap their data.
    expect(synced(storage, store)).toBe(store);
  });

  it('has a change to an invoice it deleted meanwhile reported as not made, and nothing written', () => {
    const storage = holding({ [DATA_KEY]: text(OLD) });
    const opened = open(storage);
    // The other tab deleted the invoice this tab still shows and now marks as paid.
    storage.setItem(DATA_KEY, text(emptyAppData()));
    const before = snapshot(storage);
    for (const action of [
      { type: 'invoice/setPaid', id: 'other-1', paidAt: '2026-10-09' },
      { type: 'invoice/delete', id: 'other-1' },
    ] satisfies AppStoreAction[]) {
      const change = changeAppStore(storage, opened, action);
      expect(change).toMatchObject({ written: 'unchanged', problem: INVOICE_GONE });
      expect(change.store.data).toEqual(emptyAppData());
      expect(snapshot(storage)).toEqual(before);
      expect(outcomeOf(change, true)).toEqual({ result: 'rejected', reason: INVOICE_GONE });
    }
  });

  it('is ignored while what it left under the data key cannot be read; the next change replaces that text', () => {
    const storage = holding({ [DATA_KEY]: text(OLD) });
    const opened = open(storage);
    for (const unreadable of [CORRUPT, '{"version":3,"invoices":"broken"}', 'null']) {
      storage.setItem(DATA_KEY, unreadable);
      expect(synced(storage, opened)).toBe(opened);
    }
    storage.removeItem(DATA_KEY);
    expect(synced(storage, opened)).toBe(opened);
    const { store, written } = changeAppStore(storage, opened, saveProfile);
    expect(written).toBe('saved');
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(store.data) });
  });
});

describe('an invoice deleted in another tab while this tab edits it', () => {
  const paidInvoice = fixtureInvoice({ paid: true, paidAt: '2026-09-10' });

  it('is put back by saving the edit, with the paid state and date the editor held', () => {
    const storage = holding({ [DATA_KEY]: text(withInvoices(paidInvoice, other(1))) });
    const deleting = open(storage);
    const editing = open(storage);
    const edit = { ...structuredClone(editing.data.invoices.find((i) => i.id === paidInvoice.id)!), note: 'Děkujeme.' };

    const deleted = changeAppStore(storage, deleting, { type: 'invoice/delete', id: paidInvoice.id });
    expect(deleted.written).toBe('saved');
    expect(loadAppData(storage).data.invoices.map((i) => i.id)).toEqual(['other-1']);

    // No event reached the editing tab before it saved.
    const now = '2026-10-05T10:00:00Z';
    const saved = changeAppStore(storage, editing, { type: 'invoice/save', invoice: edit, now, create: false });
    expect(saved).toMatchObject({ written: 'saved', problem: null });
    expect(outcomeOf(saved, true)).toEqual({ result: 'stored' });
    const stored = loadAppData(storage).data.invoices;
    expect(stored.map((i) => i.id)).toEqual(['other-1', paidInvoice.id]);
    expect(stored[1]).toEqual({ ...edit, savedAt: now });
    expect(stored[1]).toMatchObject({ paid: true, paidAt: '2026-09-10', note: 'Děkujeme.' });
  });

  it('is put back the same way once the delete has reached the editing tab', () => {
    const storage = holding({ [DATA_KEY]: text(withInvoices(paidInvoice)) });
    const editing = open(storage);
    const edit = { ...structuredClone(editing.data.invoices[0]!), note: 'Děkujeme.' };
    changeAppStore(storage, open(storage), { type: 'invoice/delete', id: paidInvoice.id });
    const followed = synced(storage, editing);
    expect(followed.data.invoices).toEqual([]);

    const saved = changeAppStore(storage, followed, { type: 'invoice/save', invoice: edit, now: 'b', create: false });
    expect(outcomeOf(saved, true)).toEqual({ result: 'stored' });
    expect(loadAppData(storage).data.invoices).toEqual([{ ...edit, savedAt: 'b' }]);
  });
});

describe('two tabs offered the same next invoice number', () => {
  const TODAY = '2026-10-05';
  /** A new invoice as the editor builds it from the data its tab shows: the next number, and the id made of it. */
  const issue = (shown: AppData, customer: string): Extract<AppStoreAction, { type: 'invoice/save' }> => {
    const blank = createBlankInvoice(shown, TODAY, () => 'r1');
    return {
      type: 'invoice/save',
      invoice: {
        ...blank,
        customer: { ...blank.customer, name: customer },
        items: [fixtureItem('Vývoj', '10', 80_000)],
      },
      now: `${TODAY}T10:00:00Z`,
      create: true,
    };
  };

  it('keep the invoice saved first: the second save is rejected, not taken for an edit of it', () => {
    const storage = holding({ [DATA_KEY]: text(withInvoices(fixtureInvoice())) });
    const first = open(storage);
    const second = open(storage);
    const theirs = issue(first.data, 'První odběratel s.r.o.');
    const mine = issue(second.data, 'Druhý odběratel a.s.');
    expect(mine.invoice.number).toBe('2026-10-001');
    expect([mine.invoice.id, mine.invoice.number]).toEqual([theirs.invoice.id, theirs.invoice.number]);

    const issued = changeAppStore(storage, first, theirs);
    expect(issued.written).toBe('saved');
    const stored = snapshot(storage);

    // No event reached the second tab before its own save.
    const change = changeAppStore(storage, second, mine);
    expect(change).toMatchObject({ written: 'unchanged', problem: 'Faktura s číslem 2026-10-001 už existuje.' });
    expect(snapshot(storage)).toEqual(stored);
    expect(change.store.data).toEqual(issued.store.data);
    expect(change.store.data.invoices.find((i) => i.number === '2026-10-001')?.customer.name).toBe(
      'První odběratel s.r.o.',
    );
    expect(outcomeOf(change, true)).toEqual({
      result: 'rejected',
      reason: 'Faktura s číslem 2026-10-001 už existuje.',
    });

    // Numbered again from the data the tab shows now, it is saved next to the first.
    const again = issue(change.store.data, 'Druhý odběratel a.s.');
    expect(again.invoice.number).toBe('2026-10-002');
    const saved = changeAppStore(storage, change.store, again);
    expect(saved.written).toBe('saved');
    expect(loadAppData(storage).data.invoices.map((i) => [i.number, i.customer.name])).toEqual([
      ['2026-10-002', 'Druhý odběratel a.s.'],
      ['2026-10-001', 'První odběratel s.r.o.'],
      ['2026-09-001', 'Odběratel Test a.s.'],
    ]);
  });

  it('keep an edit an edit: the tab that issued the invoice still saves its changes to it', () => {
    const storage = new MemoryStorage();
    const issued = changeAppStore(storage, open(storage), issue(emptyAppData(), 'První odběratel s.r.o.')).store;
    const invoice = { ...issued.data.invoices[0]!, note: 'Děkujeme.' };
    const edited = changeAppStore(storage, issued, { type: 'invoice/save', invoice, now: 'b', create: false });
    expect(edited).toMatchObject({ written: 'saved', problem: null });
    expect(loadAppData(storage).data.invoices.map((i) => i.note)).toEqual(['Děkujeme.']);
  });
});

describe('outcomeOf', () => {
  const store = open(new MemoryStorage());
  const change = (written: AppStoreChange['written'], flags: Partial<AppStore> = {}): AppStoreChange => ({
    store: { ...store, ...flags },
    written,
    problem: null,
  });

  it('is stored only when the data is in a storage that outlives the visit', () => {
    expect(outcomeOf(change('saved'), true)).toEqual({ result: 'stored' });
    expect(outcomeOf(change('saved'), false)).toEqual({ result: 'kept' });
    expect(outcomeOf(change('unchanged'), true)).toEqual({ result: 'stored' });
    expect(outcomeOf(change('unchanged'), false)).toEqual({ result: 'kept' });
  });

  it('is kept when the change was applied for this visit only', () => {
    expect(outcomeOf(change('failed', { lastWriteFailed: true }), true)).toEqual({ result: 'kept' });
    expect(outcomeOf(change('off', { canWrite: false }), true)).toEqual({ result: 'kept' });
    // Nothing to change, but what this tab holds is not in the storage either.
    expect(outcomeOf(change('unchanged', { canWrite: false }), true)).toEqual({ result: 'kept' });
    expect(outcomeOf(change('unchanged', { lastWriteFailed: true }), true)).toEqual({ result: 'kept' });
  });

  it('is rejected with the reason whenever the action was not applied', () => {
    const reason = 'Faktura s číslem 2026-10-001 už existuje.';
    for (const persistent of [true, false]) {
      expect(outcomeOf({ ...change('unchanged'), problem: reason }, persistent)).toEqual({
        result: 'rejected',
        reason,
      });
    }
  });

  it('follows real changes: stored, refused by the browser, switched off, rejected', () => {
    const storage = new MemoryStorage();
    const saved = changeAppStore(storage, open(storage), saveInvoice);
    expect(outcomeOf(saved, true)).toEqual({ result: 'stored' });
    expect(outcomeOf(changeAppStore(storage, saved.store, saveInvoice), true).result).toBe('rejected');
    storage.failWrites = true;
    expect(outcomeOf(changeAppStore(storage, saved.store, saveProfile), true)).toEqual({ result: 'kept' });
    const blocked = blockedByOlderCopy();
    expect(outcomeOf(changeAppStore(blocked, open(blocked), saveInvoice), true)).toEqual({ result: 'kept' });
  });
});

describe('data of a newer Invoo under the data key', () => {
  const tries: AppStoreAction[] = [
    saveInvoice,
    { type: 'saving/resume' },
    { type: 'backup/restore', data: OLD_SINCE },
    { type: 'data/reload', data: OLD_SINCE },
    saveLogo,
  ];

  function neverWrites(storage: MemoryStorage, start: AppStore): void {
    const before = snapshot(storage);
    let store = start;
    for (const action of tries) {
      const change = changeAppStore(storage, store, action);
      expect(['off', 'unchanged']).toContain(change.written);
      store = change.store;
      expect(store).toMatchObject({ canWrite: false, newer: true });
      expect(snapshot(storage)).toEqual(before);
    }
    const rewritten = rewriteAppStore(storage, store);
    expect(rewritten.written).toBe('off');
    expect(snapshot(storage)).toEqual(before);
  }

  it('ends this tab’s writing when another tab stores it', () => {
    const storage = holding({ [DATA_KEY]: text(OLD) });
    const opened = open(storage);
    storage.setItem(DATA_KEY, NEWER);
    const stopped = synced(storage, opened);
    expect(stopped).toEqual({ ...opened, canWrite: false, newer: true, storedText: NEWER });
    expect(synced(storage, stopped)).toBe(stopped);
    neverWrites(storage, stopped);
  });

  it('is never overwritten by a change made before its event arrived', () => {
    const storage = holding({ [DATA_KEY]: text(OLD) });
    const opened = open(storage);
    storage.setItem(DATA_KEY, NEWER);
    const { store, written } = changeAppStore(storage, opened, saveInvoice);
    expect(written).toBe('off');
    expect(store).toMatchObject({ canWrite: false, newer: true });
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: NEWER });
    neverWrites(storage, store);
  });

  it('is left alone by a tab that finds it when loading', () => {
    const storage = holding({ [DATA_KEY]: NEWER, [PREVIOUS_DATA_KEY]: V2 });
    const opened = open(storage);
    expect(opened).toMatchObject({ canWrite: false, newer: true });
    neverWrites(storage, opened);
  });

  it('keeps this tab from writing even after text of this version shows up again', () => {
    const storage = holding({ [DATA_KEY]: NEWER });
    const opened = open(storage);
    storage.setItem(DATA_KEY, text(OLD));
    const followed = synced(storage, opened);
    expect(followed).toMatchObject({ data: OLD, canWrite: false, newer: true });
    expect(changeAppStore(storage, followed, saveInvoice).written).toBe('off');
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(OLD) });
  });
});

describe('logos the invoices print, across tabs', () => {
  const full = fullLogoData();
  const oneLogoTooMany: AppStoreAction = { type: 'supplier/save', supplier: fixtureProfile(), logo: fixtureLogo(21) };

  it('all stay stored when a tab that never saw them tries to save one logo too many', () => {
    const storage = new MemoryStorage();
    const stale = open(storage);
    expect(stale.data.logos).toEqual([]);
    // Another tab stored the invoices and logos; no event reached this one.
    storage.setItem(DATA_KEY, text(full));
    const change = changeAppStore(storage, stale, oneLogoTooMany);
    expect(change).toMatchObject({ written: 'unchanged', problem: TOO_MANY_LOGOS });
    expect(change.store.data).toEqual(full);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: text(full) });
    expect(outcomeOf(change, true)).toEqual({ result: 'rejected', reason: TOO_MANY_LOGOS });
  });

  it('all stay stored when such a tab saves anything else', () => {
    const storage = new MemoryStorage();
    const stale = open(storage);
    storage.setItem(DATA_KEY, text(full));
    const { store, written } = changeAppStore(storage, stale, saveInvoice);
    expect(written).toBe('saved');
    expect(printedLogos(loadAppData(storage).data)).toEqual({ ...printedLogos(full), '2026-09-001': null });
    expect(store.data.logos).toEqual(full.logos);
  });

  it('all stay stored through a refused logo, a take-over, an older tab’s save and a refused write', () => {
    const storage = holding({ [DATA_KEY]: text(full) });
    let store = open(storage);
    const stays = () => {
      expect(printedLogos(loadAppData(storage).data)).toMatchObject(printedLogos(full));
      expect(printedLogos(store.data)).toMatchObject(printedLogos(full));
    };
    const refused = changeAppStore(storage, store, oneLogoTooMany);
    expect(refused).toEqual({ store, written: 'unchanged', problem: TOO_MANY_LOGOS });
    stays();

    const theirs = { ...full, lastBackupAt: '2026-09-30' };
    storage.setItem(DATA_KEY, text(theirs));
    store = synced(storage, store);
    expect(store.data).toEqual(theirs);
    stays();

    storage.setItem(PREVIOUS_DATA_KEY, V2);
    store = synced(storage, store);
    expect(store.olderTab).toBe('aside');
    stays();

    storage.failingKeys.add(DATA_KEY);
    store = changeAppStore(storage, store, saveInvoice).store;
    expect(store.lastWriteFailed).toBe(true);
    stays();
    storage.failingKeys.delete(DATA_KEY);
    store = changeAppStore(storage, store, oneLogoTooMany).store;
    store = changeAppStore(storage, store, saveProfile).store;
    stays();
    expect(loadAppData(storage).data.logos).toEqual(full.logos);
    expect(loadAppData(storage).data.invoices).toHaveLength(21);
  });
});
