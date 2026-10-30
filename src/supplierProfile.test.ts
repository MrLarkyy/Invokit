import { describe, expect, it } from 'vitest';
import { emptyAppData } from './appData';
import type { Invoice } from './invoice';
import { newInvoice } from './newInvoice';
import { saveInvoice } from './records';
import { prefillSupplier, savedProfile } from './supplierProfile';

function issued(number: string, supplierName: string): Invoice {
  const invoice = newInvoice(null, '2026-09-02');
  invoice.number = number;
  invoice.supplier = { name: supplierName, street: 'Náměstí 1', city: '100 00 Praha', ico: '12345678', dic: '' };
  invoice.bankAccount = '1234567899/0100';
  invoice.registryNote = 'Poznámka';
  return invoice;
}

describe('supplier profile', () => {
  it('is remembered when an invoice is saved and prefills an empty draft', () => {
    const data = saveInvoice(emptyAppData(), issued('2026-09-001', 'Jan Novák'), 'a');
    const draft = newInvoice(null, '2026-10-30');
    expect(prefillSupplier(draft, savedProfile(data))).toBe(true);
    expect(draft.supplier.name).toBe('Jan Novák');
    expect(draft.bankAccount).toBe('1234567899/0100');
    expect(draft.registryNote).toBe('Poznámka');
  });

  it('falls back to the newest invoice when a backup has no profile', () => {
    let data = saveInvoice(emptyAppData(), issued('2026-09-001', 'Old'), 'a');
    data = saveInvoice(data, issued('2026-09-002', 'New'), 'b');
    delete data.supplier;
    expect(savedProfile(data)?.supplier.name).toBe('New');
    expect(savedProfile(emptyAppData())).toBeNull();
  });

  it('never overwrites a supplier the draft already has', () => {
    const data = saveInvoice(emptyAppData(), issued('2026-09-001', 'Saved'), 'a');
    const draft = issued('2026-10-001', 'Typed');
    expect(prefillSupplier(draft, savedProfile(data))).toBe(false);
    expect(draft.supplier.name).toBe('Typed');
  });

  it('is a copy: editing the draft does not change the remembered profile', () => {
    const data = saveInvoice(emptyAppData(), issued('2026-09-001', 'Saved'), 'a');
    const draft = newInvoice(null, '2026-10-30');
    prefillSupplier(draft, savedProfile(data));
    draft.supplier.name = 'Changed';
    expect(savedProfile(data)?.supplier.name).toBe('Saved');
  });
});
