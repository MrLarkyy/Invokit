import { addDays, diffDays } from './dates';
import { emptyParty, type Invoice, type InvoiceItem } from './invoice';
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

/** A fresh invoice continuing the number series, with the current supplier profile. */
export function createBlankInvoice(book: InvoiceBook, today: string, newId: () => string): Invoice {
  const number = nextNumber(book.invoices, today);
  const supplier = snapshotOf(savedProfile(book));
  return {
    id: uniqueInvoiceId(number, new Set(book.invoices.map((i) => i.id))),
    number,
    issueDate: today,
    dueDate: addDays(today, DUE_DAYS),
    taxableSupplyDate: today,
    variableSymbol: variableSymbolFor(number),
    supplier,
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

/** A copy dated today with a new number, the same payment term and the current supplier profile; unpaid. */
export function duplicateInvoice(source: Invoice, book: InvoiceBook, today: string, newId: () => string): Invoice {
  const blank = createBlankInvoice(book, today, newId);
  const term = Math.max(0, diffDays(source.issueDate, source.dueDate) || 0);
  return {
    ...blank,
    dueDate: addDays(today, term),
    supplier: book.supplier ? blank.supplier : structuredClone(source.supplier),
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
