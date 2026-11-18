import { describe, expect, it } from 'vitest';
import { fixtureInvoice, fixtureProfile } from '../test/invoiceFixture';
import { defaultAppearance, type InvoiceAppearance } from './invoiceAppearance';
import { createBlankInvoice, duplicateInvoice } from './newInvoice';

let row = 0;
const newId = () => `r${++row}`;
const look: InvoiceAppearance = { template: 'minimal', accent: '#1d4ed8', logoId: 'logo-3', brandFooter: false };

describe('createBlankInvoice', () => {
  it('takes the look of the profile as a copy', () => {
    const supplier = fixtureProfile({ appearance: { ...look } });
    const blank = createBlankInvoice({ invoices: [], supplier }, '2026-09-02', newId);
    expect(blank.appearance).toEqual(look);
    supplier.appearance.template = 'klasik';
    expect(blank.appearance.template).toBe('minimal');
  });

  it('uses the default look without a profile', () => {
    expect(createBlankInvoice({ invoices: [], supplier: null }, '2026-09-02', newId).appearance).toEqual(
      defaultAppearance(),
    );
  });
});

describe('duplicateInvoice', () => {
  it('keeps the template of the source and takes accent, logo and footer from the profile', () => {
    const source = fixtureInvoice({
      appearance: { template: 'klasik', accent: '#ff0000', logoId: 'logo-1', brandFooter: true },
    });
    const copy = duplicateInvoice(
      source,
      { invoices: [source], supplier: fixtureProfile({ appearance: look }) },
      '2026-10-01',
      newId,
    );
    expect(copy.appearance).toEqual({ template: 'klasik', accent: '#1d4ed8', logoId: 'logo-3', brandFooter: false });
    expect(source.appearance.template).toBe('klasik');
  });
});
