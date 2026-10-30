import type { SavedInvoice } from './appData';
import { invoiceTotalCents } from './invoiceTotal';

export interface MonthTotal {
  month: string; // "2026-09"
  cents: number;
}

export interface CustomerTotal {
  name: string;
  cents: number;
  count: number;
}

export interface InvoiceStats {
  yearCents: number;
  yearCount: number;
  unpaidCents: number;
  unpaidCount: number;
  overdueCount: number;
  months: MonthTotal[];
  customers: CustomerTotal[];
}

function lastMonths(today: string, count: number): string[] {
  const [y = 0, m = 1] = today.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

/** Totals by issue date; the year is the calendar year of today. */
export function invoiceStats(invoices: SavedInvoice[], today: string): InvoiceStats {
  const year = today.slice(0, 4);
  const months = lastMonths(today, 12).map((month) => ({ month, cents: 0 }));
  const byCustomer = new Map<string, CustomerTotal>();
  const stats: InvoiceStats = {
    yearCents: 0,
    yearCount: 0,
    unpaidCents: 0,
    unpaidCount: 0,
    overdueCount: 0,
    months,
    customers: [],
  };
  for (const invoice of invoices) {
    const cents = invoiceTotalCents(invoice);
    if (invoice.issueDate.startsWith(year)) {
      stats.yearCents += cents;
      stats.yearCount += 1;
    }
    if (!invoice.paid) {
      stats.unpaidCents += cents;
      stats.unpaidCount += 1;
      if (invoice.dueDate && invoice.dueDate < today) stats.overdueCount += 1;
    }
    const month = months.find((m) => m.month === invoice.issueDate.slice(0, 7));
    if (month) month.cents += cents;
    const key = invoice.customer.ico.trim() || invoice.customer.name.trim().toLowerCase();
    const entry = byCustomer.get(key) ?? { name: invoice.customer.name, cents: 0, count: 0 };
    entry.cents += cents;
    entry.count += 1;
    byCustomer.set(key, entry);
  }
  stats.customers = [...byCustomer.values()].sort((a, b) => b.cents - a.cents);
  return stats;
}
