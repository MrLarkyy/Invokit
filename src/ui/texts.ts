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

/**
 * Said instead of "saved" after a change that did not reach the browser storage (saving off, write refused,
 * storage blocked): "Neuloženo: faktura 2026-09-001 zůstane jen do zavření stránky."
 */
export function notStored(what: string): string {
  return `Neuloženo: ${what} jen do zavření stránky.`;
}

/** A success message may stand alone only when the change is stored; otherwise it says that it is not. */
export function withStoredNote(message: string, stored: boolean): string {
  return stored ? message : `${message} ${notStored('změna platí')}`;
}
