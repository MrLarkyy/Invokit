import { isIsoDate } from './dates';
import type { Invoice, InvoiceItem, Party, SupplierSnapshot } from './invoice';
import { computeTotals, filledItems, itemTotalCents } from './invoiceTotals';
import { LIMITS } from './limits';

export type ProblemField =
  | 'supplier'
  | 'customerName'
  | 'customer'
  | 'items'
  | 'item'
  | 'number'
  | 'variableSymbol'
  | 'issueDate'
  | 'dueDate'
  | 'taxableSupplyDate'
  | 'note'
  | 'total';

export interface InvoiceProblem {
  message: string;
  field: ProblemField;
  /** The row, for field 'item'. */
  itemId?: string;
}

const partyTooLong = (party: Party) =>
  [party.name, party.street, party.city, party.zip, party.ico, party.dic].some((value) => value.length > LIMITS.text);

/** An issued invoice must name its supplier: name, address and IČO, and DIČ for a VAT payer. */
export function isCompleteSupplier(supplier: SupplierSnapshot): boolean {
  const { party } = supplier;
  const filled = [party.name, party.street, party.city, party.ico].every((value) => value.trim() !== '');
  return filled && (!supplier.vatPayer || party.dic.trim() !== '');
}

function amountOutOfRange(item: InvoiceItem): boolean {
  const quantity = Math.abs(Number(item.quantity));
  return (
    !(quantity <= LIMITS.quantity) ||
    Math.abs(item.unitPriceCents) > LIMITS.unitPriceCents ||
    Math.abs(itemTotalCents(item)) > LIMITS.lineCents
  );
}

/** The first reason the invoice cannot be saved, with the field to point at; null when it can. */
export function findInvoiceProblem(invoice: Invoice): InvoiceProblem | null {
  const problem = (message: string, field: ProblemField, itemId?: string): InvoiceProblem =>
    itemId === undefined ? { message, field } : { message, field, itemId };
  const items = filledItems(invoice.items);
  if (!isCompleteSupplier(invoice.supplier)) return problem('Doplň své údaje v nastavení.', 'supplier');
  if (!invoice.customer.name.trim()) return problem('Doplň název odběratele.', 'customerName');
  if (partyTooLong(invoice.customer)) {
    return problem(`Údaje odběratele mohou mít nejvýš ${LIMITS.text} znaků.`, 'customer');
  }
  if (!items.some((item) => item.description.trim())) return problem('Přidej aspoň jednu položku s popisem.', 'items');
  if (items.length > LIMITS.itemsPerInvoice) {
    return problem(`Faktura může mít nejvýš ${LIMITS.itemsPerInvoice} položek.`, 'items');
  }
  const tooLong = items.find((item) => item.description.length > LIMITS.text || item.unit.length > LIMITS.text);
  if (tooLong) return problem(`Text položky může mít nejvýš ${LIMITS.text} znaků.`, 'item', tooLong.id);
  const outOfRange = items.find(amountOutOfRange);
  if (outOfRange) return problem('Množství nebo cena položky je mimo povolený rozsah.', 'item', outOfRange.id);
  if (computeTotals(items, invoice.supplier.vatPayer).totalCents <= 0) {
    return problem('Součet faktury musí být kladný.', 'total');
  }
  if (!invoice.number.trim()) return problem('Doplň číslo faktury.', 'number');
  if (invoice.number.length > LIMITS.text) return problem('Číslo faktury je příliš dlouhé.', 'number');
  if (!/^\d{0,10}$/.test(invoice.variableSymbol)) {
    return problem('Variabilní symbol může mít jen číslice, nejvýš 10.', 'variableSymbol');
  }
  if (!isIsoDate(invoice.issueDate)) return problem('Zadej platné datum vystavení.', 'issueDate');
  if (!isIsoDate(invoice.dueDate)) return problem('Zadej platné datum splatnosti.', 'dueDate');
  if (invoice.supplier.vatPayer && !isIsoDate(invoice.taxableSupplyDate)) {
    return problem('Zadej platné datum zdanitelného plnění.', 'taxableSupplyDate');
  }
  if (invoice.note.length > LIMITS.note) return problem(`Poznámka může mít nejvýš ${LIMITS.note} znaků.`, 'note');
  return null;
}

/** The message of findInvoiceProblem. */
export function invoiceProblem(invoice: Invoice): string | null {
  return findInvoiceProblem(invoice)?.message ?? null;
}
