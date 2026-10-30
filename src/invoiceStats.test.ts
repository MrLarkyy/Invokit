import { describe, expect, it } from 'vitest';
import type { SavedInvoice } from './appData';
import { invoiceStats } from './invoiceStats';

function saved(issueDate: string, dueDate: string, price: string, paid: boolean, customer: string): SavedInvoice {
  return {
    number: issueDate,
    issueDate,
    dueDate,
    variableSymbol: '',
    bankAccount: '',
    paymentMethod: '',
    supplier: { name: '', street: '', city: '', ico: '', dic: '' },
    vatPayer: false,
    registryNote: '',
    customer: { name: customer, street: '', city: '', ico: '', dic: '' },
    items: [{ quantity: '1', unit: 'ks', description: 'x', unitPrice: price }],
    savedAt: '',
    paid,
  };
}

describe('invoiceStats', () => {
  const invoices = [
    saved('2026-09-02', '2026-09-16', '1000,50', true, 'Acme'),
    saved('2026-10-01', '2026-10-15', '2000', false, 'Acme'),
    saved('2026-10-20', '2026-11-03', '500', false, 'Beta'),
    saved('2025-12-10', '2025-12-24', '300', true, 'Beta'),
    saved('2024-01-10', '2024-01-24', '99', true, 'Old'),
  ];
  const stats = invoiceStats(invoices, '2026-10-30');

  it('sums the current year and the unpaid invoices in haléře', () => {
    expect(stats.yearCents).toBe(350_050);
    expect(stats.yearCount).toBe(3);
    expect(stats.unpaidCents).toBe(250_000);
    expect(stats.unpaidCount).toBe(2);
    expect(stats.overdueCount).toBe(1);
  });

  it('buckets the last 12 months ending with the current one', () => {
    expect(stats.months).toHaveLength(12);
    expect(stats.months[0]?.month).toBe('2025-11');
    expect(stats.months[11]).toEqual({ month: '2026-10', cents: 250_000 });
    expect(stats.months.find((m) => m.month === '2025-12')?.cents).toBe(30_000);
  });

  it('ranks customers by total over all time', () => {
    expect(stats.customers.map((c) => [c.name, c.cents, c.count])).toEqual([
      ['Acme', 300_050, 2],
      ['Beta', 80_000, 2],
      ['Old', 9_900, 1],
    ]);
  });
});
