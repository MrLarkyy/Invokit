import { addDays } from '../domain/dates';
import type { Invoice, InvoiceItem, VatRate } from '../domain/invoice';
import { variableSymbolFor } from '../domain/invoiceNumber';
import { snapshotOf, type SupplierProfile } from '../domain/supplierProfile';

function sampleItem(n: number, quantity: string, unit: string, unitPriceCents: number, vatRate: VatRate): InvoiceItem {
  return { id: `ukazka-${n}`, description: `Ukázková položka ${n}`, quantity, unit, unitPriceCents, vatRate };
}

/**
 * The invoice the Settings preview shows: the supplier and look as they are being edited, an invented customer and
 * three invented items, so every change of template, accent, logo or footer can be seen before it is saved.
 */
export function previewInvoice(profile: SupplierProfile, today: string): Invoice {
  const payer = profile.vatPayer;
  const number = `${today.slice(0, 8)}001`;
  return {
    id: 'ukazka',
    number,
    issueDate: today,
    dueDate: addDays(today, 14),
    taxableSupplyDate: today,
    variableSymbol: variableSymbolFor(number),
    supplier: snapshotOf(profile),
    appearance: { ...profile.appearance },
    customer: {
      name: 'Ukázkový odběratel s.r.o.',
      street: 'Smyšlená 12',
      city: 'Brno',
      zip: '602 00',
      ico: '',
      dic: '',
    },
    items: [
      sampleItem(1, '10', 'h', 80_000, payer ? 21 : 0),
      sampleItem(2, '1', 'ks', 250_000, payer ? 12 : 0),
      sampleItem(3, '2', 'ks', 15_000, payer ? 21 : 0),
    ],
    note: '',
    paymentMethod: 'Převodem',
    showQr: true,
    paid: false,
    paidAt: null,
    savedAt: '',
  };
}
