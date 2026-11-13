import { describe, expect, it } from 'vitest';
import { buildSpayd } from '../czech/spayd';
import { fixtureInvoice, fixtureItem as item } from '../test/invoiceFixture';
import { computeTotals } from './invoiceTotals';
import { paymentFor, paymentResult } from './invoicePayment';

const payer = (items = [item('high', '1', 10_000, 21), item('low', '1', 3_333, 12), item('zero', '1', 1_000, 0)]) =>
  fixtureInvoice({ items, supplier: { ...fixtureInvoice().supplier, vatPayer: true } });

describe('paymentFor', () => {
  it('builds the SPD string from the shared total', () => {
    const invoice = payer();
    const request = paymentFor(invoice);
    expect(request && buildSpayd(request)).toBe(
      'SPD*1.0*ACC:CZ6508000000192000145399*AM:168.33*CC:CZK*DT:20260916*X-VS:202609001*MSG:Faktura 2026-09-001',
    );
    expect(request?.amountCents).toBe(computeTotals(invoice.items, true).totalCents);
  });

  it('gives no QR for an invalid account, with the reason', () => {
    const invoice = fixtureInvoice({ supplier: { ...fixtureInvoice().supplier, bankAccount: '1234567890/0100' } });
    expect(paymentFor(invoice)).toBeNull();
    expect(paymentResult(invoice).problem).toBe('Pro QR platbu doplň platné číslo účtu.');
  });

  it('gives no QR when it is switched off, without a reason', () => {
    expect(paymentResult(fixtureInvoice({ showQr: false }))).toEqual({ request: null, problem: null });
  });

  it('gives no QR for a zero total or one over 9 999 999,99 Kč', () => {
    expect(paymentFor(fixtureInvoice({ items: [item('free', '1', 0)] }))).toBeNull();
    expect(paymentFor(fixtureInvoice({ items: [item('big', '1', 1_000_000_000)] }))).toBeNull();
    expect(paymentFor(fixtureInvoice({ items: [item('max', '1', 999_999_999)] }))?.amountCents).toBe(999_999_999);
  });
});
