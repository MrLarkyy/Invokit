import type { CatalogItem, Invoice, Party } from '../domain/invoice';
import type { SupplierProfile } from '../domain/supplierProfile';

/** Everything Invoo keeps, as stored under `invoo.data.v2` and written to a backup file. */
export interface AppData {
  version: 2;
  supplier: SupplierProfile | null;
  invoices: Invoice[];
  customers: Party[];
  items: CatalogItem[];
  lastBackupAt: string | null;
}

export function emptyAppData(): AppData {
  return { version: 2, supplier: null, invoices: [], customers: [], items: [], lastBackupAt: null };
}
