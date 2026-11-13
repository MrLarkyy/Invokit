import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../storage/appData';
import { fixtureInvoice, fixtureItem, fixtureProfile } from '../test/invoiceFixture';
import type { SupplierSnapshot } from './invoice';
import { computeTotals } from './invoiceTotals';
import { isCompleteSupplier } from './invoiceValidation';
import { createBlankInvoice, duplicateInvoice, refreshDraft } from './newInvoice';
import { saveInvoice } from './records';
import { completeSupplierSnapshot, profileFromSnapshot, savedProfile, snapshotOf } from './supplierProfile';

let rowId = 0;
const newId = () => `r${++rowId}`;

describe('supplier profile', () => {
  it('is copied into a new invoice as a snapshot', () => {
    const profile = fixtureProfile({ vatPayer: true });
    const blank = createBlankInvoice({ invoices: [], supplier: profile }, '2026-10-30', newId);
    expect(blank.supplier).toEqual(snapshotOf(profile));
    expect(blank.supplier.bankAccount).toBe('19-2000145399/0800');
    expect(blank.items[0]?.vatRate).toBe(21);
    profile.party.name = 'Changed';
    expect(blank.supplier.party.name).toBe('Ukázka s.r.o.');
  });

  it('falls back to the newest invoice when none was saved', () => {
    let data = saveInvoice(emptyAppData(), fixtureInvoice({ id: 'a', number: '2026-09-001' }), 'a');
    const newer = fixtureInvoice({ id: 'b', number: '2026-09-002' });
    newer.supplier = { ...newer.supplier, party: { ...newer.supplier.party, name: 'Novější' } };
    data = saveInvoice(data, newer, 'b');
    expect(savedProfile(data)?.party.name).toBe('Novější');
    expect(savedProfile(data)?.accountNumber).toBe('2000145399');
    expect(savedProfile(emptyAppData())).toBeNull();
  });

  it('leaves the account fields empty when the invoice account does not parse', () => {
    const snapshot = { ...fixtureInvoice().supplier, bankAccount: 'IBAN CZ65 nevím' };
    expect(profileFromSnapshot(snapshot)).toMatchObject({ accountPrefix: '', accountNumber: '', bankCode: '' });
  });

  it('gives an empty non-payer supplier without a profile', () => {
    expect(snapshotOf(null)).toMatchObject({ vatPayer: false, bankAccount: '', party: { name: '' } });
  });
});

describe('completeSupplierSnapshot', () => {
  // As migrated from Invokit: a non-payer's invoice saved with a name and an account only.
  const migrated = (): SupplierSnapshot => ({
    party: { name: 'Ukázka s.r.o.', street: '', city: '', zip: '', ico: '', dic: '' },
    vatPayer: false,
    email: 'stara@ukazka.example',
    registryNote: 'Fyzická osoba zapsaná v živnostenském rejstříku (smyšlený záznam).',
    bankAccount: '19-2000145399/0800',
  });
  const payerProfile = () =>
    fixtureProfile({
      party: {
        name: 'Ukázka Nová s.r.o.',
        street: 'Vymyšlená 1',
        city: 'Praha',
        zip: '110 00',
        ico: '27410587',
        dic: 'CZ27410587',
      },
      vatPayer: true,
      email: 'nova@ukazka.example',
      registryNote: 'Zapsáno v obchodním rejstříku (smyšlený záznam).',
      accountPrefix: '',
      accountNumber: '2000145399',
      bankCode: '0800',
    });

  it('keeps a non-payer invoice a non-payer invoice when the profile is a VAT payer now', () => {
    const issued = migrated();
    const completed = completeSupplierSnapshot(issued, payerProfile());
    expect(completed).toEqual({
      party: { name: 'Ukázka s.r.o.', street: 'Vymyšlená 1', city: 'Praha', zip: '110 00', ico: '27410587', dic: '' },
      vatPayer: false,
      email: 'stara@ukazka.example',
      registryNote: 'Fyzická osoba zapsaná v živnostenském rejstříku (smyšlený záznam).',
      bankAccount: '19-2000145399/0800',
    });
    expect(isCompleteSupplier(completed)).toBe(true);
    expect(issued).toEqual(migrated());

    const items = [fixtureItem('Vývoj', '10', 80_000, 21)];
    expect(computeTotals(items, completed.vatPayer)).toEqual(computeTotals(items, false));
    expect(computeTotals(items, completed.vatPayer)).toMatchObject({ totalCents: 800_000, rates: [] });
  });

  it("fills the missing DIČ of a VAT payer's invoice and keeps its own account", () => {
    const issued: SupplierSnapshot = {
      ...snapshotOf(fixtureProfile({ vatPayer: true })),
      bankAccount: 'IBAN CZ65 nevím',
    };
    expect(isCompleteSupplier(issued)).toBe(false);
    const completed = completeSupplierSnapshot(issued, payerProfile());
    expect(completed.party).toEqual({ ...issued.party, dic: 'CZ27410587' });
    expect(completed).toMatchObject({
      vatPayer: true,
      bankAccount: 'IBAN CZ65 nevím',
      email: '',
      registryNote: issued.registryNote,
    });
    expect(isCompleteSupplier(completed)).toBe(true);
  });

  it('never touches a complete supplier, even one without a postcode', () => {
    const issued = fixtureInvoice().supplier;
    const complete: SupplierSnapshot = { ...issued, party: { ...issued.party, zip: '' } };
    expect(completeSupplierSnapshot(complete, payerProfile())).toBe(complete);
  });

  it('never replaces a filled field, and adds no postcode to a city the invoice already names', () => {
    const partial = migrated();
    partial.party.street = 'Stará 9';
    partial.party.city = 'Brno';
    expect(completeSupplierSnapshot(partial, payerProfile()).party).toEqual({
      name: 'Ukázka s.r.o.',
      street: 'Stará 9',
      city: 'Brno',
      zip: '',
      ico: '27410587',
      dic: '',
    });
  });

  it('returns the supplier as it is when there is no profile or nothing to take from it', () => {
    const issued = migrated();
    expect(completeSupplierSnapshot(issued, null)).toBe(issued);
    const emptyProfile = fixtureProfile({ party: { name: '', street: ' ', city: '', zip: '', ico: '', dic: '' } });
    expect(completeSupplierSnapshot(issued, emptyProfile)).toBe(issued);
    expect(isCompleteSupplier(issued)).toBe(false);
  });
});

describe('new invoices', () => {
  it('continue the number series with the variable symbol and DUZP of the day', () => {
    const history = [fixtureInvoice({ id: '2026-10-004', number: '2026-10-004' })];
    const blank = createBlankInvoice({ invoices: history, supplier: null }, '2026-10-30', newId);
    expect(blank).toMatchObject({
      id: '2026-10-005',
      number: '2026-10-005',
      variableSymbol: '202610005',
      issueDate: '2026-10-30',
      taxableSupplyDate: '2026-10-30',
      dueDate: '2026-11-13',
      paid: false,
    });
  });

  it('duplicate with a new number, the same term and no migrated rounding', () => {
    const source = fixtureInvoice({ dueDate: '2026-09-09', paid: true, paidAt: '2026-09-05' });
    source.items = [{ ...source.items[0]!, legacyLineCents: 1 }];
    const copy = duplicateInvoice(source, { invoices: [source], supplier: null }, '2026-09-20', newId);
    expect(copy).toMatchObject({ number: '2026-09-002', dueDate: '2026-09-27', paid: false, paidAt: null });
    expect(copy.id).not.toBe(source.id);
    expect(copy.items[0]?.legacyLineCents).toBeUndefined();
    expect(copy.items[0]?.id).not.toBe(source.items[0]?.id);
    expect(copy.supplier).toEqual(source.supplier);
  });
});

describe('refreshDraft', () => {
  const saved = fixtureInvoice({ id: '2026-09-001', number: '2026-09-001' });

  it('renumbers a draft whose number was used since, with the automatic variable symbol', () => {
    const draft = fixtureInvoice({ id: 'draft', number: '2026-09-001', variableSymbol: '202609001' });
    expect(refreshDraft(draft, { invoices: [saved], supplier: null }, '2026-09-20')).toMatchObject({
      number: '2026-09-002',
      variableSymbol: '202609002',
    });
  });

  it('keeps a variable symbol the user typed, and a draft whose number is free', () => {
    const typed = fixtureInvoice({ id: 'draft', number: '2026-09-001', variableSymbol: '777' });
    expect(refreshDraft(typed, { invoices: [saved], supplier: null }, '2026-09-20').variableSymbol).toBe('777');
    const free = fixtureInvoice({ id: 'draft', number: '2026-09-005' });
    expect(refreshDraft(free, { invoices: [saved], supplier: null }, '2026-09-20')).toBe(free);
  });
});
