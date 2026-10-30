import { describe, expect, it } from 'vitest';
import { emptyAppData } from './appData';
import { parseAppData } from './appDataStorage';

describe('parseAppData', () => {
  it('reads back exported data', () => {
    expect(parseAppData(JSON.stringify(emptyAppData()))).toEqual(emptyAppData());
  });

  it('rejects files that are not a Fakturka backup', () => {
    expect(() => parseAppData('not json')).toThrow('Soubor není platný JSON.');
    expect(() => parseAppData('{"version":2,"customers":[],"items":[],"invoices":[]}')).toThrow(
      'Soubor není záloha Fakturky.',
    );
    expect(() => parseAppData('[]')).toThrow('Soubor není záloha Fakturky.');
  });
});
