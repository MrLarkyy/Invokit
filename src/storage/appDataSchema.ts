import { isIsoDate } from '../domain/dates';
import type { CatalogItem, Invoice, InvoiceItem, Party, SupplierSnapshot, VatRate } from '../domain/invoice';
import { itemTotalCents } from '../domain/invoiceTotals';
import { LIMITS } from '../domain/limits';
import { parseQuantity } from '../domain/money';
import type { SupplierProfile } from '../domain/supplierProfile';
import type { AppData } from './appData';
import { parseAppDataV1 } from './appDataV1';
import { migrateV1 } from './migrateV1';
import {
  asRecord,
  invalidData,
  isRecord,
  own,
  readArray,
  readBoolean,
  readInteger,
  readString,
  type JsonRecord,
} from './untrustedJson';

const ID = /^[A-Za-z0-9-]{1,64}$/;
const NOT_INVOO = 'Soubor není záloha Invoo.';

function matching(record: JsonRecord, key: string, path: string, pattern: RegExp): string {
  const value = readString(record, key, path, LIMITS.text);
  return pattern.test(value) ? value : invalidData(`${path}, ${key}`);
}

function readDate(record: JsonRecord, key: string, path: string): string {
  const value = readString(record, key, path, 10);
  return value === '' || isIsoDate(value) ? value : invalidData(`${path}, ${key}`);
}

function readNullableDate(record: JsonRecord, key: string, path: string): string | null {
  return own(record, key) === null ? null : readDate(record, key, path);
}

function readVatRate(record: JsonRecord, path: string): VatRate {
  const value = own(record, 'vatRate');
  return value === 0 || value === 12 || value === 21 ? value : invalidData(`${path}, vatRate`);
}

function readParty(value: unknown, path: string): Party {
  const r = asRecord(value, path);
  const text = (key: string) => readString(r, key, path, LIMITS.text);
  return {
    name: text('name'),
    street: text('street'),
    city: text('city'),
    zip: text('zip'),
    ico: text('ico'),
    dic: text('dic'),
  };
}

function readProfile(value: unknown): SupplierProfile {
  const path = 'profil dodavatele';
  const r = asRecord(value, path);
  return {
    party: readParty(own(r, 'party'), path),
    vatPayer: readBoolean(r, 'vatPayer', path),
    email: readString(r, 'email', path, LIMITS.text),
    registryNote: readString(r, 'registryNote', path, LIMITS.registryNote),
    accountPrefix: matching(r, 'accountPrefix', path, /^\d{0,6}$/),
    accountNumber: matching(r, 'accountNumber', path, /^\d{0,10}$/),
    bankCode: matching(r, 'bankCode', path, /^\d{0,4}$/),
  };
}

function readSnapshot(value: unknown, path: string): SupplierSnapshot {
  const r = asRecord(value, path);
  return {
    party: readParty(own(r, 'party'), path),
    vatPayer: readBoolean(r, 'vatPayer', path),
    email: readString(r, 'email', path, LIMITS.text),
    registryNote: readString(r, 'registryNote', path, LIMITS.registryNote),
    bankAccount: readString(r, 'bankAccount', path, LIMITS.text),
  };
}

function readQuantity(record: JsonRecord, path: string): string {
  const value = readString(record, 'quantity', path, 30);
  const canonical = parseQuantity(value);
  if (canonical !== value || Math.abs(Number(value)) > LIMITS.quantity) return invalidData(`${path}, quantity`);
  return value;
}

function readItem(value: unknown, path: string): InvoiceItem {
  const r = asRecord(value, path);
  const item: InvoiceItem = {
    id: matching(r, 'id', path, ID),
    description: readString(r, 'description', path, LIMITS.text),
    quantity: readQuantity(r, path),
    unit: readString(r, 'unit', path, LIMITS.text),
    unitPriceCents: readInteger(r, 'unitPriceCents', path, LIMITS.unitPriceCents),
    vatRate: readVatRate(r, path),
  };
  if (own(r, 'legacyLineCents') !== undefined) {
    item.legacyLineCents = readInteger(r, 'legacyLineCents', path, LIMITS.lineCents);
  }
  if (Math.abs(itemTotalCents(item)) > LIMITS.lineCents) return invalidData(`${path}, částka`);
  return item;
}

function readInvoice(value: unknown, path: string): Invoice {
  const r = asRecord(value, path);
  const items = readArray(r, 'items', path, LIMITS.itemsPerInvoice, `${path} má příliš mnoho položek.`);
  return {
    id: matching(r, 'id', path, ID),
    number: readString(r, 'number', path, LIMITS.text),
    issueDate: readDate(r, 'issueDate', path),
    dueDate: readDate(r, 'dueDate', path),
    taxableSupplyDate: readDate(r, 'taxableSupplyDate', path),
    variableSymbol: matching(r, 'variableSymbol', path, /^\d{0,10}$/),
    supplier: readSnapshot(own(r, 'supplier'), `${path}, dodavatel`),
    customer: readParty(own(r, 'customer'), `${path}, odběratel`),
    items: items.map((item, i) => readItem(item, `${path}, položka ${i + 1}`)),
    note: readString(r, 'note', path, LIMITS.note),
    paymentMethod: readString(r, 'paymentMethod', path, LIMITS.text),
    showQr: readBoolean(r, 'showQr', path),
    paid: readBoolean(r, 'paid', path),
    paidAt: readNullableDate(r, 'paidAt', path),
    savedAt: readString(r, 'savedAt', path, LIMITS.text),
  };
}

function readCatalogItem(value: unknown, path: string): CatalogItem {
  const r = asRecord(value, path);
  return {
    description: readString(r, 'description', path, LIMITS.text),
    unit: readString(r, 'unit', path, LIMITS.text),
    unitPriceCents: readInteger(r, 'unitPriceCents', path, LIMITS.unitPriceCents),
    vatRate: readVatRate(r, path),
  };
}

function rejectDuplicates(invoices: Invoice[]): void {
  const ids = new Set(invoices.map((i) => i.id));
  const numbers = new Set(invoices.map((i) => i.number));
  if (ids.size !== invoices.length || numbers.size !== invoices.length) {
    throw new Error('Záloha obsahuje dvě faktury se stejným číslem nebo id.');
  }
}

/** A version 2 object rebuilt field by field: unknown keys are dropped, nothing of the input is kept by reference. */
function readAppDataV2(value: unknown): AppData {
  const r = asRecord(value, 'záloha');
  const supplier = own(r, 'supplier');
  const invoices = readArray(r, 'invoices', 'záloha', LIMITS.invoices, 'Záloha má příliš mnoho faktur.');
  const customers = readArray(r, 'customers', 'záloha', LIMITS.customers, 'Záloha má příliš mnoho odběratelů.');
  const items = readArray(r, 'items', 'záloha', LIMITS.catalog, 'Záloha má příliš mnoho uložených položek.');
  const data: AppData = {
    version: 2,
    supplier: supplier === null ? null : readProfile(supplier),
    invoices: invoices.map((v, i) => readInvoice(v, `faktura ${i + 1}`)),
    customers: customers.map((v, i) => readParty(v, `odběratel ${i + 1}`)),
    items: items.map((v, i) => readCatalogItem(v, `uložená položka ${i + 1}`)),
    lastBackupAt: readNullableDate(r, 'lastBackupAt', 'záloha'),
  };
  rejectDuplicates(data.invoices);
  return data;
}

function parseJson(text: string): unknown {
  if (text.length > LIMITS.fileBytes) throw new Error('Soubor je příliš velký (nejvýš 5 MB).');
  try {
    // A byte order mark, as some editors save JSON, is not part of the data.
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as unknown;
  } catch {
    throw new Error('Soubor není platný JSON.');
  }
}

/**
 * Reads stored data or a backup file: version 2 as is, version 1 migrated (and then checked as version 2).
 * Throws a Czech message for anything else; the caller keeps its current data.
 */
export function parseAppData(text: string): AppData {
  const value = parseJson(text);
  if (!isRecord(value)) throw new Error(NOT_INVOO);
  const version = own(value, 'version');
  if (version === 2) return readAppDataV2(value);
  if (version === 1) return readAppDataV2(migrateV1(parseAppDataV1(value)));
  throw new Error(NOT_INVOO);
}

/** The stored new-invoice draft, or null when it is missing or not valid. */
export function parseDraft(text: string): Invoice | null {
  try {
    return readInvoice(parseJson(text), 'koncept');
  } catch {
    return null;
  }
}
