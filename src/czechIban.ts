const ACCOUNT = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/;
const PREFIX_WEIGHTS = [10, 5, 8, 4, 2, 1];
const NUMBER_WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];

// Czech account parts carry their own mod-11 check (ČNB decree 169/2011).
function passesMod11(digits: string, weights: number[]): boolean {
  const padded = digits.padStart(weights.length, '0');
  const sum = [...padded].reduce((acc, d, i) => acc + Number(d) * (weights[i] ?? 0), 0);
  return sum % 11 === 0;
}

function mod97(numeric: string): number {
  let rest = 0;
  for (const ch of numeric) rest = (rest * 10 + Number(ch)) % 97;
  return rest;
}

/** "19-2000145399/0800" → "CZ6508000000192000145399"; null when the text is not a valid Czech account number. */
export function czechAccountToIban(account: string): string | null {
  const match = ACCOUNT.exec(account.replace(/\s/g, ''));
  if (!match) return null;
  const [, prefix = '', number = '', bank = ''] = match;
  if (!passesMod11(prefix, PREFIX_WEIGHTS) || !passesMod11(number, NUMBER_WEIGHTS)) return null;
  const bban = bank + prefix.padStart(6, '0') + number.padStart(10, '0');
  // C = 12, Z = 35
  const check = 98 - mod97(`${bban}123500`);
  return `CZ${String(check).padStart(2, '0')}${bban}`;
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, '$1 ');
}
