import { addDays, toIsoDate } from './dates';
import type { Invoice } from './invoice';
import { nextInvoiceNumber, variableSymbolFor } from './invoiceNumber';

const DUE_DAYS = 14;

/** A fresh invoice that keeps the supplier, bank account and customer of the previous one. */
export function newInvoice(previous: Invoice | null, today = toIsoDate(new Date())): Invoice {
  const number = nextInvoiceNumber(previous?.number ?? '', today);
  const emptyParty = { name: '', street: '', city: '', ico: '', dic: '' };
  return {
    number,
    issueDate: today,
    dueDate: addDays(today, DUE_DAYS),
    variableSymbol: variableSymbolFor(number),
    bankAccount: previous?.bankAccount ?? '',
    paymentMethod: previous?.paymentMethod ?? 'Převodem',
    supplier: previous?.supplier ?? { ...emptyParty },
    vatPayer: previous?.vatPayer ?? false,
    registryNote: previous?.registryNote ?? 'Fyzická osoba zapsaná v živnostenském rejstříku.',
    customer: previous?.customer ?? { ...emptyParty },
    items: previous?.items.map((item) => ({ ...item })) ?? [
      { quantity: '1', unit: 'ks', description: '', unitPrice: '' },
    ],
  };
}
