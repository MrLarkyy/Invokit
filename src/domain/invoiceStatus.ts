import { diffDays } from './dates';
import type { Invoice } from './invoice';

export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

export function getStatus(invoice: Invoice, today: string): InvoiceStatus {
  if (invoice.paid) return 'paid';
  return invoice.dueDate !== '' && invoice.dueDate < today ? 'overdue' : 'pending';
}

/** Days until the due date; negative once it has passed. */
export function daysToDue(invoice: Invoice, today: string): number {
  return diffDays(today, invoice.dueDate);
}
