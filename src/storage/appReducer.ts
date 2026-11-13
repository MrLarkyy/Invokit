import type { Invoice, Party } from '../domain/invoice';
import { deleteCatalogItem, deleteCustomer, deleteInvoice, saveInvoice, setPaid } from '../domain/records';
import type { SupplierProfile } from '../domain/supplierProfile';
import type { AppData } from './appData';

export type AppAction =
  | { type: 'invoice/save'; invoice: Invoice; now: string }
  | { type: 'invoice/delete'; id: string }
  | { type: 'invoice/setPaid'; id: string; paidAt: string | null }
  | { type: 'supplier/save'; supplier: SupplierProfile }
  | { type: 'customer/delete'; customer: Party }
  | { type: 'catalog/delete'; description: string }
  | { type: 'backup/exported'; at: string }
  | { type: 'backup/restore'; data: AppData }
  | { type: 'data/reload'; data: AppData };

/** Pure: the UI validates before dispatching, so a rejected save (a number already taken) leaves the data as is. */
export function appReducer(data: AppData, action: AppAction): AppData {
  switch (action.type) {
    case 'invoice/save':
      try {
        return saveInvoice(data, action.invoice, action.now);
      } catch {
        return data;
      }
    case 'invoice/delete':
      return deleteInvoice(data, action.id);
    case 'invoice/setPaid':
      return setPaid(data, action.id, action.paidAt);
    case 'supplier/save':
      return { ...data, supplier: structuredClone(action.supplier) };
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
