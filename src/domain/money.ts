// Amounts are integer haléře and quantities exact decimal strings, so no binary float ever touches money.

const NBSP = String.fromCharCode(0xa0);
const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;
const QUANTITY_DECIMALS = 6;

interface DecimalParts {
  negative: boolean;
  integer: string;
  fraction: string;
}

function splitDecimal(text: string): DecimalParts | null {
  // \s covers the non-breaking and narrow no-break space that Czech number formatting inserts.
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  const match = DECIMAL.exec(normalized);
  if (!match) return null;
  const [, sign = '', integer = '', fraction = ''] = match;
  if (integer === '' && fraction === '') return null;
  return { negative: sign === '-', integer: integer.replace(/^0+(?=\d)/, '') || '0', fraction };
}

/** "1 234,50" → 123450; null when it is not a number or has more than 2 decimals. */
export function parseCents(text: string): number | null {
  const parts = splitDecimal(text);
  if (!parts || parts.fraction.length > 2) return null;
  const cents = BigInt(parts.integer) * 100n + BigInt(parts.fraction.padEnd(2, '0'));
  const value = Number(parts.negative ? -cents : cents);
  return Number.isSafeInteger(value) ? value : null;
}

/** "1,50" → "1.5" (canonical: no leading or trailing zeros, at most 6 decimals); null otherwise. */
export function parseQuantity(text: string): string | null {
  const parts = splitDecimal(text);
  if (!parts) return null;
  const fraction = parts.fraction.replace(/0+$/, '');
  if (fraction.length > QUANTITY_DECIMALS) return null;
  const isZero = parts.integer === '0' && fraction === '';
  const sign = parts.negative && !isZero ? '-' : '';
  return `${sign}${parts.integer}${fraction ? `.${fraction}` : ''}`;
}

/** Integer division rounded half away from zero; `denominator` must be positive. */
export function roundHalfAway(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const rest = numerator % denominator;
  const twiceRest = rest < 0n ? -2n * rest : 2n * rest;
  if (twiceRest < denominator) return quotient;
  return numerator < 0n ? quotient - 1n : quotient + 1n;
}

/** Exact quantity × unit price in haléře, rounded half away from zero; 0 when the quantity is not a number. */
export function lineTotalCents(quantity: string, unitPriceCents: number): number {
  const parts = splitDecimal(quantity);
  if (!parts || !Number.isSafeInteger(unitPriceCents)) return 0;
  const scaled = BigInt(parts.integer + parts.fraction) * (parts.negative ? -1n : 1n);
  const scale = 10n ** BigInt(parts.fraction.length);
  return Number(roundHalfAway(scaled * BigInt(unitPriceCents), scale));
}

const czk = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const czkRound = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
const nbsp = (text: string) => text.replace(/\s/g, NBSP);

// cents / 100 is display only: below 2^53 the nearest double still rounds back to the exact two decimals.

/** "122 400,00 Kč" with non-breaking spaces, so the amount never wraps. */
export function formatCzk(cents: number): string {
  return `${nbsp(czk.format(cents / 100))}${NBSP}Kč`;
}

/** "122 400 Kč": whole crowns for overviews; never used on an invoice. */
export function formatCzkRound(cents: number): string {
  return `${nbsp(czkRound.format(cents / 100))}${NBSP}Kč`;
}

/** Cents as the user types them: 123450 → "1234,50", 80000 → "800". */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const crowns = Math.trunc(abs / 100);
  const rest = abs % 100;
  return `${sign}${crowns}${rest ? `,${String(rest).padStart(2, '0')}` : ''}`;
}

/** Canonical quantity for display: "1.5" → "1,5". */
export function formatQuantity(quantity: string): string {
  return quantity.replace('.', ',');
}
