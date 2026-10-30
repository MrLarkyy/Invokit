import { describe, expect, it } from 'vitest';
import { emptyAppData } from './appData';
import type { Invoice } from './invoice';
import { latestNumber, saveInvoice } from './records';

function invoice(number: string, customer = 'Acme s.r.o.', ico = '12345678'): Invoice {
  return {
    number,
    issueDate: '2026-09-02',
    dueDate: '2026-09-16',
    variableSymbol: number.replace(/\D/g, ''),
    bankAccount: '1234567899/0100',
    paymentMethod: 'Převodem',
    supplier: { name: 'Dodavatel', street: '', city: '', ico: '1', dic: '' },
    vatPayer: false,
    registryNote: '',
    customer: { name: customer, street: 'Ulice 1', city: 'Praha', ico, dic: '' },
    items: [
      { quantity: '10', unit: 'h', description: 'Vývoj', unitPrice: '800' },
      { quantity: '1', unit: 'ks', description: '', unitPrice: '' },
    ],
  };
}

describe('saveInvoice', () => {
  it('stores the invoice without empty rows and remembers its customer and items', () => {
    const data = saveInvoice(emptyAppData(), invoice('2026-09-001'), '2026-09-02T10:00:00Z');
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0]?.items).toHaveLength(1);
    expect(data.invoices[0]?.paid).toBe(false);
    expect(data.customers.map((c) => c.name)).toEqual(['Acme s.r.o.']);
    expect(data.items).toEqual([{ quantity: '1', unit: 'h', description: 'Vývoj', unitPrice: '800' }]);
  });

  it('updates an invoice with the same number and keeps its paid flag', () => {
    let data = saveInvoice(emptyAppData(), invoice('2026-09-001'), 'a');
    data = { ...data, invoices: data.invoices.map((i) => ({ ...i, paid: true })) };
    const changed = invoice('2026-09-001');
    changed.items[0]!.unitPrice = '900';
    data = saveInvoice(data, changed, 'b');
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0]?.paid).toBe(true);
    expect(data.invoices[0]?.items[0]?.unitPrice).toBe('900');
    expect(data.items[0]?.unitPrice).toBe('900');
  });

  it('keeps one customer per IČO and lists invoices newest first', () => {
    let data = saveInvoice(emptyAppData(), invoice('2026-09-001'), 'a');
    data = saveInvoice(data, invoice('2026-09-002', 'Acme a.s.'), 'b');
    data = saveInvoice(data, invoice('2026-09-003', 'Beta', '87654321'), 'c');
    expect(data.customers.map((c) => c.name)).toEqual(['Acme a.s.', 'Beta']);
    expect(data.invoices.map((i) => i.number)).toEqual(['2026-09-003', '2026-09-002', '2026-09-001']);
  });

  it('does not let a later edit of the draft change the saved copy', () => {
    const draft = invoice('2026-09-001');
    const data = saveInvoice(emptyAppData(), draft, 'a');
    draft.customer.name = 'Changed';
    expect(data.invoices[0]?.customer.name).toBe('Acme s.r.o.');
    expect(data.customers[0]?.name).toBe('Acme s.r.o.');
  });
});

describe('latestNumber', () => {
  it('returns the highest of the history and the fallback', () => {
    const data = saveInvoice(emptyAppData(), invoice('2026-09-004'), 'a');
    expect(latestNumber(data, '2026-09-001')).toBe('2026-09-004');
    expect(latestNumber(data, '2026-10-001')).toBe('2026-10-001');
  });
});
