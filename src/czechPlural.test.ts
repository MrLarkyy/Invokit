import { describe, expect, it } from 'vitest';
import { czechPlural, INVOICES } from './czechPlural';

describe('czechPlural', () => {
  it('picks the Czech form by count', () => {
    expect([0, 1, 2, 4, 5, 22].map((n) => czechPlural(n, INVOICES))).toEqual([
      '0 faktur',
      '1 faktura',
      '2 faktury',
      '4 faktury',
      '5 faktur',
      '22 faktur',
    ]);
  });
});
