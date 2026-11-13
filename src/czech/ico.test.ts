import { describe, expect, it } from 'vitest';
import { isValidIco } from './ico';

describe('isValidIco', () => {
  it('accepts invented numbers with a correct check digit', () => {
    // 2·8 + 7·7 + 4·6 + 1·5 + 0·4 + 5·3 + 8·2 = 125, 125 mod 11 = 4, 11 − 4 = 7
    expect(isValidIco('27410587')).toBe(true);
    // 1·4 + 1·3 + 2·2 = 11, mod 11 = 0 → check digit 1
    expect(isValidIco('00001121')).toBe(true);
    // 4·3 = 12, mod 11 = 1 → check digit 0
    expect(isValidIco('00000400')).toBe(true);
    expect(isValidIco('274 105 87')).toBe(true);
  });

  it('rejects a wrong check digit or length', () => {
    expect(isValidIco('27410588')).toBe(false);
    expect(isValidIco('12345678')).toBe(false);
    expect(isValidIco('2741058')).toBe(false);
    expect(isValidIco('')).toBe(false);
  });
});
