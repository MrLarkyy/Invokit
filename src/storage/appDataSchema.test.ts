import { describe, expect, it } from 'vitest';
import { fixtureInvoice, fixtureItem, fixtureProfile } from '../test/invoiceFixture';
import { emptyAppData, type AppData } from './appData';
import { parseAppData, parseDraft } from './appDataSchema';
import { backupText } from './backupFile';

const NOT_INVOO = 'Soubor není záloha Invoo.';

function validData(): AppData {
  return {
    ...emptyAppData(),
    supplier: fixtureProfile(),
    invoices: [fixtureInvoice()],
    customers: [fixtureInvoice().customer],
    items: [{ description: 'Vývoj', unit: 'h', unitPriceCents: 80_000, vatRate: 21 }],
    lastBackupAt: '2026-09-30',
  };
}

/** Valid data with one invoice field replaced by a raw JSON value. */
function withInvoiceField(key: string, value: unknown): string {
  const data = JSON.parse(JSON.stringify(validData())) as { invoices: Record<string, unknown>[] };
  data.invoices[0]![key] = value;
  return JSON.stringify(data);
}

function withItemField(key: string, value: unknown): string {
  const data = JSON.parse(JSON.stringify(validData())) as { invoices: { items: Record<string, unknown>[] }[] };
  data.invoices[0]!.items[0]![key] = value;
  return JSON.stringify(data);
}

describe('parseAppData', () => {
  it('round-trips a valid v2 export', () => {
    const data = validData();
    expect(parseAppData(JSON.stringify(data, null, 2))).toEqual(data);
    expect(parseAppData(JSON.stringify(emptyAppData()))).toEqual(emptyAppData());
    expect(parseAppData(String.fromCharCode(0xfeff) + JSON.stringify(data))).toEqual(data);
  });

  it('rejects files that are not an Invoo backup', () => {
    expect(() => parseAppData('not json')).toThrow('Soubor není platný JSON.');
    expect(() => parseAppData('[]')).toThrow(NOT_INVOO);
    expect(() => parseAppData('null')).toThrow(NOT_INVOO);
    expect(() => parseAppData('"text"')).toThrow(NOT_INVOO);
    expect(() => parseAppData(JSON.stringify({ ...emptyAppData(), version: 3 }))).toThrow(NOT_INVOO);
    expect(() => parseAppData(JSON.stringify({ ...emptyAppData(), version: '2' }))).toThrow(NOT_INVOO);
  });

  it('rejects a file over 10 MB before parsing it', () => {
    expect(() => parseAppData(' '.repeat(10 * 1024 * 1024 + 1))).toThrow('Soubor je příliš velký (nejvýš 10 MB).');
  });

  it('restores a compact backup of as much data as localStorage holds (about 5 million characters)', () => {
    const invoices = Array.from({ length: 2_700 }, (_, n) =>
      fixtureInvoice({ id: `f${n}`, number: `2026-${n}`, note: 'Poznámka '.repeat(220) }),
    );
    const text = backupText({ ...emptyAppData(), invoices });
    expect(text.length).toBeGreaterThan(5_242_880);
    expect(text).not.toContain('\n');
    expect(parseAppData(text).invoices).toHaveLength(2_700);
  });

  it('rejects counts over the limits', () => {
    const invoices = Array.from({ length: 10_001 }, () => ({}));
    expect(() => parseAppData(JSON.stringify({ ...emptyAppData(), invoices }))).toThrow(
      'Záloha má příliš mnoho faktur.',
    );
    const items = Array.from({ length: 201 }, (_, i) => fixtureItem(`p${i}`, '1', 100, 0, `p${i}`));
    expect(() => parseAppData(withInvoiceField('items', items))).toThrow('faktura 1 má příliš mnoho položek.');
    expect(() => parseAppData(withInvoiceField('note', 'x'.repeat(2_001)))).toThrow('příliš dlouhý text');
  });

  it('rejects wrong types and values field by field', () => {
    const invalid = 'Záloha obsahuje neplatný údaj';
    expect(() => parseAppData(withItemField('vatRate', 15))).toThrow(invalid);
    expect(() => parseAppData(withItemField('unitPriceCents', 1.5))).toThrow(invalid);
    expect(() => parseAppData(withItemField('unitPriceCents', '100'))).toThrow(invalid);
    expect(() => parseAppData(withItemField('unitPriceCents', 1e300))).toThrow(invalid);
    expect(() => parseAppData(withItemField('quantity', '1,5'))).toThrow(invalid);
    expect(() => parseAppData(withItemField('quantity', 2))).toThrow(invalid);
    expect(() => parseAppData(withInvoiceField('issueDate', '2026-13-45'))).toThrow(invalid);
    expect(() => parseAppData(withInvoiceField('variableSymbol', '12345678901'))).toThrow(invalid);
    expect(() => parseAppData(withInvoiceField('id', '<img src=x>'))).toThrow(invalid);
    expect(() => parseAppData(withInvoiceField('paid', 'yes'))).toThrow(invalid);
    expect(() => parseAppData(withInvoiceField('customer', null))).toThrow(invalid);
  });

  it('rejects a line total over the limit', () => {
    const data = validData();
    data.invoices[0]!.items = [fixtureItem('Velká', '100', 100_000_000_000)];
    expect(() => parseAppData(JSON.stringify(data))).toThrow('částka');
  });

  it('rejects two invoices with the same number', () => {
    const data = validData();
    data.invoices.push({ ...fixtureInvoice(), id: 'other' });
    expect(() => parseAppData(JSON.stringify(data))).toThrow('dvě faktury');
  });

  it('never pollutes a prototype and drops unknown keys', () => {
    // Written as text: assigning __proto__ in code would set the prototype instead of adding a key.
    const text = JSON.stringify(validData())
      .replace('"version":2', '"version":2,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}')
      .replace('"id":"2026-09-001"', '"__proto__":{"polluted":true},"extra":1,"id":"2026-09-001"');
    expect(text).toContain('"extra":1');
    const data = parseAppData(text);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(data)).toEqual(['version', 'supplier', 'invoices', 'customers', 'items', 'lastBackupAt']);
    expect(Object.getPrototypeOf(data.invoices[0])).toBe(Object.prototype);
    expect((data.invoices[0] as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects deep nesting in a known field', () => {
    const deep = '['.repeat(5_000) + ']'.repeat(5_000);
    expect(() => parseAppData(`{"version":2,"supplier":null,"invoices":[${deep}],"customers":[],"items":[]}`)).toThrow(
      'Záloha obsahuje neplatný údaj',
    );
  });
});

describe('parseDraft', () => {
  it('reads a valid draft and returns null for anything else', () => {
    const draft = fixtureInvoice({ items: [fixtureItem('', '1', 0)] });
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseDraft('{')).toBeNull();
    expect(parseDraft('{"id":"x"}')).toBeNull();
  });
});

describe('parseDraft with an amount still being typed', () => {
  it('keeps a draft whose line is over the limit (the editor refuses to save it)', () => {
    const draft = fixtureInvoice({ items: [fixtureItem('Velká', '1000000', 100_000_000_000)] });
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
    expect(() => parseAppData(JSON.stringify({ ...emptyAppData(), invoices: [draft] }))).toThrow('částka');
  });
});
