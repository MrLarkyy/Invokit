import type { Invoice, InvoiceItem, Party } from './invoice';
import type { SupplierProfile } from './supplierProfile';

export interface SavedInvoice extends Invoice {
  savedAt: string;
  paid: boolean;
}

export interface AppData {
  version: 1;
  customers: Party[];
  items: InvoiceItem[];
  invoices: SavedInvoice[];
  /** Absent in backups made before the profile was remembered. */
  supplier?: SupplierProfile;
}

export function emptyAppData(): AppData {
  return { version: 1, customers: [], items: [], invoices: [] };
}
