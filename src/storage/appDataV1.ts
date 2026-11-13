import { LIMITS } from '../domain/limits';
import { asRecord, own, readArray, readBoolean, readString, type JsonRecord } from './untrustedJson';

// The schema Invokit wrote (`invokit.data.v1`, `invokit.draft.v1`, version 1 backups). Read only, to migrate.
// v1 had no length limits, so its strings are read up to the file size and clipped by the migration.

const ANY_TEXT = LIMITS.fileBytes;

export interface PartyV1 {
  name: string;
  street: string;
  city: string;
  ico: string;
  dic: string;
}

export interface InvoiceItemV1 {
  quantity: string;
  unit: string;
  description: string;
  unitPrice: string;
}

export interface InvoiceV1 {
  number: string;
  issueDate: string;
  dueDate: string;
  variableSymbol: string;
  bankAccount: string;
  paymentMethod: string;
  supplier: PartyV1;
  vatPayer: boolean;
  registryNote: string;
  customer: PartyV1;
  items: InvoiceItemV1[];
}

export interface SavedInvoiceV1 extends InvoiceV1 {
  savedAt: string;
  paid: boolean;
}

export interface SupplierProfileV1 {
  supplier: PartyV1;
  vatPayer: boolean;
  registryNote: string;
  bankAccount: string;
  paymentMethod: string;
}

export interface AppDataV1 {
  version: 1;
  customers: PartyV1[];
  items: InvoiceItemV1[];
  invoices: SavedInvoiceV1[];
  supplier?: SupplierProfileV1;
}

const text = (record: JsonRecord, key: string, path: string) => readString(record, key, path, ANY_TEXT, '');

function readPartyV1(value: unknown, path: string): PartyV1 {
  const r = asRecord(value, path);
  return {
    name: text(r, 'name', path),
    street: text(r, 'street', path),
    city: text(r, 'city', path),
    ico: text(r, 'ico', path),
    dic: text(r, 'dic', path),
  };
}

function readItemV1(value: unknown, path: string): InvoiceItemV1 {
  const r = asRecord(value, path);
  return {
    quantity: text(r, 'quantity', path),
    unit: text(r, 'unit', path),
    description: text(r, 'description', path),
    unitPrice: text(r, 'unitPrice', path),
  };
}

export function readInvoiceV1(value: unknown, path: string): InvoiceV1 {
  const r = asRecord(value, path);
  const items = readArray(r, 'items', path, LIMITS.itemsPerInvoice, `${path} má příliš mnoho položek.`);
  return {
    number: text(r, 'number', path),
    issueDate: text(r, 'issueDate', path),
    dueDate: text(r, 'dueDate', path),
    variableSymbol: text(r, 'variableSymbol', path),
    bankAccount: text(r, 'bankAccount', path),
    paymentMethod: text(r, 'paymentMethod', path),
    supplier: readPartyV1(own(r, 'supplier'), `${path}, dodavatel`),
    vatPayer: readBoolean(r, 'vatPayer', path, false),
    registryNote: text(r, 'registryNote', path),
    customer: readPartyV1(own(r, 'customer'), `${path}, odběratel`),
    items: items.map((item, i) => readItemV1(item, `${path}, položka ${i + 1}`)),
  };
}

function readSavedInvoiceV1(value: unknown, path: string): SavedInvoiceV1 {
  const r = asRecord(value, path);
  return { ...readInvoiceV1(r, path), savedAt: text(r, 'savedAt', path), paid: readBoolean(r, 'paid', path, false) };
}

function readProfileV1(value: unknown): SupplierProfileV1 {
  const path = 'profil dodavatele';
  const r = asRecord(value, path);
  return {
    supplier: readPartyV1(own(r, 'supplier'), path),
    vatPayer: readBoolean(r, 'vatPayer', path, false),
    registryNote: text(r, 'registryNote', path),
    bankAccount: text(r, 'bankAccount', path),
    paymentMethod: text(r, 'paymentMethod', path),
  };
}

/** A version 1 object rebuilt field by field; throws a Czech message on a wrong type or a count over the limits. */
export function parseAppDataV1(record: JsonRecord): AppDataV1 {
  const invoices = readArray(record, 'invoices', 'záloha', LIMITS.invoices, 'Záloha má příliš mnoho faktur.');
  const customers = readArray(record, 'customers', 'záloha', LIMITS.customers, 'Záloha má příliš mnoho odběratelů.');
  const items = readArray(record, 'items', 'záloha', LIMITS.catalog, 'Záloha má příliš mnoho uložených položek.');
  const supplier = own(record, 'supplier');
  return {
    version: 1,
    invoices: invoices.map((v, i) => readSavedInvoiceV1(v, `faktura ${i + 1}`)),
    customers: customers.map((v, i) => readPartyV1(v, `odběratel ${i + 1}`)),
    items: items.map((v, i) => readItemV1(v, `uložená položka ${i + 1}`)),
    ...(supplier === undefined || supplier === null ? {} : { supplier: readProfileV1(supplier) }),
  };
}
