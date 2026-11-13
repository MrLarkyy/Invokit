import { czechAccountToIban, isValidIban } from '../czech/czechIban';
import type { PaymentRequest } from '../czech/spayd';
import type { Invoice } from './invoice';
import { computeTotals } from './invoiceTotals';

// SPD AM holds at most 10 characters: "9999999.99".
const MAX_QR_CENTS = 999_999_999;

export type PaymentResult = { request: PaymentRequest; problem: null } | { request: null; problem: string | null };

/** The QR Platba request of an invoice, or why there is none (problem null when the QR is just switched off). */
export function paymentResult(invoice: Invoice): PaymentResult {
  if (!invoice.showQr) return { request: null, problem: null };
  const iban = czechAccountToIban(invoice.supplier.bankAccount);
  if (!iban || !isValidIban(iban)) return { request: null, problem: 'Pro QR platbu doplň platné číslo účtu.' };
  const amountCents = computeTotals(invoice.items, invoice.supplier.vatPayer).totalCents;
  if (amountCents <= 0) return { request: null, problem: 'QR platba se ukáže, až bude částka k úhradě kladná.' };
  if (amountCents > MAX_QR_CENTS) return { request: null, problem: 'Částka je pro QR platbu příliš vysoká.' };
  return {
    request: {
      iban,
      amountCents,
      variableSymbol: invoice.variableSymbol,
      dueDate: invoice.dueDate,
      message: `Faktura ${invoice.number}`,
    },
    problem: null,
  };
}

export function paymentFor(invoice: Invoice): PaymentRequest | null {
  return paymentResult(invoice).request;
}
