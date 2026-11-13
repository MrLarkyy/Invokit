import { describe, expect, it } from 'vitest';
import { fixtureInvoice, fixtureItem as item } from '../test/invoiceFixture';
import { invoiceProblem } from './invoiceValidation';

describe('invoiceProblem', () => {
  it('accepts a complete invoice', () => {
    expect(invoiceProblem(fixtureInvoice())).toBeNull();
  });

  it('asks for the customer and a described item', () => {
    const noCustomer = fixtureInvoice();
    noCustomer.customer = { ...noCustomer.customer, name: ' ' };
    expect(invoiceProblem(noCustomer)).toBe('Doplň název odběratele.');
    expect(invoiceProblem(fixtureInvoice({ items: [item('', '1', 100)] }))).toBe('Přidej aspoň jednu položku s popisem.');
  });

  it('checks the number, variable symbol and dates', () => {
    expect(invoiceProblem(fixtureInvoice({ number: '' }))).toBe('Doplň číslo faktury.');
    expect(invoiceProblem(fixtureInvoice({ variableSymbol: '12a' }))).toContain('Variabilní symbol');
    expect(invoiceProblem(fixtureInvoice({ dueDate: '2026-02-30' }))).toBe('Zadej platné datum splatnosti.');
    const payer = fixtureInvoice({ taxableSupplyDate: '' });
    expect(invoiceProblem(payer)).toBeNull();
    payer.supplier = { ...payer.supplier, vatPayer: true };
    expect(invoiceProblem(payer)).toBe('Zadej platné datum zdanitelného plnění.');
  });

  it('keeps items within the limits', () => {
    const many = Array.from({ length: 201 }, (_, i) => item(`p${i}`, '1', 100));
    expect(invoiceProblem(fixtureInvoice({ items: many }))).toBe('Faktura může mít nejvýš 200 položek.');
    expect(invoiceProblem(fixtureInvoice({ items: [item('big', '1000001', 1)] }))).toContain('Položka 1');
    expect(invoiceProblem(fixtureInvoice({ items: [item('big', '100', 100_000_000_000)] }))).toContain('Položka 1');
    expect(invoiceProblem(fixtureInvoice({ note: 'x'.repeat(2_001) }))).toContain('Poznámka');
  });
});
