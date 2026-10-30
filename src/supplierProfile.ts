import type { AppData } from './appData';
import type { Invoice, Party } from './invoice';

/** The user's own details that repeat on every invoice. */
export interface SupplierProfile {
  supplier: Party;
  vatPayer: boolean;
  registryNote: string;
  bankAccount: string;
  paymentMethod: string;
}

export function profileOf(invoice: Invoice): SupplierProfile {
  return {
    supplier: { ...invoice.supplier },
    vatPayer: invoice.vatPayer,
    registryNote: invoice.registryNote,
    bankAccount: invoice.bankAccount,
    paymentMethod: invoice.paymentMethod,
  };
}

/** The remembered profile; backups made before it existed fall back to the newest saved invoice. */
export function savedProfile(data: AppData): SupplierProfile | null {
  if (data.supplier) return data.supplier;
  const newest = data.invoices.reduce<Invoice | null>(
    (best, i) => (!best || i.number.localeCompare(best.number) > 0 ? i : best),
    null,
  );
  return newest ? profileOf(newest) : null;
}

export function hasSupplier(invoice: Invoice): boolean {
  return invoice.supplier.name.trim() !== '';
}

/** Fills the supplier part of an invoice whose supplier is still empty; returns whether anything changed. */
export function prefillSupplier(invoice: Invoice, profile: SupplierProfile | null): boolean {
  if (!profile || hasSupplier(invoice)) return false;
  invoice.supplier = { ...profile.supplier };
  invoice.vatPayer = profile.vatPayer;
  invoice.registryNote = profile.registryNote;
  invoice.bankAccount = profile.bankAccount;
  invoice.paymentMethod = profile.paymentMethod;
  return true;
}
