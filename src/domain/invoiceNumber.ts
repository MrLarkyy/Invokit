const SERIES = /^(\d{4}-\d{2}-)(\d+)$/;

/** Number of the next invoice: "2026-09-001" → "2026-10-001" in a new month, "2026-09-002" in the same month. */
export function nextInvoiceNumber(previous: string, today: string): string {
  const [year = '', month = ''] = today.split('-');
  const prefix = `${year}-${month}-`;
  const match = SERIES.exec(previous);
  if (!match || match[1] !== prefix) return `${prefix}001`;
  const sequence = match[2] ?? '0';
  return prefix + String(Number(sequence) + 1).padStart(sequence.length, '0');
}

/** The number after the highest "YYYY-MM-NNN" of this month in the history; other formats are ignored. */
export function nextNumber(invoices: readonly { number: string }[], today: string): string {
  const prefix = today.slice(0, 8);
  let highest = '';
  let highestSequence = -1;
  for (const { number } of invoices) {
    const match = SERIES.exec(number.trim());
    if (!match || match[1] !== prefix) continue;
    const sequence = Number(match[2]);
    if (sequence > highestSequence) {
      highest = number.trim();
      highestSequence = sequence;
    }
  }
  return nextInvoiceNumber(highest, today);
}

/** "2026-09-001" → "202609001". */
export function variableSymbolFor(invoiceNumber: string): string {
  return invoiceNumber.replace(/\D/g, '').slice(-10);
}

/** "2026/09 001" → "2026-09-001": a stable id for the address bar; "faktura" when nothing is left. */
export function invoiceSlug(invoiceNumber: string): string {
  const slug = invoiceNumber
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return slug || 'faktura';
}

/** The slug, with "-2", "-3"… when another invoice already holds it. */
export function uniqueInvoiceId(invoiceNumber: string, taken: ReadonlySet<string>): string {
  const slug = invoiceSlug(invoiceNumber);
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}
