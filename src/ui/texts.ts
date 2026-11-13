import { formatCzechDate } from '../domain/dates';
import type { Invoice } from '../domain/invoice';
import { daysToDue, type InvoiceStatus } from '../domain/invoiceStatus';
import { czechPlural, DAYS } from './czechPlural';

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Zaplaceno',
  pending: 'Čeká na platbu',
  overdue: 'Po splatnosti',
};

/** "splatná za 3 dny", "2 dny po splatnosti", "zaplaceno 10. 09. 2026" (the date only when it is known). */
export function dueLabel(invoice: Invoice, today: string): string {
  if (invoice.paid) return invoice.paidAt ? `zaplaceno ${formatCzechDate(invoice.paidAt)}` : 'zaplaceno';
  if (!invoice.dueDate) return 'bez data splatnosti';
  const days = daysToDue(invoice, today);
  if (days === 0) return 'splatná dnes';
  if (days > 0) return `splatná za ${czechPlural(days, DAYS)}`;
  return `${czechPlural(-days, DAYS)} po splatnosti`;
}
