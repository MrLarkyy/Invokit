import type { AppData, SavedInvoice } from './appData';
import type { Invoice, InvoiceItem, Party } from './invoice';
import { filledItems } from './invoiceTotal';
import { profileOf } from './supplierProfile';

const norm = (text: string) => text.trim().toLowerCase();

/** Customers are the same when their IČO matches, or their name when neither has an IČO. */
export function sameParty(a: Party, b: Party): boolean {
  if (a.ico.trim() || b.ico.trim()) return a.ico.trim() === b.ico.trim();
  return norm(a.name) === norm(b.name);
}

function upsertCustomer(customers: Party[], customer: Party): Party[] {
  if (!customer.name.trim()) return customers;
  const rest = customers.filter((c) => !sameParty(c, customer));
  return [...rest, { ...customer }].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

function upsertItems(catalog: InvoiceItem[], items: InvoiceItem[]): InvoiceItem[] {
  const result = [...catalog];
  for (const item of items) {
    if (!item.description.trim()) continue;
    const at = result.findIndex((c) => norm(c.description) === norm(item.description));
    const entry = { ...item, quantity: '1' };
    if (at >= 0) result[at] = entry;
    else result.push(entry);
  }
  return result.sort((a, b) => a.description.localeCompare(b.description, 'cs'));
}

/** Saves the invoice into the history (one record per number) and remembers its customer and items. */
export function saveInvoice(data: AppData, invoice: Invoice, now: string): AppData {
  const previous = data.invoices.find((i) => i.number === invoice.number);
  const saved: SavedInvoice = {
    ...structuredClone(invoice),
    items: filledItems(invoice).map((item) => ({ ...item })),
    savedAt: now,
    paid: previous?.paid ?? false,
  };
  const invoices = [...data.invoices.filter((i) => i.number !== invoice.number), saved].sort((a, b) =>
    b.number.localeCompare(a.number),
  );
  return {
    ...data,
    invoices,
    customers: upsertCustomer(data.customers, invoice.customer),
    items: upsertItems(data.items, invoice.items),
    supplier: profileOf(structuredClone(invoice)),
  };
}

/** The highest invoice number in the history, or of the given fallback when that is higher. */
export function latestNumber(data: AppData, fallback: string): string {
  return data.invoices.map((i) => i.number).reduce((max, n) => (n.localeCompare(max) > 0 ? n : max), fallback);
}

/** An editable copy of a saved invoice, without the history bookkeeping. */
export function toDraft(saved: SavedInvoice): Invoice {
  const copy: Partial<SavedInvoice> = structuredClone(saved);
  delete copy.savedAt;
  delete copy.paid;
  return copy as Invoice;
}
