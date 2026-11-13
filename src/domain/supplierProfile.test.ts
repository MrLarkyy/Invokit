import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../storage/appData';
import { fixtureInvoice, fixtureProfile } from '../test/invoiceFixture';
import { createBlankInvoice, duplicateInvoice } from './newInvoice';
import { saveInvoice } from './records';
import { profileFromSnapshot, savedProfile, snapshotOf } from './supplierProfile';

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
