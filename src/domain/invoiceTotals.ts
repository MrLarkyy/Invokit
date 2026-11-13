import { VAT_RATES, type InvoiceItem, type VatRate } from './invoice';
import { lineTotalCents, roundHalfAway } from './money';

export interface RateTotal {
  rate: VatRate;
  baseCents: number;
  vatCents: number;
}

/** The only source of invoice totals: the form, the list, statistics, the paper and the QR amount all read it. */
export interface Totals {
  baseCents: number;
  vatCents: number;
  totalCents: number;
  /** Per-rate breakdown, VAT payers only, highest rate first. */
  rates: RateTotal[];
}

/** A row that shows on the invoice: an empty trailing row is ignored. */
export function isFilledItem(item: InvoiceItem): boolean {
  return item.description.trim() !== '' || item.unitPriceCents !== 0;
}

export function filledItems(items: InvoiceItem[]): InvoiceItem[] {
  return items.filter(isFilledItem);
}

export function itemTotalCents(item: InvoiceItem): number {
  return item.legacyLineCents ?? lineTotalCents(item.quantity, item.unitPriceCents);
}

/** VAT is computed once per rate from the rate's base (not per line) and rounded half away from zero. */
export function computeTotals(items: InvoiceItem[], vatPayer: boolean): Totals {
  const lines = filledItems(items);
  const baseCents = lines.reduce((sum, item) => sum + itemTotalCents(item), 0);
  if (!vatPayer) return { baseCents, vatCents: 0, totalCents: baseCents, rates: [] };
  const rates = VAT_RATES.filter((rate) => lines.some((item) => item.vatRate === rate)).map((rate) => {
    const rateBase = lines.filter((item) => item.vatRate === rate).reduce((sum, item) => sum + itemTotalCents(item), 0);
    const vatCents = Number(roundHalfAway(BigInt(rateBase) * BigInt(rate), 100n));
    return { rate, baseCents: rateBase, vatCents };
  });
  const vatCents = rates.reduce((sum, r) => sum + r.vatCents, 0);
  return { baseCents, vatCents, totalCents: baseCents + vatCents, rates };
}
