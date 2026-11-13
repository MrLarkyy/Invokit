import { describe, expect, it } from 'vitest';
import { centsToInput, formatCzk, lineTotalCents, parseCents, parseQuantity, roundHalfAway } from './money';

const NBSP = String.fromCharCode(0xa0);

describe('parseCents', () => {
  it('reads Czech and English decimals into haléře', () => {
    expect(parseCents('1 234,50')).toBe(123_450);
    expect(parseCents(`1${NBSP}234,5`)).toBe(123_450);
    expect(parseCents('800.00')).toBe(80_000);
    expect(parseCents('0,1')).toBe(10);
    expect(parseCents('-50')).toBe(-5_000);
    expect(parseCents('+3')).toBe(300);
  });

  it('rejects more than two decimals and anything that is not a number', () => {
    expect(parseCents('0,125')).toBeNull();
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('')).toBeNull();
    expect(parseCents('1,2,3')).toBeNull();
    expect(parseCents('1e5')).toBeNull();
    expect(parseCents('9'.repeat(20))).toBeNull();
  });
});

describe('parseQuantity', () => {
  it('returns a canonical decimal string', () => {
    expect(parseQuantity('1,5')).toBe('1.5');
    expect(parseQuantity('001,500')).toBe('1.5');
    expect(parseQuantity('10')).toBe('10');
    expect(parseQuantity('-0')).toBe('0');
    expect(parseQuantity('0,123456')).toBe('0.123456');
  });

  it('rejects more than 6 decimals', () => {
    expect(parseQuantity('0,1234567')).toBeNull();
    expect(parseQuantity('x')).toBeNull();
  });
});

describe('roundHalfAway', () => {
  it('rounds halves away from zero in both directions', () => {
    expect(roundHalfAway(5n, 2n)).toBe(3n);
    expect(roundHalfAway(-5n, 2n)).toBe(-3n);
    expect(roundHalfAway(4n, 3n)).toBe(1n);
    expect(roundHalfAway(-4n, 3n)).toBe(-1n);
  });
});

describe('lineTotalCents', () => {
  it('computes line totals in haléře without float drift', () => {
    expect(lineTotalCents('153', 80_000)).toBe(12_240_000);
    expect(lineTotalCents('3', 10)).toBe(30);
    expect(lineTotalCents('1.5', 33_333)).toBe(50_000); // 49 999,5 rounds up
    expect(lineTotalCents('0.333', 300)).toBe(100);
    expect(lineTotalCents('1.005', 100)).toBe(101); // the float product is 100.49999…
    expect(lineTotalCents('0', 12_345)).toBe(0);
    expect(lineTotalCents('-1', 50)).toBe(-50);
    expect(lineTotalCents('', 800)).toBe(0);
  });

  it('stays exact at the limits', () => {
    expect(lineTotalCents('1000000', 100_000_000_000)).toBe(100_000_000_000_000_000);
    expect(lineTotalCents('9999.999999', 100_000_000)).toBe(999_999_999_900);
  });
});

describe('formatting', () => {
  it('formats like the sample invoice', () => {
    expect(formatCzk(12_240_000)).toBe(['122', '400,00', 'Kč'].join(NBSP));
    expect(formatCzk(1_005)).toBe(['10,05', 'Kč'].join(NBSP));
  });

  it('writes cents back the way they are typed', () => {
    expect(centsToInput(123_450)).toBe('1234,50');
    expect(centsToInput(80_000)).toBe('800');
    expect(centsToInput(-5)).toBe('-0,05');
  });
});
