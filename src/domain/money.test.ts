import { describe, expect, it } from 'vitest';
import { formatCzk, lineTotalCents, parseDecimal } from './money';

describe('money', () => {
  it('parses Czech and English decimals', () => {
    expect(parseDecimal('1 234,5')).toBe(1234.5);
    expect(parseDecimal('800.00')).toBe(800);
    expect(parseDecimal('abc')).toBeNull();
  });

  it('computes line totals in haléře without float drift', () => {
    expect(lineTotalCents('153', '800')).toBe(12_240_000);
    expect(lineTotalCents('3', '0,1')).toBe(30);
    expect(lineTotalCents('', '800')).toBe(0);
  });

  it('formats like the sample invoice', () => {
    expect(formatCzk(12_240_000)).toBe(['122', '400,00', 'Kč'].join(String.fromCharCode(0xa0)));
  });
});
