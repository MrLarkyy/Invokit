import { describe, expect, it } from 'vitest';
import { computeTotals } from '../domain/invoiceTotals';
import { parseAppData } from './appDataSchema';
import type { AppDataV1, InvoiceItemV1, PartyV1, SavedInvoiceV1 } from './appDataV1';
import { migrateDraftV1, migrateV1 } from './migrateV1';

// Invented data in the v1 shape, as Invokit stored it.
const supplierV1: PartyV1 = {
  name: 'Ukázka s.r.o.',
  street: 'Vymyšlená 1',
  city: '110 00 Praha 1',
  ico: '27410587',
  dic: '',
};
const customerV1: PartyV1 = { name: 'Odběratel Test a.s.', street: 'Testovací 5', city: 'Brno', ico: '', dic: '' };

function invoiceV1(number: string, items: InvoiceItemV1[], extra: Partial<SavedInvoiceV1> = {}): SavedInvoiceV1 {
  return {
    number,
    issueDate: '2026-09-02',
    dueDate: '2026-09-16',
    variableSymbol: number.replace(/\D/g, ''),
    bankAccount: '19-2000145399/0800',
    paymentMethod: 'Převodem',
    supplier: supplierV1,
    vatPayer: false,
    registryNote: 'Smyšlený zápis.',
    customer: customerV1,
    items,
    savedAt: '2026-09-02T10:00:00Z',
    paid: false,
    ...extra,
  };
}

const dataV1 = (invoices: SavedInvoiceV1[], extra: Partial<AppDataV1> = {}): AppDataV1 => ({
  version: 1,
  customers: [customerV1],
  items: [],
  invoices,
  ...extra,
});

// The v1 total: float quantity × haléře rounded per line (money.ts before INV-6).
const v1Number = (text: string) => Number(text.replace(/\s/g, '').replace(',', '.'));
const v1Total = (items: InvoiceItemV1[]) =>
  items.reduce((sum, i) => sum + Math.round(v1Number(i.quantity) * Math.round(v1Number(i.unitPrice) * 100)), 0);

describe('migrateV1', () => {
  const quantities = ['1', '1,5', '0,333', '1,005', '10'];
  const prices = ['800', '0,1', '0,125', '333,33', '1 000 000', '1'];

  it('keeps every issued total over a grid of quantities and prices', () => {
    const invoices = quantities.map((q, n) =>
      invoiceV1(
        `2026-09-00${n + 1}`,
        prices.map((p) => ({ quantity: q, unit: 'ks', description: `${q} × ${p}`, unitPrice: p })),
      ),
    );
    const migrated = migrateV1(dataV1(invoices));
    migrated.invoices.forEach((invoice, n) => {
      expect(computeTotals(invoice.items, invoice.supplier.vatPayer).totalCents).toBe(v1Total(invoices[n]!.items));
      expect(invoice.items.every((item) => item.vatRate === 0)).toBe(true);
    });
  });

  it('keeps the v1 line total only where exact arithmetic differs', () => {
    const migrated = migrateV1(
      dataV1([
        invoiceV1('2026-09-001', [
          { quantity: '1,005', unit: 'ks', description: 'float', unitPrice: '1' },
          { quantity: '10', unit: 'h', description: 'exact', unitPrice: '800' },
        ]),
      ]),
    );
    const [float, exact] = migrated.invoices[0]!.items;
    expect(float).toMatchObject({ quantity: '1.005', unitPriceCents: 100, legacyLineCents: 100 });
    expect(exact).toMatchObject({ quantity: '10', unitPriceCents: 80_000 });
    expect(exact?.legacyLineCents).toBeUndefined();
  });

  it('keeps paid without inventing a payment date and splits the PSČ', () => {
    const migrated = migrateV1(dataV1([invoiceV1('2026-09-001', [], { paid: true })]));
    const invoice = migrated.invoices[0]!;
    expect(invoice).toMatchObject({ paid: true, paidAt: null, taxableSupplyDate: '2026-09-02', showQr: true });
    expect(invoice.supplier.party).toMatchObject({ zip: '110 00', city: 'Praha 1' });
    expect(invoice.customer).toMatchObject({ zip: '', city: 'Brno' });
    expect(invoice.supplier).toMatchObject({ bankAccount: '19-2000145399/0800', registryNote: 'Smyšlený zápis.' });
  });

  it('takes the profile from v1, else from the newest invoice', () => {
    const withProfile = migrateV1(
      dataV1([], {
        supplier: {
          supplier: supplierV1,
          vatPayer: true,
          registryNote: '',
          bankAccount: '1234567899/0100',
          paymentMethod: '',
        },
      }),
    );
    expect(withProfile.supplier).toMatchObject({ vatPayer: true, accountNumber: '1234567899', bankCode: '0100' });
    const older = invoiceV1('2026-09-001', [], { supplier: { ...supplierV1, name: 'Starší' } });
    const newer = invoiceV1('2026-09-002', [], { supplier: { ...supplierV1, name: 'Novější' } });
    expect(migrateV1(dataV1([newer, older])).supplier?.party.name).toBe('Novější');
  });

  it('keeps an unparseable account on the invoices and leaves the profile account empty', () => {
    const migrated = migrateV1(dataV1([invoiceV1('2026-09-001', [], { bankAccount: 'u Fio, číslo doplním' })]));
    expect(migrated.invoices[0]?.supplier.bankAccount).toBe('u Fio, číslo doplním');
    expect(migrated.supplier).toMatchObject({ accountPrefix: '', accountNumber: '', bankCode: '' });
  });

  it('gives unique ids to numbers that slug the same', () => {
    const migrated = migrateV1(dataV1([invoiceV1('2026/09/001', []), invoiceV1('2026-09-001', [])]));
    expect(migrated.invoices.map((i) => i.id)).toEqual(['2026-09-001', '2026-09-001-2']);
  });

  it('migrates the catalog with the v1 price rounding', () => {
    const migrated = migrateV1(
      dataV1([], { items: [{ quantity: '1', unit: 'h', description: 'Konzultace', unitPrice: '0,125' }] }),
    );
    expect(migrated.items).toEqual([{ description: 'Konzultace', unit: 'h', unitPriceCents: 13, vatRate: 0 }]);
  });

  it('migrates the unsaved v1 draft with an id no saved invoice holds', () => {
    const draft = invoiceV1('2026-09-001', [{ quantity: '2', unit: 'ks', description: 'Kus', unitPrice: '50' }]);
    const migrated = migrateDraftV1(draft, new Set(['2026-09-001']));
    expect(migrated).toMatchObject({ id: '2026-09-001-2', paid: false, savedAt: '' });
    expect(computeTotals(migrated.items, false).totalCents).toBe(10_000);
  });

  it('turns a v1 backup file into valid v2 data', () => {
    const file = JSON.stringify(
      dataV1([invoiceV1('2026-09-001', [{ quantity: '1', unit: 'ks', description: 'A', unitPrice: '1' }])]),
    );
    const data = parseAppData(file);
    expect(data.version).toBe(2);
    expect(data.invoices[0]?.number).toBe('2026-09-001');
  });
});
