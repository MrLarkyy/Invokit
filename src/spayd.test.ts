import { describe, expect, it } from 'vitest';
import { buildSpayd } from './spayd';

describe('buildSpayd', () => {
  it('builds the payment string of the sample invoice', () => {
    expect(
      buildSpayd({
        iban: 'CZ9501000000001234567899',
        amountCents: 12_240_000,
        variableSymbol: '202609001',
        dueDate: '2026-09-16',
        message: 'Faktura 2026-09-001',
      }),
    ).toBe(
      'SPD*1.0*ACC:CZ9501000000001234567899*AM:122400.00*CC:CZK*DT:20260916*X-VS:202609001*MSG:Faktura 2026-09-001',
    );
  });

  it('drops diacritics and separators from the message and skips empty fields', () => {
    expect(
      buildSpayd({ iban: 'CZ00', amountCents: 100, variableSymbol: '', dueDate: '', message: 'Úhrada*vývoj' }),
    ).toBe('SPD*1.0*ACC:CZ00*AM:1.00*CC:CZK*MSG:Uhrada vyvoj');
  });
});
