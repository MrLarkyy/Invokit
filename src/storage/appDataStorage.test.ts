import { describe, expect, it } from 'vitest';
import { FIXTURE_LOGO, fixtureInvoice } from '../test/invoiceFixture';
import { olderAppData } from '../test/olderAppData';
import { QuotaStorage } from '../test/quotaStorage';
import { emptyAppData, type AppData } from './appData';
import {
  BROKEN_DATA_KEY,
  DATA_KEY,
  DRAFT_KEY,
  hasLegacyData,
  LEGACY_DATA_KEY,
  LEGACY_DRAFT_KEY,
  loadAppData,
  loadDraft,
  PREVIOUS_BROKEN_KEY,
  PREVIOUS_DATA_KEY,
  PREVIOUS_DRAFT_KEY,
  readDataText,
  readPreviousText,
  readStoredChange,
  removeLegacyData,
  removePreviousData,
  saveDraft,
  writeDataText,
} from './appDataStorage';
import { MemoryStorage } from './memoryStorage';
import { openStorage } from './openStorage';

const v1Invoice = {
  number: '2026-09-001',
  issueDate: '2026-09-02',
  dueDate: '2026-09-16',
  variableSymbol: '202609001',
  bankAccount: '19-2000145399/0800',
  paymentMethod: 'Převodem',
  supplier: { name: 'Ukázka s.r.o.', street: '', city: '', ico: '27410587', dic: '' },
  vatPayer: false,
  registryNote: '',
  customer: { name: 'Odběratel Test a.s.', street: '', city: '', ico: '', dic: '' },
  items: [{ quantity: '3', unit: 'ks', description: 'Kus', unitPrice: '0,1' }],
};
const v1Data = JSON.stringify({
  version: 1,
  customers: [],
  items: [],
  invoices: [{ ...v1Invoice, savedAt: 'a', paid: false }],
});
const CORRUPT = '{"version":2,"invoices":"broken"';

const withInvoice: AppData = { ...emptyAppData(), invoices: [fixtureInvoice()] };
const V3 = JSON.stringify(withInvoice);
/** What an Invoo from before version 3 stores for the same data. */
const V2 = olderAppData(withInvoice);
/** What that Invoo stores after one more change. */
const V2_SINCE = olderAppData({ ...withInvoice, lastBackupAt: '2026-09-30' });
const NEWER = JSON.stringify({ ...withInvoice, version: 4, somethingNew: [1] });

/** The draft as an Invoo from before version 3 stores it: without a look. */
function olderDraft(number: string): string {
  const raw = JSON.parse(JSON.stringify(fixtureInvoice({ number }))) as Record<string, unknown>;
  delete raw.appearance;
  return JSON.stringify(raw);
}

/** Every key the storage holds, to prove that nothing else was written or removed. */
function snapshot(storage: Storage): Record<string, string | null> {
  const all: Record<string, string | null> = {};
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null) all[key] = storage.getItem(key);
  }
  return all;
}

function holding(entries: Record<string, string>, storage: MemoryStorage = new MemoryStorage()): MemoryStorage {
  for (const [key, value] of Object.entries(entries)) storage.setItem(key, value);
  return storage;
}

const KEY_PAIRS = [
  [DATA_KEY, BROKEN_DATA_KEY],
  [PREVIOUS_DATA_KEY, PREVIOUS_BROKEN_KEY],
] as const;

describe('the storage keys', () => {
  it('keeps version 3 under its own keys, apart from the ones an older Invoo writes', () => {
    expect(DATA_KEY).toBe('invoo.data.v3');
    expect(BROKEN_DATA_KEY).toBe('invoo.data.v3.broken');
    expect(DRAFT_KEY).toBe('invoo.draft.v3');
    expect(PREVIOUS_DATA_KEY).toBe('invoo.data.v2');
    expect(PREVIOUS_BROKEN_KEY).toBe('invoo.data.v2.broken');
    expect(PREVIOUS_DRAFT_KEY).toBe('invoo.draft.v2');
  });
});

describe('loadAppData', () => {
  it('starts empty on first use, with no invented invoices, and stores that under the data key', () => {
    const storage = new MemoryStorage();
    const loaded = loadAppData(storage);
    expect(loaded).toEqual({
      data: emptyAppData(),
      recovered: false,
      unreadableText: null,
      readOnly: false,
      legacyBlocking: false,
      storedText: JSON.stringify(emptyAppData()),
      previousText: null,
      olderAside: false,
      newer: false,
    });
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: JSON.stringify(emptyAppData()) });
  });

  it('migrates v1 data to the data key and leaves the v1 key in place', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    const loaded = loadAppData(storage);
    expect(loaded.data.invoices.map((i) => i.number)).toEqual(['2026-09-001']);
    expect(loaded.data.version).toBe(3);
    expect(loaded.storedText).toBe(JSON.stringify(loaded.data));
    expect(snapshot(storage)).toEqual({ [LEGACY_DATA_KEY]: v1Data, [DATA_KEY]: JSON.stringify(loaded.data) });
  });

  it('prefers the data key, then the previous key, to the Invokit data', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(PREVIOUS_DATA_KEY, olderAppData(emptyAppData()));
    expect(loadAppData(storage).data.invoices).toEqual([]);
    storage.setItem(DATA_KEY, V3);
    expect(loadAppData(storage).data).toEqual(withInvoice);
  });

  it('reads data of before version 3 from the previous key with the default look, and writes nothing', () => {
    const storage = new MemoryStorage();
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    const loaded = loadAppData(storage);
    expect(loaded.data).toEqual(withInvoice);
    expect(loaded).toMatchObject({
      recovered: false,
      readOnly: false,
      storedText: null,
      previousText: V2,
      olderAside: false,
      newer: false,
    });
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2 });
  });

  it('loads the data key and notes text an older Invoo saved next to it, touching neither', () => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, V3);
    expect(loadAppData(storage)).toMatchObject({ storedText: V3, previousText: null, olderAside: false });
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    const loaded = loadAppData(storage);
    expect(loaded.data).toEqual(withInvoice);
    expect(loaded).toMatchObject({ recovered: false, storedText: V3, previousText: null, olderAside: true });
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3, [PREVIOUS_DATA_KEY]: V2_SINCE });
  });

  it('keeps corrupt data of the data key aside and offers it for download', () => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, CORRUPT);
    const loaded = loadAppData(storage);
    expect(loaded).toMatchObject({ recovered: true, readOnly: false, unreadableText: CORRUPT, storedText: CORRUPT });
    expect(loaded.data).toEqual(emptyAppData());
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: CORRUPT, [BROKEN_DATA_KEY]: CORRUPT });
  });

  it('keeps corrupt data of the previous key aside in that key’s own copy', () => {
    const storage = new MemoryStorage();
    storage.setItem(PREVIOUS_DATA_KEY, CORRUPT);
    const loaded = loadAppData(storage);
    expect(loaded).toMatchObject({
      recovered: true,
      readOnly: false,
      unreadableText: CORRUPT,
      storedText: null,
      previousText: CORRUPT,
    });
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: CORRUPT, [PREVIOUS_BROKEN_KEY]: CORRUPT });
  });

  it('never overwrites an older copy: then this session writes nothing', () => {
    for (const [key, brokenKey] of KEY_PAIRS) {
      const storage = new MemoryStorage();
      storage.setItem(brokenKey, 'first corruption');
      storage.setItem(key, CORRUPT);
      expect(loadAppData(storage)).toMatchObject({ recovered: true, readOnly: true, unreadableText: CORRUPT });
      expect(snapshot(storage)).toEqual({ [key]: CORRUPT, [brokenKey]: 'first corruption' });
    }
  });

  it('writes nothing this session when the copy cannot be stored', () => {
    for (const [key, brokenKey] of KEY_PAIRS) {
      const storage = new MemoryStorage();
      storage.setItem(key, CORRUPT);
      storage.failingKeys.add(brokenKey);
      expect(loadAppData(storage)).toMatchObject({ recovered: true, readOnly: true });
      expect(snapshot(storage)).toEqual({ [key]: CORRUPT });
    }
  });

  it('leaves data of a newer Invoo alone: no copy, nothing written, the tab starts empty and read-only', () => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, NEWER);
    const loaded = loadAppData(storage);
    expect(loaded).toMatchObject({
      newer: true,
      readOnly: true,
      recovered: false,
      unreadableText: null,
      storedText: NEWER,
    });
    expect(loaded.data).toEqual(emptyAppData());
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: NEWER });
  });

  it('reports no stored text when the Invokit data is unreadable or the first write is refused', () => {
    const brokenLegacy = new MemoryStorage();
    brokenLegacy.setItem(LEGACY_DATA_KEY, CORRUPT);
    expect(loadAppData(brokenLegacy)).toMatchObject({
      recovered: true,
      readOnly: false,
      unreadableText: CORRUPT,
      storedText: null,
    });
    expect(snapshot(brokenLegacy)).toEqual({ [LEGACY_DATA_KEY]: CORRUPT });
    const full = new MemoryStorage();
    full.failWrites = true;
    expect(loadAppData(full)).toMatchObject({ storedText: null, legacyBlocking: false });
  });

  it('migrates an unsaved v1 draft together with the data', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify({ ...v1Invoice, number: '2026-09-002' }));
    loadAppData(storage);
    expect(loadDraft(storage)?.number).toBe('2026-09-002');
    expect(storage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(storage.getItem(PREVIOUS_DRAFT_KEY)).toBeNull();
  });

  it('skips a v1 draft that is an invoice already saved (Invokit kept the last printed one)', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify(v1Invoice));
    loadAppData(storage);
    expect(loadDraft(storage)).toBeNull();
  });

  it('keeps an existing draft on a start that migrates the v1 data again', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify({ ...v1Invoice, number: '2026-09-002' }));
    storage.failingKeys.add(DATA_KEY);
    loadAppData(storage);
    const edited = fixtureInvoice({ number: '2026-09-077' });
    saveDraft(storage, edited);
    loadAppData(storage);
    expect(loadDraft(storage)).toEqual(edited);
  });

  it('reports Invokit data that does not fit, and removes the old keys on request', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify(v1Invoice));
    storage.failingKeys.add(DATA_KEY);
    const loaded = loadAppData(storage);
    expect(loaded.legacyBlocking).toBe(true);
    expect(loaded.data.invoices).toHaveLength(1);
    expect(hasLegacyData(storage)).toBe(true);
    expect(removeLegacyData(storage)).toBe(true);
    expect(hasLegacyData(storage)).toBe(false);
    expect(storage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
  });
});

describe('writeDataText', () => {
  it('saves and loads version 3 with a logo unchanged', () => {
    const storage = new MemoryStorage();
    const look = { template: 'klasik' as const, accent: '#1d4ed8', logoId: 'logo-1', brandFooter: false };
    const data = {
      ...emptyAppData(),
      invoices: [fixtureInvoice({ appearance: look })],
      logos: [{ id: 'logo-1', dataUrl: FIXTURE_LOGO }],
    };
    expect(writeDataText(storage, JSON.stringify(data), null)).toBe(true);
    expect(loadAppData(storage).data).toEqual(data);
  });

  it('moves the data on its first write: version 3 is stored, then the text it was read from is removed', () => {
    const storage = new MemoryStorage();
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    expect(writeDataText(storage, V3, V2)).toBe(true);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3 });
  });

  it('leaves the previous key alone when the data key cannot be written', () => {
    const storage = new MemoryStorage();
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    storage.failingKeys.add(DATA_KEY);
    expect(writeDataText(storage, V3, V2)).toBe(false);
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2 });
  });

  it('keeps what an older Invoo saved since the data was read: only the text it was read from is removed', () => {
    const storage = new MemoryStorage();
    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    expect(writeDataText(storage, V3, V2)).toBe(true);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3, [PREVIOUS_DATA_KEY]: V2_SINCE });

    // Refused, such a text does not make room either: this tab never read it.
    const full = new QuotaStorage(PREVIOUS_DATA_KEY.length + V2_SINCE.length + 10);
    full.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    expect(writeDataText(full, V3, V2)).toBe(false);
    expect(snapshot(full)).toEqual({ [PREVIOUS_DATA_KEY]: V2_SINCE });
  });

  it('never touches the previous key once the data key holds data', () => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, V3);
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    const next = JSON.stringify({ ...withInvoice, lastBackupAt: '2026-09-30' });
    expect(writeDataText(storage, next, V2)).toBe(true);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: next, [PREVIOUS_DATA_KEY]: V2 });
    storage.failingKeys.add(DATA_KEY);
    expect(writeDataText(storage, V3, V2)).toBe(false);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: next, [PREVIOUS_DATA_KEY]: V2 });
  });

  it('makes room by removing the previous text when both do not fit', () => {
    const storage = new QuotaStorage(DATA_KEY.length + V3.length + 10);
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    expect(writeDataText(storage, V3, V2)).toBe(true);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3 });
  });

  it('puts the previous text back, byte for byte, when the data does not fit even then', () => {
    expect(V3.length).toBeGreaterThan(V2.length);
    const storage = new QuotaStorage(PREVIOUS_DATA_KEY.length + V2.length);
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    expect(writeDataText(storage, V3, V2)).toBe(false);
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2 });
    expect(loadAppData(storage)).toMatchObject({ recovered: false, previousText: V2 });
  });

  it('does not put the old text over what an older Invoo saved while the key was empty', () => {
    class OlderTabSaving extends MemoryStorage {
      override removeItem(key: string): void {
        super.removeItem(key);
        if (key === PREVIOUS_DATA_KEY) super.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
      }
    }
    const storage = new OlderTabSaving();
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    storage.failingKeys.add(DATA_KEY);
    expect(writeDataText(storage, V3, V2)).toBe(false);
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2_SINCE });
  });

  it('reports a refused write', () => {
    const storage = new MemoryStorage();
    expect(writeDataText(storage, V3, null)).toBe(true);
    storage.failWrites = true;
    expect(writeDataText(storage, V3, null)).toBe(false);
    expect(saveDraft(storage, fixtureInvoice())).toBe(false);
  });
});

describe('the text an older Invoo saved aside', () => {
  it('is read as it is and removed only while it is the text the user downloaded', () => {
    const storage = new MemoryStorage();
    expect(readPreviousText(storage)).toBeNull();
    expect(readDataText(storage)).toBeNull();
    storage.setItem(DATA_KEY, V3);
    storage.setItem(PREVIOUS_DATA_KEY, V2);
    expect(readPreviousText(storage)).toBe(V2);
    expect(readDataText(storage)).toBe(V3);

    storage.setItem(PREVIOUS_DATA_KEY, V2_SINCE);
    expect(removePreviousData(storage, V2)).toBe(false);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3, [PREVIOUS_DATA_KEY]: V2_SINCE });

    expect(removePreviousData(storage, V2_SINCE)).toBe(true);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3 });
    expect(removePreviousData(storage, V2_SINCE)).toBe(true);
  });

  it('is a file the restore reads as a backup', () => {
    expect(readStoredChange(V2_SINCE)).toEqual({ kind: 'data', data: { ...withInvoice, lastBackupAt: '2026-09-30' } });
  });
});

describe('the draft', () => {
  it('round-trips under its own key', () => {
    const storage = new MemoryStorage();
    const look = { template: 'minimal' as const, accent: '#1d4ed8', logoId: null, brandFooter: false };
    const draft = fixtureInvoice({ appearance: look });
    expect(saveDraft(storage, draft)).toBe(true);
    expect(loadDraft(storage)).toEqual(draft);
    expect(snapshot(storage)).toEqual({ [DRAFT_KEY]: JSON.stringify(draft) });
    expect(saveDraft(storage, null)).toBe(true);
    expect(loadDraft(storage)).toBeNull();
    expect(snapshot(storage)).toEqual({});
  });

  it('opens a draft saved before version 3 while the data has not moved', () => {
    const before = olderDraft('2026-09-005');
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before });
    expect(loadDraft(storage)).toEqual(fixtureInvoice({ number: '2026-09-005' }));
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before });
  });

  it('is neither lost nor changed by what an older Invoo does with its own draft key', () => {
    for (const moved of [false, true]) {
      const storage = holding(moved ? { [DATA_KEY]: V3 } : { [PREVIOUS_DATA_KEY]: V2 });
      const look = { template: 'klasik' as const, accent: null, logoId: null, brandFooter: false };
      const draft = fixtureInvoice({ appearance: look });
      saveDraft(storage, draft);
      const stored = storage.getItem(DRAFT_KEY);
      // The older Invoo reads a draft without its look and stores it so with the next keystroke, ...
      storage.setItem(PREVIOUS_DRAFT_KEY, olderDraft('2026-09-006'));
      expect(loadDraft(storage)).toEqual(draft);
      // ... and removes its draft key with every invoice it saves.
      storage.removeItem(PREVIOUS_DRAFT_KEY);
      expect(loadDraft(storage)).toEqual(draft);
      expect(storage.getItem(DRAFT_KEY)).toBe(stored);
    }
  });

  it('leaves the previous draft where it is when a draft is stored, and takes it along when one is discarded', () => {
    const before = olderDraft('2026-09-005');
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before });
    const edited = { ...fixtureInvoice({ number: '2026-09-005' }), note: 'Děkujeme.' };
    expect(saveDraft(storage, edited)).toBe(true);
    expect(loadDraft(storage)).toEqual(edited);
    expect(storage.getItem(PREVIOUS_DRAFT_KEY)).toBe(before);

    // Discarded, it must not come back from the previous key as the next new invoice.
    expect(saveDraft(storage, null)).toBe(true);
    expect(loadDraft(storage)).toBeNull();
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2 });
  });

  it('keeps the previous draft when the new one cannot be stored', () => {
    const before = olderDraft('2026-09-005');
    const storage = holding({ [PREVIOUS_DRAFT_KEY]: before });
    storage.failingKeys.add(DRAFT_KEY);
    expect(saveDraft(storage, fixtureInvoice())).toBe(false);
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DRAFT_KEY]: before });
  });

  it('moves with the data: the draft of before stays the new invoice after the first stored write', () => {
    const before = olderDraft('2026-09-005');
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before });
    expect(writeDataText(storage, V3, V2)).toBe(true);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3, [DRAFT_KEY]: before, [PREVIOUS_DRAFT_KEY]: before });
    expect(loadDraft(storage)).toEqual(fixtureInvoice({ number: '2026-09-005' }));

    // Also when the previous text had to make room first, and never over a draft of this version.
    const tight = new QuotaStorage(DATA_KEY.length + V3.length + 2 * (DRAFT_KEY.length + before.length) + 10);
    holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before }, tight);
    expect(writeDataText(tight, V3, V2)).toBe(true);
    expect(tight.getItem(DRAFT_KEY)).toBe(before);
    const own = holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before });
    saveDraft(own, fixtureInvoice({ number: '2026-09-007' }));
    expect(writeDataText(own, V3, V2)).toBe(true);
    expect(loadDraft(own)?.number).toBe('2026-09-007');
  });

  it('is moved instead of copied when the browser has room for one draft only', () => {
    const before = olderDraft('2026-09-005');
    const oneDraft = DRAFT_KEY.length + before.length;
    // The previous data make room first, then the data fit next to one copy of the draft, never two.
    const tight = new QuotaStorage(DATA_KEY.length + V3.length + oneDraft + 10);
    holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before }, tight);
    expect(writeDataText(tight, V3, V2)).toBe(true);
    expect(snapshot(tight)).toEqual({ [DATA_KEY]: V3, [DRAFT_KEY]: before });
    expect(loadDraft(tight)).toEqual(fixtureInvoice({ number: '2026-09-005' }));

    // The same on a start that stores the first data itself, with nothing to make room.
    const first = JSON.stringify(emptyAppData());
    const start = new QuotaStorage(DATA_KEY.length + first.length + oneDraft + 10);
    holding({ [PREVIOUS_DRAFT_KEY]: before }, start);
    expect(loadAppData(start).storedText).toBe(first);
    expect(snapshot(start)).toEqual({ [DATA_KEY]: first, [DRAFT_KEY]: before });
    expect(loadDraft(start)).toEqual(fixtureInvoice({ number: '2026-09-005' }));
  });

  it('stays under the previous key, unchanged, when the browser refuses the draft key altogether', () => {
    const before = olderDraft('2026-09-005');
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before });
    storage.failingKeys.add(DRAFT_KEY);
    expect(writeDataText(storage, V3, V2)).toBe(true);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3, [PREVIOUS_DRAFT_KEY]: before });
  });

  it('is not put back over a draft an older Invoo stored while the previous draft key was empty', () => {
    const before = olderDraft('2026-09-005');
    const since = olderDraft('2026-09-006');
    class OlderTabDrafting extends MemoryStorage {
      override removeItem(key: string): void {
        super.removeItem(key);
        if (key === PREVIOUS_DRAFT_KEY) super.setItem(PREVIOUS_DRAFT_KEY, since);
      }
    }
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before }, new OlderTabDrafting());
    storage.failingKeys.add(DRAFT_KEY);
    expect(writeDataText(storage, V3, V2)).toBe(true);
    expect(snapshot(storage)).toEqual({ [DATA_KEY]: V3, [PREVIOUS_DRAFT_KEY]: since });
  });

  it('is not carried when the data could not be stored: the previous draft is still read', () => {
    const before = olderDraft('2026-09-005');
    const storage = holding({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before });
    storage.failingKeys.add(DATA_KEY);
    expect(writeDataText(storage, V3, V2)).toBe(false);
    expect(snapshot(storage)).toEqual({ [PREVIOUS_DATA_KEY]: V2, [PREVIOUS_DRAFT_KEY]: before });
    expect(loadDraft(storage)?.number).toBe('2026-09-005');
  });

  it('ignores what an older Invoo opened after the move leaves under the previous draft key', () => {
    // That Invoo finds its data key empty, migrates the Invokit data again and its last invoice as a draft.
    const storage = holding({ [DATA_KEY]: V3, [LEGACY_DATA_KEY]: v1Data });
    storage.setItem(PREVIOUS_DATA_KEY, olderAppData(emptyAppData()));
    storage.setItem(PREVIOUS_DRAFT_KEY, olderDraft('2026-09-001'));
    expect(loadDraft(storage)).toBeNull();
    // Nothing of that tab is touched either, whatever this version does with its own draft.
    const before = snapshot(storage);
    saveDraft(storage, fixtureInvoice({ number: '2026-09-008' }));
    saveDraft(storage, null);
    expect(snapshot(storage)).toEqual(before);
    expect(loadDraft(storage)).toBeNull();
  });

  it('is carried from the previous key by a start that stores the first data itself', () => {
    const before = olderDraft('2026-09-005');
    const storage = holding({ [PREVIOUS_DRAFT_KEY]: before });
    loadAppData(storage);
    expect(storage.getItem(DATA_KEY)).not.toBeNull();
    expect(loadDraft(storage)).toEqual(fixtureInvoice({ number: '2026-09-005' }));
  });
});

describe('openStorage', () => {
  it('uses localStorage when it can be read', () => {
    const storage = new MemoryStorage();
    expect(openStorage(() => storage)).toEqual({ storage, persistent: true });
  });

  it('falls back to memory when the browser blocks storage', () => {
    const opened = openStorage(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    expect(opened.persistent).toBe(false);
    opened.storage.setItem(DATA_KEY, '{}');
    expect(loadAppData(opened.storage).recovered).toBe(true);
  });
});

describe('readStoredChange', () => {
  it('tells readable data (older versions migrated), a newer schema and unreadable text apart', () => {
    expect(readStoredChange(V3)).toEqual({ kind: 'data', data: withInvoice });
    // An older Invoo's data comes migrated: the default look, no logos.
    expect(readStoredChange(V2)).toEqual({ kind: 'data', data: withInvoice });
    const fromV1 = readStoredChange(v1Data);
    expect(fromV1.kind === 'data' && fromV1.data.invoices.map((i) => i.number)).toEqual(['2026-09-001']);
    expect(readStoredChange(NEWER)).toEqual({ kind: 'newer' });
    expect(readStoredChange('{"version":4}')).toEqual({ kind: 'newer' });
    expect(readStoredChange('{"version":3.5}')).toEqual({ kind: 'newer' });
    expect(readStoredChange('{"version":"4"}')).toEqual({ kind: 'unreadable' });
    expect(readStoredChange('{"version":2}')).toEqual({ kind: 'unreadable' });
    expect(readStoredChange('{"version":2,"invoices":"broken"}')).toEqual({ kind: 'unreadable' });
    expect(readStoredChange(CORRUPT)).toEqual({ kind: 'unreadable' });
    expect(readStoredChange('{"version":3,"invoices":"broken"}')).toEqual({ kind: 'unreadable' });
    expect(readStoredChange('{"version":0}')).toEqual({ kind: 'unreadable' });
    expect(readStoredChange('null')).toEqual({ kind: 'unreadable' });
  });
});
