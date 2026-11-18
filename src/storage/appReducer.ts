import type { Invoice, Party } from '../domain/invoice';
import { pruneLogos, saveSupplierLogo } from '../domain/logos';
import { deleteCatalogItem, deleteCustomer, deleteInvoice, saveInvoice, setPaid } from '../domain/records';
import type { SupplierProfile } from '../domain/supplierProfile';
import type { AppData } from './appData';

export type AppAction =
  /** `create`: a new invoice, refused when its number or id is taken; otherwise it replaces the one with its id. */
  | { type: 'invoice/save'; invoice: Invoice; now: string; create: boolean }
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

/** Said when an action names an invoice that is no longer in the data: another tab deleted it meanwhile. */
export const INVOICE_GONE = 'Tahle faktura už mezi uloženými není, nejspíš ji mezitím smazala jiná záložka.';

function known(data: AppData, id: string): AppData {
  if (!data.invoices.some((invoice) => invoice.id === id)) throw new Error(INVOICE_GONE);
  return data;
}

/** What an action did: the new data, or the same data and the Czech reason it could not be applied. */
export interface AppliedAction {
  data: AppData;
  problem: string | null;
}

function change(data: AppData, action: AppAction): AppData {
  switch (action.type) {
    case 'invoice/save':
      return pruneLogos(saveInvoice(data, withKnownLogo(data, action.invoice), action.now, action.create));
    case 'invoice/delete':
      return pruneLogos(deleteInvoice(known(data, action.id), action.id));
    case 'invoice/setPaid':
      return setPaid(known(data, action.id), action.id, action.paidAt);
    case 'supplier/save':
      return saveSupplierLogo(data, action.supplier, action.logo);
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

/**
 * Pure. The UI validates before dispatching, but against the data it showed: the same action may meet other data
 * (another tab stored an invoice with that number, deleted the invoice, or took the last free logo slot). Then the
 * data is left as it is and the reason is reported.
 */
export function applyAppAction(data: AppData, action: AppAction): AppliedAction {
  try {
    return { data: change(data, action), problem: null };
  } catch (error) {
    return { data, problem: error instanceof Error ? error.message : 'Změnu se nepodařilo provést.' };
  }
}

export function appReducer(data: AppData, action: AppAction): AppData {
  return applyAppAction(data, action).data;
}
