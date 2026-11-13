import type { Invoice, Party } from '../domain/invoice';
import { pruneLogos, saveSupplierLogo } from '../domain/logos';
import { deleteCatalogItem, deleteCustomer, deleteInvoice, saveInvoice, setPaid } from '../domain/records';
import type { SupplierProfile } from '../domain/supplierProfile';
import type { AppData } from './appData';

export type AppAction =
  | { type: 'invoice/save'; invoice: Invoice; now: string }
  | { type: 'invoice/delete'; id: string }
  | { type: 'invoice/setPaid'; id: string; paidAt: string | null }
  /** `logo` is the data URL of the profile's logo, null for none; the profile's own logoId is replaced. */
  | { type: 'supplier/save'; supplier: SupplierProfile; logo: string | null }
  | { type: 'customer/delete'; customer: Party }
  | { type: 'catalog/delete'; description: string }
  | { type: 'backup/exported'; at: string }
  | { type: 'backup/restore'; data: AppData }
  | { type: 'data/reload'; data: AppData };

/** An invoice naming a logo that is no longer stored (removed in another tab) is saved without one. */
function withKnownLogo(data: AppData, invoice: Invoice): Invoice {
  const { logoId } = invoice.appearance;
  if (logoId === null || data.logos.some((logo) => logo.id === logoId)) return invoice;
  return { ...invoice, appearance: { ...invoice.appearance, logoId: null } };
}

/** Pure: the UI validates before dispatching, so a rejected save (a number already taken) leaves the data as is. */
export function appReducer(data: AppData, action: AppAction): AppData {
  switch (action.type) {
    case 'invoice/save':
      try {
        return pruneLogos(saveInvoice(data, withKnownLogo(data, action.invoice), action.now));
      } catch {
        return data;
      }
    case 'invoice/delete':
      return pruneLogos(deleteInvoice(data, action.id));
    case 'invoice/setPaid':
      return setPaid(data, action.id, action.paidAt);
    case 'supplier/save':
      try {
        return saveSupplierLogo(data, action.supplier, action.logo);
      } catch {
        return data;
      }
    case 'customer/delete':
      return deleteCustomer(data, action.customer);
    case 'catalog/delete':
      return deleteCatalogItem(data, action.description);
    case 'backup/exported':
      return { ...data, lastBackupAt: action.at };
    case 'backup/restore':
    case 'data/reload':
      return action.data;
  }
}
