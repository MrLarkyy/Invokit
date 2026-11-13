import { describe, expect, it } from 'vitest';
import { isValidDic } from './dic';

describe('isValidDic', () => {
  it('accepts CZ with 8 to 10 digits', () => {
    expect(isValidDic('CZ27410587')).toBe(true);
    expect(isValidDic('cz 8001011234')).toBe(true);
  });

  it('rejects other forms', () => {
    expect(isValidDic('27410587')).toBe(false);
    expect(isValidDic('CZ1234567')).toBe(false);
    expect(isValidDic('SK27410587')).toBe(false);
  });
});
