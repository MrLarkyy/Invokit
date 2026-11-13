const WEIGHTS = [8, 7, 6, 5, 4, 3, 2];

/** IČO: 8 digits whose last one is the mod-11 check of the first seven. */
export function isValidIco(text: string): boolean {
  const ico = text.replace(/\s/g, '');
  if (!/^\d{8}$/.test(ico)) return false;
  const sum = WEIGHTS.reduce((acc, weight, i) => acc + weight * Number(ico[i]), 0);
  return (11 - (sum % 11)) % 10 === Number(ico[7]);
}
