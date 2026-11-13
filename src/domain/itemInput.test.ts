import { describe, expect, it } from 'vitest';
import { parseItemPrice, parseItemQuantity } from './itemInput';

describe('item inputs', () => {
  it('accept values within the limits, negative (discount) lines included', () => {
    expect(parseItemQuantity('1 000 000')).toBe('1000000');
    expect(parseItemQuantity('-5')).toBe('-5');
    expect(parseItemPrice('1 000 000 000')).toBe(100_000_000_000);
    expect(parseItemPrice('-150,50')).toBe(-15_050);
  });

  it('reject values over the limits, so they never enter the draft', () => {
    expect(parseItemQuantity('1000000,5')).toBeNull();
    expect(parseItemQuantity('99999999999999999999')).toBeNull();
    expect(parseItemPrice('1000000000,01')).toBeNull();
    expect(parseItemPrice('0,125')).toBeNull();
  });
});
