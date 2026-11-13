import { isIsoDate } from './dates';
import type { Invoice, InvoiceItem, Party } from './invoice';
import { filledItems, itemTotalCents } from './invoiceTotals';
import { LIMITS } from './limits';

const partyTooLong = (party: Party) =>
  [party.name, party.street, party.city, party.zip, party.ico, party.dic].some((value) => value.length > LIMITS.text);

function amountOutOfRange(item: InvoiceItem): boolean {
  const quantity = Math.abs(Number(item.quantity));
  return (
    !(quantity <= LIMITS.quantity) ||
    Math.abs(item.unitPriceCents) > LIMITS.unitPriceCents ||
    Math.abs(itemTotalCents(item)) > LIMITS.lineCents
  );
}

/** The first reason the invoice cannot be saved, as a Czech message; null when it can. */
export function invoiceProblem(invoice: Invoice): string | null {
  const items = filledItems(invoice.items);
  if (!invoice.customer.name.trim()) return 'Doplň název odběratele.';
  if (!items.some((item) => item.description.trim())) return 'Přidej aspoň jednu položku s popisem.';
  if (items.length > LIMITS.itemsPerInvoice) return `Faktura může mít nejvýš ${LIMITS.itemsPerInvoice} položek.`;
  if (!invoice.number.trim()) return 'Doplň číslo faktury.';
  if (invoice.number.length > LIMITS.text) return 'Číslo faktury je příliš dlouhé.';
  if (!/^\d{0,10}$/.test(invoice.variableSymbol)) return 'Variabilní symbol může mít jen číslice, nejvýš 10.';
  if (!isIsoDate(invoice.issueDate)) return 'Zadej platné datum vystavení.';
  if (!isIsoDate(invoice.dueDate)) return 'Zadej platné datum splatnosti.';
  if (invoice.supplier.vatPayer && !isIsoDate(invoice.taxableSupplyDate)) return 'Zadej platné datum zdanitelného plnění.';
  if (partyTooLong(invoice.customer)) return `Údaje odběratele mohou mít nejvýš ${LIMITS.text} znaků.`;
  if (invoice.note.length > LIMITS.note) return `Poznámka může mít nejvýš ${LIMITS.note} znaků.`;
  const index = items.findIndex((item) => item.description.length > LIMITS.text || item.unit.length > LIMITS.text);
  if (index >= 0) return `Položka ${index + 1}: text může mít nejvýš ${LIMITS.text} znaků.`;
  const outOfRange = items.findIndex(amountOutOfRange);
  if (outOfRange >= 0) return `Položka ${outOfRange + 1}: množství nebo cena je mimo povolený rozsah.`;
  return null;
}
