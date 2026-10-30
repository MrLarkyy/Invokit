import type { Invoice, InvoiceItem } from './invoice';
import { lineTotalCents } from './money';

/** Items that would show on the invoice: an empty trailing row is ignored. */
export function filledItems(invoice: Invoice): InvoiceItem[] {
  return invoice.items.filter((item) => item.description.trim() || item.unitPrice.trim());
}

export function invoiceTotalCents(invoice: Invoice): number {
  return filledItems(invoice).reduce((sum, item) => sum + lineTotalCents(item.quantity, item.unitPrice), 0);
}
