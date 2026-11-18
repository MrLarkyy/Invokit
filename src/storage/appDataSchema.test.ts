import { describe, expect, it } from 'vitest';
import { FIXTURE_LOGO, fixtureInvoice, fixtureItem, fixtureProfile } from '../test/invoiceFixture';
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
  it('round-trips a valid v3 export', () => {
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
    expect(() => parseAppData(JSON.stringify({ ...emptyAppData(), version: 4 }))).toThrow(NOT_INVOO);
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
      .replace('"version":3', '"version":3,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}')
      .replace('"id":"2026-09-001"', '"__proto__":{"polluted":true},"extra":1,"id":"2026-09-001"');
    expect(text).toContain('"extra":1');
    const data = parseAppData(text);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(data)).toEqual([
      'version',
      'supplier',
      'invoices',
      'customers',
      'items',
      'logos',
      'lastBackupAt',
    ]);
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

type Raw = Record<string, unknown> & { supplier: Record<string, unknown>; invoices: Record<string, unknown>[] };

/** Valid v3 data whose profile and one invoice print a stored logo. */
function dataWithLogo(): AppData {
  const data = validData();
  data.logos = [{ id: 'logo-1', dataUrl: FIXTURE_LOGO }];
  data.supplier!.appearance = { template: 'minimal', accent: '#1d4ed8', logoId: 'logo-1', brandFooter: true };
  data.invoices[0]!.appearance = { template: 'klasik', accent: '#ff5b1f', logoId: 'logo-1', brandFooter: false };
  return data;
}

/** The valid data as raw JSON, changed by `change`, as text. */
function changed(change: (raw: Raw) => void): string {
  const raw = JSON.parse(JSON.stringify(dataWithLogo())) as Raw;
  change(raw);
  return JSON.stringify(raw);
}

const invoiceLook = (raw: Raw) => raw.invoices[0]!.appearance as Record<string, unknown>;

describe('schema version 3', () => {
  it('reads a v2 file with every field as it was, the default look and no logos', () => {
    const v3 = validData();
    const raw = JSON.parse(JSON.stringify(v3)) as Raw;
    raw.version = 2;
    delete raw.logos;
    delete raw.supplier.appearance;
    for (const invoice of raw.invoices) delete invoice.appearance;
    const read = parseAppData(JSON.stringify(raw));
    expect(read).toEqual(v3);
    expect(read.version).toBe(3);
    expect(read.invoices[0]!.appearance).toEqual({ template: 'invoo', accent: null, logoId: null, brandFooter: true });
    expect(read.supplier!.appearance).toEqual({ template: 'invoo', accent: null, logoId: null, brandFooter: true });
  });

  it('gives a v2 file the default look even when it carries one', () => {
    const text = changed((raw) => {
      raw.version = 2;
      invoiceLook(raw).template = 'evil';
    });
    expect(parseAppData(text).invoices[0]!.appearance).toEqual(validData().invoices[0]!.appearance);
  });

  it('round-trips a v3 backup with a logo', () => {
    const data = dataWithLogo();
    expect(parseAppData(backupText(data))).toEqual(data);
  });

  it('refuses a hostile look or logo with a Czech message', () => {
    const at = (path: string) => `Záloha obsahuje neplatný údaj: ${path}.`;
    const cases: [(raw: Raw) => void, string][] = [
      [(raw) => (invoiceLook(raw).template = 'evil'), at('faktura 1, vzhled, template')],
      [(raw) => (invoiceLook(raw).template = '__proto__'), at('faktura 1, vzhled, template')],
      [(raw) => (invoiceLook(raw).accent = '#FFF'), at('faktura 1, vzhled, accent')],
      [(raw) => (invoiceLook(raw).accent = '#ff5b1f;background:url(x)'), at('faktura 1, vzhled, accent')],
      [(raw) => (invoiceLook(raw).logoId = 'logo-9'), at('faktura 1, vzhled, logoId')],
      [(raw) => (invoiceLook(raw).logoId = '../logo'), at('faktura 1, vzhled, logoId')],
      [(raw) => (invoiceLook(raw).brandFooter = 'yes'), at('faktura 1, vzhled, brandFooter')],
      [(raw) => delete raw.invoices[0]!.appearance, at('faktura 1, vzhled')],
      [
        (raw) => ((raw.supplier.appearance as Record<string, unknown>).logoId = 'logo-2'),
        at('profil dodavatele, vzhled, logoId'),
      ],
      [(raw) => delete raw.logos, at('záloha, logos')],
      [
        (raw) => (raw.logos = [{ id: 'logo-1', dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }]),
        at('logo 1, dataUrl'),
      ],
      [(raw) => (raw.logos = [{ id: 'logo-1', dataUrl: 'https://example.invalid/logo.png' }]), at('logo 1, dataUrl')],
      [
        (raw) => (raw.logos = [{ id: 'logo-1', dataUrl: FIXTURE_LOGO + 'A'.repeat(50_000) }]),
        'příliš dlouhý text: logo 1, dataUrl',
      ],
      [(raw) => (raw.logos = [{ id: 'x', dataUrl: FIXTURE_LOGO }]), at('logo 1, id')],
      [
        (raw) =>
          (raw.logos = [
            { id: 'logo-1', dataUrl: FIXTURE_LOGO },
            { id: 'logo-1', dataUrl: FIXTURE_LOGO },
          ]),
        'dvě loga',
      ],
      [
        (raw) => (raw.logos = Array.from({ length: 21 }, (_, i) => ({ id: `logo-${i + 1}`, dataUrl: FIXTURE_LOGO }))),
        'Záloha má příliš mnoho log.',
      ],
    ];
    for (const [change, message] of cases) expect(() => parseAppData(changed(change)), message).toThrow(message);
  });

  it('drops prototype keys inside a look', () => {
    const text = backupText(dataWithLogo()).replace(
      '"template":"klasik"',
      '"__proto__":{"polluted":true},"template":"klasik"',
    );
    expect(text).toContain('__proto__');
    const look = parseAppData(text).invoices[0]!.appearance;
    expect(Object.keys(look)).toEqual(['template', 'accent', 'logoId', 'brandFooter']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((look as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('leaves out logos nothing uses', () => {
    const text = changed((raw) => {
      (raw.logos as unknown[]).push({ id: 'logo-2', dataUrl: FIXTURE_LOGO });
      invoiceLook(raw).logoId = null;
      (raw.supplier.appearance as Record<string, unknown>).logoId = 'logo-2';
    });
    expect(parseAppData(text).logos).toEqual([{ id: 'logo-2', dataUrl: FIXTURE_LOGO }]);
  });
});

describe('parseDraft before version 3', () => {
  it('opens a draft without a look with the default one, and refuses an invalid look', () => {
    const draft = fixtureInvoice({
      appearance: { template: 'minimal', accent: null, logoId: null, brandFooter: true },
    });
    const raw = JSON.parse(JSON.stringify(draft)) as Record<string, unknown>;
    delete raw.appearance;
    expect(parseDraft(JSON.stringify(raw))).toEqual(fixtureInvoice());
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseDraft(JSON.stringify({ ...draft, appearance: { ...draft.appearance, template: 'evil' } }))).toBeNull();
  });
});
