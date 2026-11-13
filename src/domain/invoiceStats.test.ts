import { describe, expect, it } from 'vitest';
import { fixtureInvoice, fixtureItem } from '../test/invoiceFixture';
import type { Invoice } from './invoice';
import { invoiceStats } from './invoiceStats';

function saved(issueDate: string, dueDate: string, priceCents: number, paid: boolean, customer: string): Invoice {
  return fixtureInvoice({
    id: issueDate,
    number: issueDate,
    issueDate,
    dueDate,
    customer: { name: customer, street: '', city: '', zip: '', ico: '', dic: '' },
    items: [fixtureItem('x', '1', priceCents)],
    paid,
  });
}

describe('invoiceStats', () => {
  const invoices = [
    saved('2026-09-02', '2026-09-16', 100_050, true, 'Acme'),
    saved('2026-10-01', '2026-10-15', 200_000, false, 'Acme'),
    saved('2026-10-20', '2026-11-03', 50_000, false, 'Beta'),
    saved('2025-12-10', '2025-12-24', 30_000, true, 'Beta'),
    saved('2024-01-10', '2024-01-24', 9_900, true, 'Old'),
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

  it('counts each invoice with its own supplier VAT status', () => {
    const payer = { ...saved('2026-10-02', '2026-10-16', 10_000, false, 'Acme'), id: 'p', number: 'p' };
    payer.supplier = { ...payer.supplier, vatPayer: true };
    payer.items = [fixtureItem('x', '1', 10_000, 21)];
    expect(invoiceStats([payer], '2026-10-30').yearCents).toBe(12_100);
  });
});
