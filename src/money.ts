// Amounts are kept in haléře (integer cents) so that totals never pick up floating-point error.

const NBSP = String.fromCharCode(0xa0);

/** Parses a user-typed decimal ("1 234,5", "800.00"); null when it is not a number. */
export function parseDecimal(text: string): number | null {
  // \s covers the non-breaking space too.
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

export function lineTotalCents(quantity: string, unitPrice: string): number {
  const q = parseDecimal(quantity);
  const p = parseDecimal(unitPrice);
  if (q === null || p === null) return 0;
  return Math.round(q * Math.round(p * 100));
}

const czk = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "122 400,00 Kč" with non-breaking spaces, so the amount never wraps. */
export function formatCzk(cents: number): string {
  return `${czk.format(cents / 100).replace(/\s/g, NBSP)}${NBSP}Kč`;
}
