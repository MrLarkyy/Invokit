import { describe, expect, it } from 'vitest';
import { fixtureInvoice } from '../test/invoiceFixture';
import { emptyAppData } from './appData';
import {
  BROKEN_DATA_KEY,
  DATA_KEY,
  DRAFT_KEY,
  LEGACY_DATA_KEY,
  LEGACY_DRAFT_KEY,
  loadAppData,
  loadDraft,
  saveAppData,
  saveDraft,
} from './appDataStorage';

class MemoryStorage implements Storage {
  [name: string]: unknown;
  private readonly values = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.values.set(key, value);
  }
}

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

describe('loadAppData', () => {
  it('starts empty on first use, with no invented invoices', () => {
    const storage = new MemoryStorage();
    expect(loadAppData(storage)).toEqual({ data: emptyAppData(), recovered: false });
  });

  it('migrates v1 data once and leaves the v1 key in place', () => {
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

  it('copies corrupt v2 data aside and starts empty with the recovered flag', () => {
    const storage = new MemoryStorage();
    storage.setItem(DATA_KEY, '{"version":2,"invoices":"broken"');
    const loaded = loadAppData(storage);
    expect(loaded).toEqual({ data: emptyAppData(), recovered: true });
    expect(storage.getItem(BROKEN_DATA_KEY)).toBe('{"version":2,"invoices":"broken"');
    expect(storage.getItem(DATA_KEY)).toBe('{"version":2,"invoices":"broken"');
  });

  it('migrates the v1 draft together with the data', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_DATA_KEY, v1Data);
    storage.setItem(LEGACY_DRAFT_KEY, JSON.stringify({ ...v1Invoice, number: '2026-09-002' }));
    loadAppData(storage);
    expect(loadDraft(storage)?.number).toBe('2026-09-002');
    saveDraft(storage, null);
    loadAppData(storage);
    expect(loadDraft(storage)).toBeNull();
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
