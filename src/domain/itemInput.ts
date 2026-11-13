import { LIMITS } from './limits';
import { parseCents, parseQuantity } from './money';

/** A typed quantity within ±1 000 000 and 6 decimals; null otherwise, so it never reaches the draft. */
export function parseItemQuantity(text: string): string | null {
  const quantity = parseQuantity(text);
  if (quantity === null) return null;
  const integerDigits = quantity.replace(/^-/, '').split('.')[0] ?? '';
  return integerDigits.length <= 7 && Math.abs(Number(quantity)) <= LIMITS.quantity ? quantity : null;
}

/** A typed unit price within ±1 000 000 000 Kč and 2 decimals, in haléře; null otherwise. */
export function parseItemPrice(text: string): number | null {
  const cents = parseCents(text);
  return cents !== null && Math.abs(cents) <= LIMITS.unitPriceCents ? cents : null;
}
