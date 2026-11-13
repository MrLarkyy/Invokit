import { describe, expect, it } from 'vitest';
import { fixtureInvoice } from '../test/invoiceFixture';
import { emptyAppData } from './appData';
import {
  BROKEN_DATA_KEY,
  DATA_KEY,
  DRAFT_KEY,
  hasLegacyData,
  LEGACY_DATA_KEY,
  LEGACY_DRAFT_KEY,
  loadAppData,
  loadDraft,
  removeLegacyData,
  saveAppData,
  saveDraft,
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

describe('loadAppData', () => {
  it('starts empty on first use, with no invented invoices', () => {
    const loaded = loadAppData(new MemoryStorage());
    expect(loaded.data).toEqual(emptyAppData());
    expect(loaded).toMatchObject({ recovered: false, readOnly: false, legacyBlocking: false });
  });

  it('migrates v1 data and leaves the v1 key in place', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    const { data } = loadAppData(storage);
    expect(data.invoices.map((i) => i.number)).toEqual(['2026-09-001']);
    expect(storage.getItem(LEGACY_DATA_KEY)).toBe(v1Data);
    expect(storage.getItem(DATA_KEY)).toBe(JSON.stringify(data));
  });

  it('prefers v2 data when both exist', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(DATA_KEY, JSON.stringify(emptyAppData()));
    expect(loadAppData(storage).data.invoices).toEqual([]);
  });

  it('keeps corrupt v2 data aside and offers it for download', () => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, CORRUPT);
    const loaded = loadAppData(storage);
    expect(loaded).toMatchObject({ recovered: true, readOnly: false, unreadableText: CORRUPT });
    expect(loaded.data).toEqual(emptyAppData());
    expect(storage.getItem(BROKEN_DATA_KEY)).toBe(CORRUPT);
    expect(storage.getItem(DATA_KEY)).toBe(CORRUPT);
  });

  it('never overwrites an older copy: then this session writes nothing', () => {
    const storage = new MemoryStorage();
    storage.setItem(BROKEN_DATA_KEY, 'first corruption');
    storage.setItem(DATA_KEY, CORRUPT);
    expect(loadAppData(storage)).toMatchObject({ recovered: true, readOnly: true, unreadableText: CORRUPT });
    expect(storage.getItem(BROKEN_DATA_KEY)).toBe('first corruption');
  });

  it('writes nothing this session when the copy cannot be stored', () => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, CORRUPT);
    storage.failingKeys.add(BROKEN_DATA_KEY);
    expect(loadAppData(storage)).toMatchObject({ recovered: true, readOnly: true });
    expect(storage.getItem(BROKEN_DATA_KEY)).toBeNull();
  });

  it('migrates an unsaved v1 draft together with the data', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify({ ...v1Invoice, number: '2026-09-002' }));
    loadAppData(storage);
    expect(loadDraft(storage)?.number).toBe('2026-09-002');
  });

  it('skips a v1 draft that is an invoice already saved (Invokit kept the last printed one)', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify(v1Invoice));
    loadAppData(storage);
    expect(loadDraft(storage)).toBeNull();
  });

  it('reports Invokit data that does not fit as v2, and removes the old keys on request', () => {
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

describe('saveAppData and the draft', () => {
  it('reports a refused write', () => {
    const storage = new MemoryStorage();
    expect(saveAppData(storage, emptyAppData())).toBe(true);
    storage.failWrites = true;
    expect(saveAppData(storage, emptyAppData())).toBe(false);
    expect(saveDraft(storage, fixtureInvoice())).toBe(false);
  });

  it('round-trips the draft', () => {
    const storage = new MemoryStorage();
    const draft = fixtureInvoice();
    saveDraft(storage, draft);
    expect(loadDraft(storage)).toEqual(draft);
    expect(storage.getItem(DRAFT_KEY)).not.toBeNull();
    saveDraft(storage, null);
    expect(loadDraft(storage)).toBeNull();
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
