import { describe, expect, it } from 'vitest';
import { nextInvoiceNumber, nextNumber, uniqueInvoiceId, variableSymbolFor } from './invoiceNumber';

describe('invoice numbering', () => {
  it('continues the sequence within a month and restarts in a new one', () => {
    expect(nextInvoiceNumber('2026-09-001', '2026-09-20')).toBe('2026-09-002');
    expect(nextInvoiceNumber('2026-09-009', '2026-10-01')).toBe('2026-10-001');
    expect(nextInvoiceNumber('', '2026-10-30')).toBe('2026-10-001');
  });

  it('derives the variable symbol from the number', () => {
    expect(variableSymbolFor('2026-09-001')).toBe('202609001');
  });
});

describe('nextNumber', () => {
  const history = (...numbers: string[]) => numbers.map((number) => ({ number }));

  it('continues the highest number of the month', () => {
    expect(nextNumber(history('2026-09-002', '2026-09-004', '2026-09-003'), '2026-09-20')).toBe('2026-09-005');
  });

  it('restarts in a new month and ignores other formats', () => {
    expect(nextNumber(history('2026-09-004'), '2026-10-01')).toBe('2026-10-001');
    expect(nextNumber(history('2026-0099', 'FA-12', '2026-10-x'), '2026-10-01')).toBe('2026-10-001');
    expect(nextNumber([], '2026-10-01')).toBe('2026-10-001');
  });
});

describe('uniqueInvoiceId', () => {
  it('slugs the number and adds a counter on collision', () => {
    expect(uniqueInvoiceId('2026/09 001', new Set())).toBe('2026-09-001');
    expect(uniqueInvoiceId('2026-09-001', new Set(['2026-09-001', '2026-09-001-2']))).toBe('2026-09-001-3');
    expect(uniqueInvoiceId('***', new Set())).toBe('faktura');
  });
});
