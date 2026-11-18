import type { CatalogItem, Invoice, Party } from '../domain/invoice';
import type { StoredLogo } from '../domain/logos';
import type { SupplierProfile } from '../domain/supplierProfile';

/** Everything Invoo keeps, as stored under `invoo.data.v3` and written to a backup file. */
export interface AppData {
  version: 3;
  supplier: SupplierProfile | null;
  invoices: Invoice[];
  customers: Party[];
  items: CatalogItem[];
  /** Each logo once; only the ones the profile or an invoice uses are kept. */
  logos: StoredLogo[];
  lastBackupAt: string | null;
}

export function emptyAppData(): AppData {
  return { version: 3, supplier: null, invoices: [], customers: [], items: [], logos: [], lastBackupAt: null };
}
