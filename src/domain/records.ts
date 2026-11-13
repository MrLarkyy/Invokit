import type { AppData } from '../storage/appData';
import type { CatalogItem, Invoice, InvoiceItem, Party } from './invoice';
import { filledItems } from './invoiceTotals';

const norm = (text: string) => text.trim().toLowerCase();

/** Customers are the same when their IČO matches, or their name when neither has an IČO. */
export function sameParty(a: Party, b: Party): boolean {
  if (a.ico.trim() || b.ico.trim()) return a.ico.trim() === b.ico.trim();
  return norm(a.name) === norm(b.name);
}

/** The Czech message when another invoice already uses this number, else null. */
export function numberTakenProblem(data: AppData, invoice: Invoice): string | null {
  const number = invoice.number.trim();
  const taken = data.invoices.some((i) => i.id !== invoice.id && i.number.trim() === number);
  return taken ? `Faktura s číslem ${number} už existuje.` : null;
}

function upsertCustomer(customers: Party[], customer: Party): Party[] {
  if (!customer.name.trim()) return customers;
  const rest = customers.filter((c) => !sameParty(c, customer));
  return [...rest, { ...customer }].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

function upsertCatalog(catalog: CatalogItem[], items: InvoiceItem[]): CatalogItem[] {
  const result = [...catalog];
  for (const item of items) {
    if (!item.description.trim()) continue;
    const entry: CatalogItem = {
      description: item.description,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      vatRate: item.vatRate,
    };
    const at = result.findIndex((c) => norm(c.description) === norm(item.description));
    if (at >= 0) result[at] = entry;
    else result.push(entry);
  }
  return result.sort((a, b) => a.description.localeCompare(b.description, 'cs'));
}

/**
 * Saves the invoice by id (newest number first), without empty rows, and remembers its customer and items.
 * The paid state stays as it was; throws a Czech message when another invoice uses the number.
 */
export function saveInvoice(data: AppData, invoice: Invoice, now: string): AppData {
  const problem = numberTakenProblem(data, invoice);
  if (problem) throw new Error(problem);
  const previous = data.invoices.find((i) => i.id === invoice.id);
  const copy = structuredClone(invoice);
  const saved: Invoice = {
    ...copy,
    number: copy.number.trim(),
    items: filledItems(copy.items),
    savedAt: now,
    paid: previous?.paid ?? false,
    paidAt: previous?.paidAt ?? null,
  };
  const invoices = [...data.invoices.filter((i) => i.id !== invoice.id), saved].sort((a, b) =>
    b.number.localeCompare(a.number),
  );
  return {
    ...data,
    invoices,
    customers: upsertCustomer(data.customers, saved.customer),
    items: upsertCatalog(data.items, saved.items),
  };
}

export function deleteInvoice(data: AppData, id: string): AppData {
  return { ...data, invoices: data.invoices.filter((i) => i.id !== id) };
}

/** A date marks the invoice paid on that day; null marks it unpaid. */
export function setPaid(data: AppData, id: string, paidAt: string | null): AppData {
  return {
    ...data,
    invoices: data.invoices.map((i) => (i.id === id ? { ...i, paid: paidAt !== null, paidAt } : i)),
  };
}

export function deleteCustomer(data: AppData, customer: Party): AppData {
  return { ...data, customers: data.customers.filter((c) => !sameParty(c, customer)) };
}

export function deleteCatalogItem(data: AppData, description: string): AppData {
  return { ...data, items: data.items.filter((c) => norm(c.description) !== norm(description)) };
}
