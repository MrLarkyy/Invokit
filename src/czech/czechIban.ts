const ACCOUNT = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/;
const PREFIX_WEIGHTS = [10, 5, 8, 4, 2, 1];
const NUMBER_WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];

export interface CzechAccount {
  prefix: string;
  number: string;
  bankCode: string;
}

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

/** "19-2000145399/0800" → its parts, by form only (no checksum); null when it does not look like an account. */
export function parseCzechAccount(account: string): CzechAccount | null {
  const match = ACCOUNT.exec(account.replace(/\s/g, ''));
  if (!match) return null;
  const [, prefix = '', number = '', bankCode = ''] = match;
  return { prefix, number, bankCode };
}

/** The parts back as "19-2000145399/0800"; empty while the number or the bank code is missing. */
export function formatCzechAccount({ prefix, number, bankCode }: CzechAccount): string {
  if (!number || !bankCode) return '';
  return `${prefix ? `${prefix}-` : ''}${number}/${bankCode}`;
}

/** "19-2000145399/0800" → "CZ6508000000192000145399"; null when the text is not a valid Czech account number. */
export function czechAccountToIban(account: string): string | null {
  const parts = parseCzechAccount(account);
  if (!parts) return null;
  const { prefix, number, bankCode } = parts;
  if (!passesMod11(prefix, PREFIX_WEIGHTS) || !passesMod11(number, NUMBER_WEIGHTS)) return null;
  const bban = bankCode + prefix.padStart(6, '0') + number.padStart(10, '0');
  // C = 12, Z = 35
  const check = 98 - mod97(`${bban}123500`);
  return `CZ${String(check).padStart(2, '0')}${bban}`;
}

/** ISO 13616: country, check digits and BBAN, with the whole number ≡ 1 (mod 97). */
export function isValidIban(iban: string): boolean {
  const compact = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false;
  const numeric = (compact.slice(4) + compact.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return mod97(numeric) === 1;
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, '$1 ');
}
