import { describe, expect, it } from 'vitest';
import { FIXTURE_LOGO, fixtureInvoice, fixtureProfile } from '../test/invoiceFixture';
import { olderAppData } from '../test/olderAppData';
import { emptyAppData, type AppData } from './appData';
import { BROKEN_DATA_KEY, DATA_KEY, loadAppData } from './appDataStorage';
import {
  appStoreReducer,
  catchUpOtherTab,
  followOtherTab,
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

    const later = apply(storage, resumed.store, { type: 'supplier/save', supplier: fixtureProfile(), logo: null });
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
    const blocked: AppStore = {
      data: emptyAppData(),
      canWrite: false,
      dataReplaced: false,
      lastWriteFailed: false,
      storedCurrent: false,
      olderTab: null,
    };
    const fromOtherTab = { ...emptyAppData(), supplier: fixtureProfile() };
    expect(appStoreReducer(blocked, { type: 'data/reload', data: fromOtherTab })).toEqual({
      data: fromOtherTab,
      canWrite: true,
      dataReplaced: true,
      lastWriteFailed: false,
      storedCurrent: false,
      olderTab: null,
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

  it('drops the note of a refused write once another tab’s data replaces this tab’s', () => {
    const failed = settleAppStore(openAppStore(loadAppData(new MemoryStorage())), 'failed');
    expect(failed.lastWriteFailed).toBe(true);
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

  it('knows whether the storage holds current data: loaded so, or once a write is stored', () => {
    expect(openAppStore(loadAppData(new MemoryStorage())).storedCurrent).toBe(true);
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, olderAppData(emptyAppData()));
    const opened = openAppStore(loadAppData(storage));
    expect(opened.storedCurrent).toBe(false);
    expect(settleAppStore(opened, 'failed').storedCurrent).toBe(false);
    expect(settleAppStore(opened, 'off')).toBe(opened);
    expect(settleAppStore(opened, 'saved')).toEqual({ ...opened, storedCurrent: true });
  });

  it('keeps saving off for every other action', () => {
    let store: AppStore = {
      data: emptyAppData(),
      canWrite: false,
      dataReplaced: false,
      lastWriteFailed: false,
      storedCurrent: false,
      olderTab: null,
    };
    const others: AppStoreAction[] = [
      saveInvoice,
      { type: 'invoice/setPaid', id: '2026-09-001', paidAt: '2026-09-10' },
      { type: 'supplier/save', supplier: fixtureProfile(), logo: null },
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

describe('followOtherTab', () => {
  const withProfile: AppData = { ...emptyAppData(), supplier: fixtureProfile() };
  const withInvoice: AppData = { ...emptyAppData(), invoices: [fixtureInvoice()] };

  /** A change made the way the page makes it: reduced, written, and the outcome of the write noted. */
  const change = (storage: Storage, store: AppStore, action: AppStoreAction): AppStore => {
    const { store: next, written } = apply(storage, store, action);
    return settleAppStore(next, written);
  };

  /** A visit that started on current data and saved an invoice. */
  const opened = (storage: Storage) => {
    const store = change(storage, openAppStore(loadAppData(storage)), saveInvoice);
    expect(store.data.invoices).toHaveLength(1);
    expect(store.storedCurrent).toBe(true);
    return store;
  };

  /** A visit that started on what an older Invoo stored and changed nothing: the stored text is still version 2. */
  const openedOnOlder = (storage: Storage, data: AppData = emptyAppData()) => {
    const text = olderAppData(data);
    storage.setItem(DATA_KEY, text);
    const store = openAppStore(loadAppData(storage));
    expect(store).toMatchObject({ data, canWrite: true, storedCurrent: false });
    expect(storage.getItem(DATA_KEY)).toBe(text);
    return store;
  };

  /** Another tab stores the text; returns what the key held before, as the storage event reports it. */
  const otherTabWrites = (storage: Storage, text: string): string | null => {
    const replaced = storage.getItem(DATA_KEY);
    storage.setItem(DATA_KEY, text);
    return replaced;
  };

  const follow = (storage: Storage, store: AppStore, text: string): AppStore =>
    followOtherTab(storage, store, text, otherTabWrites(storage, text));

  it('takes over current data another tab wrote, without writing it back', () => {
    const storage = new MemoryStorage();
    const store = opened(storage);
    const other = JSON.stringify(withProfile);
    const next = follow(storage, store, other);
    expect(next).toMatchObject({ dataReplaced: true, olderTab: null, storedCurrent: true });
    expect(next.data.supplier?.party.name).toBe('Ukázka s.r.o.');
    expect(storage.getItem(DATA_KEY)).toBe(other);

    const olderStorage = new MemoryStorage();
    const fromOlder = follow(olderStorage, openedOnOlder(olderStorage), other);
    expect(fromOlder).toMatchObject({ data: withProfile, olderTab: null, storedCurrent: true });
  });

  it('has nothing unsaved left after a take-over, so a write refused before is no longer noted', () => {
    const storage = new MemoryStorage();
    const store = opened(storage);
    storage.failWrites = true;
    const unsaved = change(storage, store, { type: 'supplier/save', supplier: fixtureProfile(), logo: null });
    storage.failWrites = false;
    expect(unsaved.lastWriteFailed).toBe(true);
    const next = follow(storage, unsaved, JSON.stringify(withInvoice));
    expect(next).toMatchObject({ data: withInvoice, lastWriteFailed: false });
  });

  it('takes over what an older Invoo saves while the stored data is still version 2, and writes nothing', () => {
    const storage = new MemoryStorage();
    const store = openedOnOlder(storage);
    const first = olderAppData(withInvoice);
    const replaced = otherTabWrites(storage, first);
    expect(replaced).toBe(olderAppData(emptyAppData()));
    // A write would be refused and noted: none is tried.
    storage.failWrites = true;
    const next = followOtherTab(storage, store, first, replaced);
    storage.failWrites = false;
    expect(next).toMatchObject({
      data: withInvoice,
      olderTab: 'followed',
      dataReplaced: true,
      storedCurrent: false,
      lastWriteFailed: false,
    });
    expect(storage.getItem(DATA_KEY)).toBe(first);

    const second = olderAppData({ ...withInvoice, supplier: fixtureProfile() });
    const again = follow(storage, next, second);
    expect(again).toMatchObject({ data: { ...withInvoice, supplier: fixtureProfile() }, olderTab: 'followed' });
    expect(storage.getItem(DATA_KEY)).toBe(second);
  });

  it('takes an older Invoo’s data over when the key held nothing before', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const store = openAppStore(loadAppData(storage));
    storage.failWrites = false;
    expect(storage.getItem(DATA_KEY)).toBeNull();
    expect(store.storedCurrent).toBe(false);
    const older = olderAppData(withInvoice);
    const replaced = otherTabWrites(storage, older);
    expect(replaced).toBeNull();
    expect(followOtherTab(storage, store, older, replaced)).toMatchObject({ data: withInvoice, olderTab: 'followed' });
    expect(storage.getItem(DATA_KEY)).toBe(older);
  });

  it.each([CORRUPT, '{"version":3,"invoices":"broken"}'])(
    'takes an older Invoo’s data over when the key held unreadable text: %s',
    (unreadable) => {
      const storage = new MemoryStorage();
      storage.setItem(DATA_KEY, unreadable);
      const store = openAppStore(loadAppData(storage));
      expect(store).toMatchObject({ canWrite: true, storedCurrent: false });
      const older = olderAppData(withInvoice);
      expect(follow(storage, store, older)).toMatchObject({ data: withInvoice, olderTab: 'followed' });
      expect(storage.getItem(DATA_KEY)).toBe(older);

      const blocked = blockedByOlderCopy();
      const off = openAppStore(loadAppData(blocked));
      expect(off.canWrite).toBe(false);
      expect(follow(blocked, off, older)).toMatchObject({ data: withInvoice, canWrite: true, olderTab: 'followed' });
      expect(blocked.getItem(DATA_KEY)).toBe(older);
    },
  );

  it('undoes an older Invoo’s write over current data: writes its own data back and notes the older tab', () => {
    const storage = new MemoryStorage();
    const store = opened(storage);
    const older = olderAppData(withProfile);
    const next = follow(storage, store, older);
    expect(next.data).toBe(store.data);
    expect(next).toMatchObject({ olderTab: 'overwrote', dataReplaced: false, lastWriteFailed: false });
    expect(loadAppData(storage).data).toEqual(store.data);
    expect(follow(storage, next, older)).toEqual(next);
    expect(loadAppData(storage).data).toEqual(store.data);
  });

  it('follows an older tab until this tab saves, then undoes what that tab writes', () => {
    const storage = new MemoryStorage();
    const followed = follow(storage, openedOnOlder(storage), olderAppData(withInvoice));
    expect(followed).toMatchObject({ data: withInvoice, olderTab: 'followed', storedCurrent: false });

    // This tab saves a profile with a logo: the key now holds version 3, which the older tab cannot read.
    const saved = change(storage, followed, { type: 'supplier/save', supplier: fixtureProfile(), logo: FIXTURE_LOGO });
    expect(saved).toMatchObject({ olderTab: 'followed', storedCurrent: true, lastWriteFailed: false });
    expect(loadAppData(storage)).toMatchObject({ storedCurrent: true, data: saved.data });
    expect(saved.data.logos).toHaveLength(1);

    // The older tab still has only the invoice and saves it marked as paid.
    const paid = { ...fixtureInvoice(), paid: true, paidAt: '2026-09-10' };
    const next = follow(storage, saved, olderAppData({ ...emptyAppData(), invoices: [paid] }));
    expect(next.data).toBe(saved.data);
    expect(next).toMatchObject({ olderTab: 'overwrote', lastWriteFailed: false });
    const stored = loadAppData(storage).data;
    expect(stored).toEqual(saved.data);
    expect(stored.logos).toHaveLength(1);
    expect(stored.invoices[0]?.paid).toBe(false);
  });

  it('undoes two older writes in a row, though the second replaced the older tab’s own text', () => {
    const storage = new MemoryStorage();
    const store = opened(storage);
    const mine = storage.getItem(DATA_KEY);
    const first = olderAppData(emptyAppData());
    const second = olderAppData(withProfile);
    // Both writes land before this tab handles the first event.
    storage.setItem(DATA_KEY, first);
    storage.setItem(DATA_KEY, second);
    const afterFirst = followOtherTab(storage, store, first, mine);
    expect(storage.getItem(DATA_KEY)).toBe(mine);
    const afterSecond = followOtherTab(storage, afterFirst, second, first);
    expect(afterSecond.data).toBe(store.data);
    expect(afterSecond).toMatchObject({ olderTab: 'overwrote', dataReplaced: false });
    expect(storage.getItem(DATA_KEY)).toBe(mine);
  });

  it('notes a refused write-back and tries again at the older tab’s next write', () => {
    const storage = new MemoryStorage();
    const store = opened(storage);
    const first = olderAppData(emptyAppData());
    const replaced = otherTabWrites(storage, first);
    storage.failWrites = true;
    const refused = followOtherTab(storage, store, first, replaced);
    storage.failWrites = false;
    expect(refused.data).toBe(store.data);
    expect(refused).toMatchObject({ olderTab: 'overwrote', lastWriteFailed: true });
    expect(storage.getItem(DATA_KEY)).toBe(first);

    // The key holds the older tab's text now, yet its next write is not taken over.
    const retried = follow(storage, refused, olderAppData(withProfile));
    expect(retried.data).toBe(store.data);
    expect(retried).toMatchObject({ olderTab: 'overwrote', lastWriteFailed: false, dataReplaced: false });
    expect(loadAppData(storage).data).toEqual(store.data);
  });

  it('writes nothing back while saving is off', () => {
    const storage = new MemoryStorage();
    const store = opened(storage);
    const older = olderAppData(emptyAppData());
    const replaced = otherTabWrites(storage, older);
    const next = followOtherTab(storage, { ...store, canWrite: false }, older, replaced);
    expect(next).toMatchObject({ olderTab: 'overwrote', lastWriteFailed: false });
    expect(storage.getItem(DATA_KEY)).toBe(older);
  });

  it('restores current data it never saw when an older Invoo overwrote it', () => {
    const storage = new MemoryStorage();
    const store = openedOnOlder(storage);
    const current: AppData = { ...withInvoice, supplier: fixtureProfile() };
    const older = olderAppData(emptyAppData());
    const next = followOtherTab(storage, store, older, JSON.stringify(current));
    expect(next).toMatchObject({ data: current, olderTab: 'overwrote', storedCurrent: true, lastWriteFailed: false });
    expect(loadAppData(storage).data).toEqual(current);

    // A refused restore is noted: the current data is then in this tab only.
    const full = new MemoryStorage();
    const start = openedOnOlder(full);
    full.failWrites = true;
    const refused = followOtherTab(full, start, older, JSON.stringify(current));
    expect(refused).toMatchObject({ data: current, olderTab: 'overwrote', lastWriteFailed: true });
    expect(full.getItem(DATA_KEY)).toBe(older);
  });

  it('takes the older tab’s save over after a refused change here: the stored data is still version 2', () => {
    const storage = new MemoryStorage();
    const start = openedOnOlder(storage);
    storage.failWrites = true;
    const unsaved = change(storage, start, saveInvoice);
    storage.failWrites = false;
    expect(unsaved).toMatchObject({ lastWriteFailed: true, storedCurrent: false });
    const older = olderAppData(withProfile);
    expect(follow(storage, unsaved, older)).toMatchObject({
      data: withProfile,
      olderTab: 'followed',
      lastWriteFailed: false,
    });
    expect(storage.getItem(DATA_KEY)).toBe(older);
  });

  it('ignores unreadable text, whatever it replaced', () => {
    const storage = new MemoryStorage();
    const store = opened(storage);
    const mine = storage.getItem(DATA_KEY);
    expect(followOtherTab(storage, store, CORRUPT, mine)).toBe(store);
    expect(followOtherTab(storage, store, JSON.stringify({ ...emptyAppData(), version: 4 }), mine)).toBe(store);
    const fresh = openedOnOlder(new MemoryStorage());
    expect(followOtherTab(storage, fresh, CORRUPT, olderAppData(emptyAppData()))).toBe(fresh);
    expect(followOtherTab(storage, fresh, CORRUPT, mine)).toBe(fresh);
    expect(followOtherTab(storage, fresh, CORRUPT, null)).toBe(fresh);
    expect(storage.getItem(DATA_KEY)).toBe(mine);
  });

  it('never takes over an older text that fails the checks, and still undoes it over current data', () => {
    const broken = '{"version":2}';
    const olderStorage = new MemoryStorage();
    const fresh = openedOnOlder(olderStorage);
    expect(follow(olderStorage, fresh, broken)).toBe(fresh);
    expect(olderStorage.getItem(DATA_KEY)).toBe(broken);

    const storage = new MemoryStorage();
    const store = opened(storage);
    const next = follow(storage, store, broken);
    expect(next.data).toBe(store.data);
    expect(next.olderTab).toBe('overwrote');
    expect(loadAppData(storage).data).toEqual(store.data);
  });
});

describe('catchUpOtherTab', () => {
  const withProfile: AppData = { ...emptyAppData(), supplier: fixtureProfile() };
  const withInvoice: AppData = { ...emptyAppData(), invoices: [fixtureInvoice()] };

  /** Loads what the storage holds, as the page does before it listens to the key. */
  const load = (storage: Storage) => {
    const loaded = loadAppData(storage);
    return { store: openAppStore(loaded), loadedText: loaded.storedText };
  };

  const holding = (text: string) => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, text);
    return storage;
  };

  it('leaves the store as it is while the key holds what was loaded', () => {
    const starts = [
      new MemoryStorage(),
      holding(JSON.stringify(withInvoice)),
      holding(olderAppData(withInvoice)),
      holding(CORRUPT),
      blockedByOlderCopy(),
    ];
    for (const storage of starts) {
      const text = storage.getItem(DATA_KEY);
      const { store, loadedText } = load(storage);
      expect(catchUpOtherTab(storage, store, loadedText)).toBe(store);
      if (text !== null) expect(storage.getItem(DATA_KEY)).toBe(text);
    }
    const full = new MemoryStorage();
    full.failWrites = true;
    const { store, loadedText } = load(full);
    expect(loadedText).toBeNull();
    expect(catchUpOtherTab(full, store, loadedText)).toBe(store);
  });

  it('does not take this tab’s own change, made before it listened, for another tab’s', () => {
    const storage = holding(olderAppData(withProfile));
    const { store, loadedText } = load(storage);
    const { store: next, written } = apply(storage, store, saveInvoice);
    const changed = settleAppStore(next, written);
    expect(written).toBe('saved');
    expect(catchUpOtherTab(storage, changed, loadedText)).toBe(changed);
  });

  it('takes over what a current tab wrote between loading and listening, without writing it back', () => {
    const storage = holding(JSON.stringify(withInvoice));
    const { store, loadedText } = load(storage);
    const other = JSON.stringify({ ...withInvoice, supplier: fixtureProfile() });
    storage.setItem(DATA_KEY, other);
    storage.failWrites = true;
    const next = catchUpOtherTab(storage, store, loadedText);
    expect(next).toMatchObject({
      data: { ...withInvoice, supplier: fixtureProfile() },
      dataReplaced: true,
      olderTab: null,
      lastWriteFailed: false,
    });
    expect(storage.getItem(DATA_KEY)).toBe(other);
    // Caught up: a second look changes nothing more.
    expect(catchUpOtherTab(storage, next, loadedText)).toBe(next);
  });

  it('takes over what an older Invoo saved meanwhile while the stored data is still version 2', () => {
    const storage = holding(olderAppData(withInvoice));
    const { store, loadedText } = load(storage);
    const older = olderAppData({ ...withInvoice, supplier: fixtureProfile() });
    storage.setItem(DATA_KEY, older);
    const next = catchUpOtherTab(storage, store, loadedText);
    expect(next).toMatchObject({
      data: { ...withInvoice, supplier: fixtureProfile() },
      olderTab: 'followed',
      storedCurrent: false,
    });
    expect(storage.getItem(DATA_KEY)).toBe(older);
  });

  it('undoes what an older Invoo wrote meanwhile over the current data that was loaded', () => {
    const storage = holding(JSON.stringify(withInvoice));
    const { store, loadedText } = load(storage);
    storage.setItem(DATA_KEY, olderAppData(withProfile));
    const next = catchUpOtherTab(storage, store, loadedText);
    expect(next.data).toBe(store.data);
    expect(next).toMatchObject({ olderTab: 'overwrote', lastWriteFailed: false });
    expect(loadAppData(storage).data).toEqual(withInvoice);
    expect(catchUpOtherTab(storage, next, loadedText)).toBe(next);
  });

  it('follows a write to a key that was still empty after loading', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const { store, loadedText } = load(storage);
    storage.failWrites = false;
    const other = JSON.stringify(withProfile);
    storage.setItem(DATA_KEY, other);
    expect(catchUpOtherTab(storage, store, loadedText)).toMatchObject({ data: withProfile, storedCurrent: true });
    expect(storage.getItem(DATA_KEY)).toBe(other);
  });

  it('ignores unreadable text written meanwhile, and a key that was removed', () => {
    const storage = holding(JSON.stringify(withInvoice));
    const { store, loadedText } = load(storage);
    storage.setItem(DATA_KEY, CORRUPT);
    expect(catchUpOtherTab(storage, store, loadedText)).toBe(store);
    expect(storage.getItem(DATA_KEY)).toBe(CORRUPT);
    storage.removeItem(DATA_KEY);
    expect(catchUpOtherTab(storage, store, loadedText)).toBe(store);
    expect(storage.getItem(DATA_KEY)).toBeNull();
  });
});
