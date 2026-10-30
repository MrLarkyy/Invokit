import { describe, expect, it } from 'vitest';
import { czechAccountToIban, formatIban } from './czechIban';

describe('czechAccountToIban', () => {
  it('converts an account with a prefix', () => {
    expect(czechAccountToIban('19-2000145399/0800')).toBe('CZ6508000000192000145399');
  });

  it('converts an account without a prefix and ignores spaces', () => {
    expect(czechAccountToIban(' 1234567899 / 0100 ')).toBe('CZ9501000000001234567899');
  });

  it('produces an IBAN that passes the ISO 13616 check', () => {
    const iban = czechAccountToIban('1234567899/0100') ?? '';
    const numeric = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    expect([...numeric].reduce((rest, d) => (rest * 10 + Number(d)) % 97, 0)).toBe(1);
  });

  it('rejects a number that fails the mod-11 check or has no bank code', () => {
    expect(czechAccountToIban('1234567890/0100')).toBeNull();
    expect(czechAccountToIban('1234567899')).toBeNull();
  });

  it('groups by four', () => {
    expect(formatIban('CZ6508000000192000145399')).toBe('CZ65 0800 0000 1920 0014 5399');
  });
});
