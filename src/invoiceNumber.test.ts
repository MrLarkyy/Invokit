import { describe, expect, it } from 'vitest';
import { nextInvoiceNumber, variableSymbolFor } from './invoiceNumber';

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
