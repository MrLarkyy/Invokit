import type { CatalogItem, Invoice, InvoiceItem, Party } from './invoice';
import { filledItems } from './invoiceTotals';
import { LIMITS } from './limits';

/** The lists a save touches; the stored data has more fields, which every function here keeps as they are. */
export interface InvoiceRecords {
  invoices: Invoice[];
  /** Most recently used first; capped at LIMITS.customers. */
  customers: Party[];
  /** Most recently used first; capped at LIMITS.catalog. */
  items: CatalogItem[];
}

const norm = (text: string) => text.trim().toLowerCase();

/** Customers are the same when their IČO matches, or their name when neither has an IČO. */
export function sameParty(a: Party, b: Party): boolean {
  if (a.ico.trim() || b.ico.trim()) return a.ico.trim() === b.ico.trim();
  return norm(a.name) === norm(b.name);
}

/** Said when a new invoice got the id of one saved meanwhile under another number; saving again gives it a free id. */
export const ID_TAKEN = 'Mezitím přibyla jiná faktura se stejným označením. Ulož fakturu znovu.';

/**
 * The Czech reason this invoice cannot be stored next to the others (number taken, invoice limit), else null.
 * `create`: the invoice is a new one, so an invoice already holding its id is another invoice, never an older
 * version of this one (two tabs offer the same next number, and with it the same id).
 */
export function saveProblem(data: InvoiceRecords, invoice: Invoice, create = false): string | null {
  const number = invoice.number.trim();
  if (data.invoices.some((i) => (create || i.id !== invoice.id) && i.number.trim() === number)) {
    return `Faktura s číslem ${number} už existuje.`;
  }
  const isNew = !data.invoices.some((i) => i.id === invoice.id);
  if (create && !isNew) return ID_TAKEN;
  if (isNew && data.invoices.length >= LIMITS.invoices) {
    return 'Invoo pojme nejvýš 10 000 faktur. Stáhni si zálohu a starší faktury smaž.';
  }
  return null;
}

// Saved lists keep the most recently used entries: the oldest drop out at the limit, so stored data always loads.
function upsertCustomer(customers: Party[], customer: Party): Party[] {
  if (!customer.name.trim()) return customers;
  const rest = customers.filter((c) => !sameParty(c, customer));
  return [{ ...customer }, ...rest].slice(0, LIMITS.customers);
}

function upsertCatalog(catalog: CatalogItem[], items: InvoiceItem[]): CatalogItem[] {
  const used = items
    .filter((item) => item.description.trim())
    .map((item) => ({
      description: item.description,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      vatRate: item.vatRate,
    }))
    .filter((entry, i, all) => all.findIndex((other) => norm(other.description) === norm(entry.description)) === i);
  const rest = catalog.filter((c) => !used.some((entry) => norm(entry.description) === norm(c.description)));
  return [...used, ...rest].slice(0, LIMITS.catalog);
}

/**
 * Saves the invoice by id (newest number first), without empty rows, and remembers its customer and items: with
 * `create` as a new invoice, otherwise in place of the one with its id, whose paid state stays as it was. Throws
 * the Czech saveProblem when the invoice cannot be stored.
 */
export function saveInvoice<T extends InvoiceRecords>(data: T, invoice: Invoice, now: string, create = false): T {
  const problem = saveProblem(data, invoice, create);
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

export function deleteInvoice<T extends InvoiceRecords>(data: T, id: string): T {
  return { ...data, invoices: data.invoices.filter((i) => i.id !== id) };
}

/** A date marks the invoice paid on that day; null marks it unpaid. */
export function setPaid<T extends InvoiceRecords>(data: T, id: string, paidAt: string | null): T {
  return {
    ...data,
    invoices: data.invoices.map((i) => (i.id === id ? { ...i, paid: paidAt !== null, paidAt } : i)),
  };
}

export function deleteCustomer<T extends InvoiceRecords>(data: T, customer: Party): T {
  return { ...data, customers: data.customers.filter((c) => !sameParty(c, customer)) };
}

export function deleteCatalogItem<T extends InvoiceRecords>(data: T, description: string): T {
  return { ...data, items: data.items.filter((c) => norm(c.description) !== norm(description)) };
}

/** Names in Czech alphabetical order, for lists shown to the user. */
export function byName(a: Party, b: Party): number {
  return a.name.localeCompare(b.name, 'cs');
}

export function byDescription(a: CatalogItem, b: CatalogItem): number {
  return a.description.localeCompare(b.description, 'cs');
}
