export type VatRate = 0 | 12 | 21;

/** Listed highest first, as the invoice prints them. */
export const VAT_RATES: readonly VatRate[] = [21, 12, 0];

export interface Party {
  name: string;
  street: string;
  city: string;
  zip: string;
  ico: string;
  dic: string;
}

/** The supplier as it was when the invoice was saved; later profile changes never alter an issued invoice. */
export interface SupplierSnapshot {
  party: Party;
  vatPayer: boolean;
  email: string;
  registryNote: string;
  /** "19-2000145399/0800", or the text a migrated invoice carried. */
  bankAccount: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  /** Canonical decimal ("1.5"), at most 6 decimals. */
  quantity: string;
  unit: string;
  /** Without VAT for a VAT payer. */
  unitPriceCents: number;
  vatRate: VatRate;
  /** Set by the v1 migration only, where the old float arithmetic gave a different line total. */
  legacyLineCents?: number;
}

export interface Invoice {
  id: string;
  number: string;
  /** ISO dates (YYYY-MM-DD). */
  issueDate: string;
  dueDate: string;
  /** DUZP; equals the issue date unless changed. */
  taxableSupplyDate: string;
  /** Digits only, at most 10. */
  variableSymbol: string;
  supplier: SupplierSnapshot;
  customer: Party;
  items: InvoiceItem[];
  note: string;
  paymentMethod: string;
  showQr: boolean;
  paid: boolean;
  /** Known only when marked paid in Invoo; invoices migrated as paid carry null. */
  paidAt: string | null;
  savedAt: string;
}

/** A remembered item: picking it in the editor fills unit, price and VAT rate. */
export interface CatalogItem {
  description: string;
  unit: string;
  unitPriceCents: number;
  vatRate: VatRate;
}

export function emptyParty(): Party {
  return { name: '', street: '', city: '', zip: '', ico: '', dic: '' };
}
