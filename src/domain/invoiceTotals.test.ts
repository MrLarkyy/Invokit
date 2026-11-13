import { describe, expect, it } from 'vitest';
import { fixtureItem as item } from '../test/invoiceFixture';
import { LIMITS } from './limits';
import { computeTotals } from './invoiceTotals';

const vatOf = (baseCents: number, rate: 12 | 21) => computeTotals([item('x', '1', baseCents, rate)], true).vatCents;

describe('computeTotals', () => {
  it('sums the lines for a non-payer, without VAT or rates', () => {
    const totals = computeTotals([item('a', '2', 15_000, 21), item('b', '1.5', 33_333, 12)], false);
    expect(totals).toEqual({ baseCents: 80_000, vatCents: 0, totalCents: 80_000, rates: [] });
  });

  it('rounds VAT per rate half away from zero', () => {
    expect(vatOf(50, 21)).toBe(11); // 10,5
    expect(vatOf(150, 21)).toBe(32); // 31,5
    expect(vatOf(-50, 21)).toBe(-11); // -10,5
    expect(vatOf(2, 21)).toBe(0); // 0,42
    expect(vatOf(417, 12)).toBe(50); // 50,04
  });

  it('computes VAT on the rate base, not per line', () => {
    const twoHalves = computeTotals([item('a', '1', 50, 21), item('b', '1', 50, 21)], true);
    expect(twoHalves.vatCents).toBe(21); // per line it would be 11 + 11
    const hundredCents = computeTotals([item('a', '100', 1, 21)], true);
    expect(hundredCents.vatCents).toBe(21);
  });

  it('lists every used rate, highest first, with its base and VAT', () => {
    const totals = computeTotals(
      [item('zero', '1', 1_000, 0), item('high', '1', 10_000, 21), item('low', '1', 3_333, 12)],
      true,
    );
    expect(totals.rates).toEqual([
      { rate: 21, baseCents: 10_000, vatCents: 2_100 },
      { rate: 12, baseCents: 3_333, vatCents: 400 },
      { rate: 0, baseCents: 1_000, vatCents: 0 },
    ]);
    expect(totals.baseCents).toBe(14_333);
    expect(totals.vatCents).toBe(2_500);
    expect(totals.totalCents).toBe(16_833);
  });

  it('keeps 200 lines at the line limit safe integers', () => {
    const lines = Array.from({ length: LIMITS.itemsPerInvoice }, (_, i) =>
      item(`l${i}`, '10', LIMITS.lineCents / 10, 21),
    );
    const totals = computeTotals(lines, true);
    expect(totals.baseCents).toBe(200 * LIMITS.lineCents);
    expect(totals.vatCents).toBe(42 * LIMITS.lineCents);
    expect(Number.isSafeInteger(totals.totalCents)).toBe(true);
  });

  it('ignores an empty trailing row', () => {
    const totals = computeTotals([item('a', '1', 100, 21), item('', '1', 0, 21)], true);
    expect(totals.rates).toHaveLength(1);
    expect(totals.totalCents).toBe(121);
  });

  it('uses the migrated line total when it is set', () => {
    const migrated = { ...item('old', '1.005', 100), legacyLineCents: 100 };
    expect(computeTotals([migrated], false).totalCents).toBe(100);
  });
});
