/** Number of the next invoice: "2026-09-001" → "2026-10-001" in a new month, "2026-09-002" in the same month. */
export function nextInvoiceNumber(previous: string, today: string): string {
  const [year = '', month = ''] = today.split('-');
  const prefix = `${year}-${month}-`;
  const match = /^(\d{4}-\d{2}-)(\d+)$/.exec(previous);
  if (!match || match[1] !== prefix) return `${prefix}001`;
  const sequence = match[2] ?? '0';
  return prefix + String(Number(sequence) + 1).padStart(sequence.length, '0');
}

/** "2026-09-001" → "202609001". */
export function variableSymbolFor(invoiceNumber: string): string {
  return invoiceNumber.replace(/\D/g, '').slice(-10);
}
