import { describe, expect, it } from 'vitest';
import { emptyAppData, type AppData } from '../storage/appData';
import { fixtureInvoice, fixtureItem as item, fixtureProfile } from '../test/invoiceFixture';
import { computeTotals } from './invoiceTotals';
import { createBlankInvoice } from './newInvoice';
import { parseAppData } from '../storage/appDataSchema';
import { LIMITS } from './limits';
import {
  deleteCatalogItem,
  deleteCustomer,
  deleteInvoice,
  ID_TAKEN,
  saveInvoice,
  saveProblem,
  setPaid,
} from './records';

const invoice = (number: string, customer = 'Odběratel Test a.s.', ico = '27410587') =>
  fixtureInvoice({
    id: number,
    number,
    customer: { name: customer, street: 'Testovací 5', city: 'Brno', zip: '602 00', ico, dic: '' },
    items: [item('Vývoj', '10', 80_000), item('', '1', 0)],
  });

describe('saveInvoice', () => {
  it('stores the invoice without empty rows and remembers its customer and items', () => {
    const data = saveInvoice(emptyAppData(), invoice('2026-09-001'), '2026-09-02T10:00:00Z');
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0]?.items).toHaveLength(1);
    expect(data.invoices[0]?.paid).toBe(false);
    expect(data.invoices[0]?.savedAt).toBe('2026-09-02T10:00:00Z');
    expect(data.customers.map((c) => c.name)).toEqual(['Odběratel Test a.s.']);
    expect(data.items).toEqual([{ description: 'Vývoj', unit: 'ks', unitPriceCents: 80_000, vatRate: 0 }]);
  });

  it('updates the invoice with the same id and keeps its paid state', () => {
    let data = saveInvoice(emptyAppData(), invoice('2026-09-001'), 'a');
    data = setPaid(data, '2026-09-001', '2026-09-10');
    const changed = invoice('2026-09-001');
    changed.items[0]!.unitPriceCents = 90_000;
    data = saveInvoice(data, changed, 'b');
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0]?.paid).toBe(true);
    expect(data.invoices[0]?.paidAt).toBe('2026-09-10');
    expect(data.invoices[0]?.items[0]?.unitPriceCents).toBe(90_000);
    expect(data.items[0]?.unitPriceCents).toBe(90_000);
  });

  it('puts back an edited invoice that is no longer saved, paid as the edit holds it', () => {
    let data = saveInvoice(emptyAppData(), invoice('2026-09-001'), 'a', true);
    data = setPaid(data, '2026-09-001', '2026-09-10');
    const edited = { ...structuredClone(data.invoices[0]!), note: 'Děkujeme.' };
    const restored = saveInvoice(deleteInvoice(data, '2026-09-001'), edited, 'b', false);
    expect(restored.invoices).toEqual([{ ...edited, savedAt: 'b' }]);
    expect(restored.invoices[0]).toMatchObject({ paid: true, paidAt: '2026-09-10' });
    // Never the other way round: the stored paid state wins over what an open editor still holds.
    const stale = { ...edited, paid: false, paidAt: null };
    expect(saveInvoice(data, stale, 'c', false).invoices[0]).toMatchObject({ paid: true, paidAt: '2026-09-10' });
  });

  it('never stores a new invoice as paid', () => {
    const copy = { ...invoice('2026-09-001'), paid: true, paidAt: '2026-09-10' };
    const data = saveInvoice(emptyAppData(), copy, 'a', true);
    expect(data.invoices[0]).toMatchObject({ paid: false, paidAt: null });
  });

  it('refuses a number another invoice already uses', () => {
    const data = saveInvoice(emptyAppData(), invoice('2026-09-001'), 'a');
    const other = { ...invoice('2026-09-001'), id: 'other' };
    expect(() => saveInvoice(data, other, 'b')).toThrow('Faktura s číslem 2026-09-001 už existuje.');
    expect(() => saveInvoice(data, { ...other, number: ' 2026-09-001 ' }, 'b')).toThrow('už existuje');
  });

  it('keeps one customer per IČO and lists invoices newest first', () => {
    let data = saveInvoice(emptyAppData(), invoice('2026-09-001'), 'a');
    data = saveInvoice(data, invoice('2026-09-002', 'Odběratel Test s.r.o.'), 'b');
    data = saveInvoice(data, invoice('2026-09-003', 'Beta', '00001121'), 'c');
    expect(data.customers.map((c) => c.name)).toEqual(['Beta', 'Odběratel Test s.r.o.']);
    expect(data.invoices.map((i) => i.number)).toEqual(['2026-09-003', '2026-09-002', '2026-09-001']);
  });

  it('stores a copy: a later edit of the draft does not change the saved invoice', () => {
    const draft = invoice('2026-09-001');
    const data = saveInvoice(emptyAppData(), draft, 'a');
    draft.customer.name = 'Changed';
    draft.supplier.party.name = 'Changed';
    expect(data.invoices[0]?.customer.name).toBe('Odběratel Test a.s.');
    expect(data.invoices[0]?.supplier.party.name).toBe('Ukázka s.r.o.');
    expect(data.customers[0]?.name).toBe('Odběratel Test a.s.');
  });

  it('keeps the total of a saved invoice when the profile later becomes a VAT payer', () => {
    let data: AppData = { ...emptyAppData(), supplier: fixtureProfile({ vatPayer: false }) };
    const blank = createBlankInvoice(data, '2026-09-02', () => 'row');
    const issued = { ...blank, customer: invoice('x').customer, items: [item('Vývoj', '1', 10_000, 21)] };
    data = saveInvoice(data, issued, 'a');
    data = { ...data, supplier: fixtureProfile({ vatPayer: true }) };
    const saved = data.invoices[0]!;
    expect(computeTotals(saved.items, saved.supplier.vatPayer).totalCents).toBe(10_000);
  });
});

describe('deleting', () => {
  it('removes an invoice, a customer or a catalog item', () => {
    let data = saveInvoice(emptyAppData(), invoice('2026-09-001'), 'a');
    data = saveInvoice(data, invoice('2026-09-002', 'Beta', '00001121'), 'b');
    data = deleteInvoice(data, '2026-09-001');
    expect(data.invoices.map((i) => i.id)).toEqual(['2026-09-002']);
    data = deleteCustomer(data, { ...data.customers[0]! });
    expect(data.customers.map((c) => c.name)).toEqual(['Odběratel Test a.s.']);
    data = deleteCatalogItem(data, ' vývoj ');
    expect(data.items).toEqual([]);
  });
});

describe('setPaid', () => {
  it('marks paid with a date and unpaid with null', () => {
    let data = saveInvoice(emptyAppData(), invoice('2026-09-001'), 'a');
    data = setPaid(data, '2026-09-001', '2026-09-10');
    expect(data.invoices[0]).toMatchObject({ paid: true, paidAt: '2026-09-10' });
    data = setPaid(data, '2026-09-001', null);
    expect(data.invoices[0]).toMatchObject({ paid: false, paidAt: null });
  });
});

describe('limits of the saved lists', () => {
  const party = (n: number) => ({ name: `Firma ${n}`, street: '', city: '', zip: '', ico: '', dic: '' });

  it('keeps the most recently used customers and items up to the limit', () => {
    const full: AppData = {
      ...emptyAppData(),
      customers: Array.from({ length: LIMITS.customers }, (_, n) => party(n)),
      items: Array.from({ length: LIMITS.catalog }, (_, n) => ({
        description: `Položka ${n}`,
        unit: 'ks',
        unitPriceCents: 100,
        vatRate: 0 as const,
      })),
    };
    const data = saveInvoice(full, invoice('2026-09-001', 'Nová firma', ''), 'a');
    expect(data.customers).toHaveLength(LIMITS.customers);
    expect(data.customers[0]?.name).toBe('Nová firma');
    expect(data.customers.some((c) => c.name === `Firma ${LIMITS.customers - 1}`)).toBe(false);
    expect(data.items).toHaveLength(LIMITS.catalog);
    expect(data.items[0]?.description).toBe('Vývoj');
    expect(() => parseAppData(JSON.stringify(data))).not.toThrow();
  });

  it('refuses the invoice over 10 000 in Czech, and data at the limit loads back', () => {
    const invoices = Array.from({ length: LIMITS.invoices }, (_, n) =>
      fixtureInvoice({ id: `f${n}`, number: `F${n}`, items: [item('x', '1', 100)] }),
    );
    const full: AppData = { ...emptyAppData(), invoices };
    const next = invoice('2026-09-001');
    expect(saveProblem(full, next)).toBe('Invoo pojme nejvýš 10 000 faktur. Stáhni si zálohu a starší faktury smaž.');
    expect(() => saveInvoice(full, next, 'a')).toThrow('nejvýš 10 000 faktur');
    expect(saveProblem(full, { ...invoices[0]!, note: 'úprava' })).toBeNull();
    expect(parseAppData(JSON.stringify(full)).invoices).toHaveLength(LIMITS.invoices);
  });
});

describe('a new invoice next to the saved ones', () => {
  const issued = invoice('2026-09-001');
  const data = saveInvoice(emptyAppData(), issued, 'a', true);

  it('is refused when its number is taken, whatever its id', () => {
    const taken = 'Faktura s číslem 2026-09-001 už existuje.';
    expect(saveProblem(data, { ...issued, note: 'z druhé záložky' }, true)).toBe(taken);
    expect(saveProblem(data, { ...issued, id: 'other' }, true)).toBe(taken);
    expect(() => saveInvoice(data, { ...issued, note: 'z druhé záložky' }, 'b', true)).toThrow(taken);
  });

  it('is refused when only its id is taken: it is another invoice, not an edit of that one', () => {
    const renumbered = { ...issued, number: '2026-09-002' };
    expect(saveProblem(data, renumbered, true)).toBe(ID_TAKEN);
    expect(() => saveInvoice(data, renumbered, 'b', true)).toThrow(ID_TAKEN);
    expect(saveProblem(data, renumbered, false)).toBeNull();
    expect(saveProblem(data, renumbered)).toBeNull();
  });

  it('is saved under a free id and number, and an edit keeps replacing the invoice with its id', () => {
    const second = saveInvoice(data, invoice('2026-09-002'), 'b', true);
    expect(second.invoices.map((i) => i.id)).toEqual(['2026-09-002', '2026-09-001']);
    const edited = saveInvoice(second, { ...issued, note: 'úprava' }, 'c', false);
    expect(edited.invoices.map((i) => i.note)).toEqual(['', 'úprava']);
    expect(saveProblem(second, { ...issued, note: 'úprava' }, false)).toBeNull();
  });
});
