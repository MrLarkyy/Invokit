/** Czech DIČ by form: "CZ" and 8 to 10 digits (IČO, or a birth number for a natural person). */
export function isValidDic(text: string): boolean {
  return /^CZ\d{8,10}$/.test(text.replace(/\s/g, '').toUpperCase());
}
