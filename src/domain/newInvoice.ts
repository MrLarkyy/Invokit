import { addDays, diffDays } from './dates';
import { emptyParty, type Invoice, type InvoiceItem } from './invoice';
import { defaultAppearance } from './invoiceAppearance';
import { nextNumber, uniqueInvoiceId, variableSymbolFor } from './invoiceNumber';
import { savedProfile, snapshotOf, type SupplierProfile } from './supplierProfile';

const DUE_DAYS = 14;

export interface InvoiceBook {
  invoices: Invoice[];
  supplier: SupplierProfile | null;
}

export function newItem(vatPayer: boolean, newId: () => string): InvoiceItem {
  return { id: newId(), description: '', quantity: '1', unit: 'ks', unitPriceCents: 0, vatRate: vatPayer ? 21 : 0 };
}

/** A fresh invoice continuing the number series, with the current supplier profile and its look. */
export function createBlankInvoice(book: InvoiceBook, today: string, newId: () => string): Invoice {
  const number = nextNumber(book.invoices, today);
  const profile = savedProfile(book);
  const supplier = snapshotOf(profile);
  return {
    id: uniqueInvoiceId(number, new Set(book.invoices.map((i) => i.id))),
    number,
    issueDate: today,
    dueDate: addDays(today, DUE_DAYS),
    taxableSupplyDate: today,
    variableSymbol: variableSymbolFor(number),
    supplier,
    appearance: { ...(profile?.appearance ?? defaultAppearance()) },
    customer: emptyParty(),
    items: [newItem(supplier.vatPayer, newId)],
    note: '',
    paymentMethod: 'Převodem',
    showQr: true,
    paid: false,
    paidAt: null,
    savedAt: '',
  };
}

/**
 * A copy dated today with a new number, the same payment term and template, and the current supplier profile with
 * its accent, logo and footer; unpaid.
 */
export function duplicateInvoice(source: Invoice, book: InvoiceBook, today: string, newId: () => string): Invoice {
  const blank = createBlankInvoice(book, today, newId);
  const term = Math.max(0, diffDays(source.issueDate, source.dueDate) || 0);
  return {
    ...blank,
    dueDate: addDays(today, term),
    supplier: book.supplier ? blank.supplier : structuredClone(source.supplier),
    appearance: { ...blank.appearance, template: source.appearance.template },
    customer: { ...source.customer },
    // A copied line is a new line: the migrated rounding of the source does not carry over.
    items: source.items.map((item) => ({
      id: newId(),
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      vatRate: item.vatRate,
    })),
    note: source.note,
    paymentMethod: source.paymentMethod,
    showQr: source.showQr,
  };
}

/**
 * A restored new-invoice draft whose number has been used since (saved here or in another tab) gets the next free
 * number, and the matching variable symbol when that was still the automatic one.
 */
export function refreshDraft(draft: Invoice, book: InvoiceBook, today: string): Invoice {
  if (!book.invoices.some((i) => i.number.trim() === draft.number.trim())) return draft;
  const number = nextNumber(book.invoices, today);
  const automaticVs = draft.variableSymbol === variableSymbolFor(draft.number);
  return { ...draft, number, ...(automaticVs ? { variableSymbol: variableSymbolFor(number) } : {}) };
}
