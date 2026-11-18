import { isIsoDate } from '../domain/dates';
import type { CatalogItem, Invoice, InvoiceItem, Party, SupplierSnapshot, VatRate } from '../domain/invoice';
import { defaultAppearance, isAccent, isTemplateId, type InvoiceAppearance } from '../domain/invoiceAppearance';
import { itemTotalCents } from '../domain/invoiceTotals';
import { FILE_TOO_LARGE, LIMITS } from '../domain/limits';
import { isLogoDataUrl } from '../domain/logoImage';
import { LOGO_ID, pruneLogos, type StoredLogo } from '../domain/logos';
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

/** The look of an invoice or profile: required (v3), always the default (v2), the default when missing (draft). */
type AppearanceMode = 'required' | 'default' | 'optional';

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

function readAppearance(record: JsonRecord, path: string, mode: AppearanceMode): InvoiceAppearance {
  const value = own(record, 'appearance');
  if (mode === 'default' || (mode === 'optional' && value === undefined)) return defaultAppearance();
  const at = `${path}, vzhled`;
  const r = asRecord(value, at);
  const template = own(r, 'template');
  const accent = own(r, 'accent');
  const logoId = own(r, 'logoId');
  return {
    template: isTemplateId(template) ? template : invalidData(`${at}, template`),
    accent: accent === null || isAccent(accent) ? accent : invalidData(`${at}, accent`),
    logoId:
      logoId === null || (typeof logoId === 'string' && LOGO_ID.test(logoId)) ? logoId : invalidData(`${at}, logoId`),
    brandFooter: readBoolean(r, 'brandFooter', at),
  };
}

function readProfile(value: unknown, mode: AppearanceMode): SupplierProfile {
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
    appearance: readAppearance(r, path, mode),
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

function readItem(value: unknown, path: string, checkLine: boolean): InvoiceItem {
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
  if (checkLine && Math.abs(itemTotalCents(item)) > LIMITS.lineCents) return invalidData(`${path}, částka`);
  return item;
}

// A draft may hold a line over the limit while it is typed; the editor refuses to save it, the draft still loads.
function readInvoice(value: unknown, path: string, mode: AppearanceMode): Invoice {
  const isDraft = mode === 'optional';
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
    appearance: readAppearance(r, path, mode),
    customer: readParty(own(r, 'customer'), `${path}, odběratel`),
    items: items.map((item, i) => readItem(item, `${path}, položka ${i + 1}`, !isDraft)),
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

function readLogo(value: unknown, path: string): StoredLogo {
  const r = asRecord(value, path);
  const id = matching(r, 'id', path, LOGO_ID);
  const dataUrl = readString(r, 'dataUrl', path, LIMITS.logoChars);
  return { id, dataUrl: isLogoDataUrl(dataUrl) ? dataUrl : invalidData(`${path}, dataUrl`) };
}

/** Every logo id is unique, and every one the profile or an invoice names is in the file. */
function rejectUnknownLogos(data: AppData): void {
  const ids = new Set(data.logos.map((logo) => logo.id));
  if (ids.size !== data.logos.length) throw new Error('Záloha obsahuje dvě loga se stejným id.');
  const check = (appearance: InvoiceAppearance, path: string) => {
    if (appearance.logoId !== null && !ids.has(appearance.logoId)) invalidData(`${path}, vzhled, logoId`);
  };
  if (data.supplier) check(data.supplier.appearance, 'profil dodavatele');
  data.invoices.forEach((invoice, i) => check(invoice.appearance, `faktura ${i + 1}`));
}

/**
 * A version 3 object (or a version 2 one, which gets the default look and no logos) rebuilt field by field: unknown
 * keys are dropped, nothing of the input is kept by reference, and logos nothing uses are left out.
 */
function readAppData(value: unknown, version: 2 | 3): AppData {
  const mode: AppearanceMode = version === 3 ? 'required' : 'default';
  const r = asRecord(value, 'záloha');
  const supplier = own(r, 'supplier');
  const invoices = readArray(r, 'invoices', 'záloha', LIMITS.invoices, 'Záloha má příliš mnoho faktur.');
  const customers = readArray(r, 'customers', 'záloha', LIMITS.customers, 'Záloha má příliš mnoho odběratelů.');
  const items = readArray(r, 'items', 'záloha', LIMITS.catalog, 'Záloha má příliš mnoho uložených položek.');
  const logos = version === 3 ? readArray(r, 'logos', 'záloha', LIMITS.logos, 'Záloha má příliš mnoho log.') : [];
  const data: AppData = {
    version: 3,
    supplier: supplier === null ? null : readProfile(supplier, mode),
    invoices: invoices.map((v, i) => readInvoice(v, `faktura ${i + 1}`, mode)),
    customers: customers.map((v, i) => readParty(v, `odběratel ${i + 1}`)),
    items: items.map((v, i) => readCatalogItem(v, `uložená položka ${i + 1}`)),
    logos: logos.map((v, i) => readLogo(v, `logo ${i + 1}`)),
    lastBackupAt: readNullableDate(r, 'lastBackupAt', 'záloha'),
  };
  rejectDuplicates(data.invoices);
  rejectUnknownLogos(data);
  return pruneLogos(data);
}

function parseJson(text: string): unknown {
  if (text.length > LIMITS.fileBytes) throw new Error(FILE_TOO_LARGE);
  try {
    // A byte order mark, as some editors save JSON, is not part of the data.
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as unknown;
  } catch {
    throw new Error('Soubor není platný JSON.');
  }
}

/**
 * Reads stored data or a backup file as version 3: version 3 as is, version 2 with the default look (Invoo, no
 * accent, no logo, footer on), version 1 migrated (and then checked as version 3). Throws a Czech message for
 * anything else; the caller keeps its current data.
 */
export function parseAppData(text: string): AppData {
  const value = parseJson(text);
  if (!isRecord(value)) throw new Error(NOT_INVOO);
  const version = own(value, 'version');
  if (version === 3 || version === 2) return readAppData(value, version);
  if (version === 1) return readAppData(migrateV1(parseAppDataV1(value)), 3);
  throw new Error(NOT_INVOO);
}

/** The stored new-invoice draft (one saved before version 3 gets the default look), or null when it is not valid. */
export function parseDraft(text: string): Invoice | null {
  try {
    return readInvoice(parseJson(text), 'koncept', 'optional');
  } catch {
    return null;
  }
}
