import type { Invoice, InvoiceItem, Party } from './invoice';

export interface SavedInvoice extends Invoice {
  savedAt: string;
  paid: boolean;
}

export interface AppData {
  version: 1;
  customers: Party[];
  items: InvoiceItem[];
  invoices: SavedInvoice[];
}

export function emptyAppData(): AppData {
  return { version: 1, customers: [], items: [], invoices: [] };
}
