import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../storage/appData';
import { parseAppData } from '../storage/appDataSchema';
import { fixtureInvoice, fixtureItem as item } from '../test/invoiceFixture';
import { computeTotals } from './invoiceTotals';
import { findInvoiceProblem, invoiceProblem, isCompleteSupplier } from './invoiceValidation';

const payerSupplier = () => {
  const supplier = fixtureInvoice().supplier;
  return { ...supplier, vatPayer: true, party: { ...supplier.party, dic: 'CZ27410587' } };
};

describe('invoiceProblem', () => {
  it('accepts a complete invoice', () => {
    expect(invoiceProblem(fixtureInvoice())).toBeNull();
  });

  it('asks for the customer and a described item, and points at the field', () => {
    const noCustomer = fixtureInvoice();
    noCustomer.customer = { ...noCustomer.customer, name: ' ' };
    expect(findInvoiceProblem(noCustomer)).toEqual({ message: 'Doplň název odběratele.', field: 'customerName' });
    expect(invoiceProblem(fixtureInvoice({ items: [item('', '1', 100)] }))).toBe(
      'Přidej aspoň jednu položku s popisem.',
    );
  });

  it('checks the number, variable symbol and dates', () => {
    expect(invoiceProblem(fixtureInvoice({ number: '' }))).toBe('Doplň číslo faktury.');
    expect(invoiceProblem(fixtureInvoice({ variableSymbol: '12a' }))).toContain('Variabilní symbol');
    expect(invoiceProblem(fixtureInvoice({ dueDate: '2026-02-30' }))).toBe('Zadej platné datum splatnosti.');
    const payer = fixtureInvoice({ taxableSupplyDate: '' });
    expect(invoiceProblem(payer)).toBeNull();
    payer.supplier = payerSupplier();
    expect(invoiceProblem(payer)).toBe('Zadej platné datum zdanitelného plnění.');
  });

  it('keeps items within the limits and names the row', () => {
    const many = Array.from({ length: 201 }, (_, i) => item(`p${i}`, '1', 100));
    expect(invoiceProblem(fixtureInvoice({ items: many }))).toBe('Faktura může mít nejvýš 200 položek.');
    const qty = fixtureInvoice({ items: [item('big', '1000001', 1)] });
    expect(findInvoiceProblem(qty)).toMatchObject({ field: 'item', itemId: 'i-big' });
    expect(invoiceProblem(fixtureInvoice({ items: [item('big', '100', 100_000_000_000)] }))).toContain('rozsah');
    expect(invoiceProblem(fixtureInvoice({ note: 'x'.repeat(2_001) }))).toContain('Poznámka');
  });
});

describe('supplier on the invoice', () => {
  it('needs name, street, city and IČO, and DIČ for a VAT payer', () => {
    const missing = fixtureInvoice();
    missing.supplier = { ...missing.supplier, party: { ...missing.supplier.party, ico: '' } };
    expect(findInvoiceProblem(missing)).toEqual({ message: 'Doplň své údaje v nastavení.', field: 'supplier' });
    const payerWithoutDic = fixtureInvoice();
    payerWithoutDic.supplier = { ...payerWithoutDic.supplier, vatPayer: true };
    expect(isCompleteSupplier(payerWithoutDic.supplier)).toBe(false);
    expect(invoiceProblem(payerWithoutDic)).toBe('Doplň své údaje v nastavení.');
    expect(isCompleteSupplier(payerSupplier())).toBe(true);
  });
});

describe('the total', () => {
  it('allows a discount line but refuses a total that is not positive', () => {
    const discounted = fixtureInvoice({ items: [item('Vývoj', '10', 80_000), item('Sleva', '-1', 10_000)] });
    expect(invoiceProblem(discounted)).toBeNull();
    const zero = fixtureInvoice({ items: [item('Vývoj', '1', 100), item('Sleva', '-1', 100)] });
    expect(findInvoiceProblem(zero)).toEqual({ message: 'Součet faktury musí být kladný.', field: 'total' });
  });

  it('restores a backup with a negative quantity, but the editor refuses to save it', () => {
    const backup = { ...emptyAppData(), invoices: [fixtureInvoice({ items: [item('Vratka', '-5', 80_000)] })] };
    const restored = parseAppData(JSON.stringify(backup)).invoices[0]!;
    expect(computeTotals(restored.items, false).totalCents).toBe(-400_000);
    expect(invoiceProblem(restored)).toBe('Součet faktury musí být kladný.');
  });
});
