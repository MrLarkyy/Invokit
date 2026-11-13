import { describe, expect, it } from 'vitest';
import { invoiceProblem } from '../domain/invoiceValidation';
import { fixtureProfile } from '../test/invoiceFixture';
import { previewInvoice } from './previewInvoice';

describe('previewInvoice', () => {
  it('shows the profile and look being edited, as a copy', () => {
    const profile = fixtureProfile({
      appearance: { template: 'klasik', accent: '#1d4ed8', logoId: null, brandFooter: false },
    });
    const invoice = previewInvoice(profile, '2026-09-02');
    expect(invoice.appearance).toEqual(profile.appearance);
    expect(invoice.appearance).not.toBe(profile.appearance);
    expect(invoice.supplier.party.name).toBe('Ukázka s.r.o.');
    expect(invoice.supplier.bankAccount).toBe('19-2000145399/0800');
    expect(invoice).toMatchObject({ number: '2026-09-001', variableSymbol: '202609001', dueDate: '2026-09-16' });
    expect(invoiceProblem(invoice)).toBeNull();
  });

  it('uses VAT rates only for a VAT payer', () => {
    expect(previewInvoice(fixtureProfile(), '2026-09-02').items.map((i) => i.vatRate)).toEqual([0, 0, 0]);
    expect(previewInvoice(fixtureProfile({ vatPayer: true }), '2026-09-02').items.map((i) => i.vatRate)).toEqual([
      21, 12, 21,
    ]);
  });
});
