import { splitZipCity } from '../czech/czechAddress';
import { parseCzechAccount } from '../czech/czechIban';
import { isIsoDate } from '../domain/dates';
import type { CatalogItem, Invoice, InvoiceItem, Party } from '../domain/invoice';
import { uniqueInvoiceId } from '../domain/invoiceNumber';
import { LIMITS } from '../domain/limits';
import { lineTotalCents, parseQuantity } from '../domain/money';
import { profileFromSnapshot, type SupplierProfile } from '../domain/supplierProfile';
import type { AppData } from './appData';
import type { AppDataV1, InvoiceItemV1, InvoiceV1, PartyV1, SavedInvoiceV1, SupplierProfileV1 } from './appDataV1';

// v1 read decimals with this parser and multiplied floats; the migration repeats it so issued totals stay identical.
function parseV1Decimal(text: string): number | null {
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function v1PriceCents(text: string): number {
  const price = parseV1Decimal(text);
  return price === null ? 0 : Math.round(price * 100);
}

const clip = (text: string, max: number = LIMITS.text) => text.slice(0, max);
const isoOrEmpty = (date: string) => (isIsoDate(date) ? date : '');

function migrateParty(party: PartyV1): Party {
  const { zip, city } = splitZipCity(party.city);
  return {
    name: clip(party.name),
    street: clip(party.street),
    city: clip(city),
    zip: clip(zip),
    ico: clip(party.ico),
    dic: clip(party.dic),
  };
}

function migrateItem(item: InvoiceItemV1, index: number): InvoiceItem {
  const quantityNumber = parseV1Decimal(item.quantity);
  const unitPriceCents = v1PriceCents(item.unitPrice);
  const quantity =
    quantityNumber === null ? '0' : (parseQuantity(item.quantity) ?? parseQuantity(quantityNumber.toFixed(6)) ?? '0');
  const v1Line = quantityNumber === null ? 0 : Math.round(quantityNumber * unitPriceCents);
  const migrated: InvoiceItem = {
    id: String(index + 1),
    description: clip(item.description),
    quantity,
    unit: clip(item.unit),
    unitPriceCents,
    vatRate: 0,
  };
  if (lineTotalCents(quantity, unitPriceCents) !== v1Line) migrated.legacyLineCents = v1Line;
  return migrated;
}

function migrateInvoice(invoice: InvoiceV1, id: string, paid: boolean, savedAt: string): Invoice {
  const issueDate = isoOrEmpty(invoice.issueDate);
  return {
    id,
    number: clip(invoice.number),
    issueDate,
    dueDate: isoOrEmpty(invoice.dueDate),
    taxableSupplyDate: issueDate,
    // The same digits v1 put into the QR payment.
    variableSymbol: invoice.variableSymbol.replace(/\D/g, '').slice(0, 10),
    supplier: {
      party: migrateParty(invoice.supplier),
      vatPayer: invoice.vatPayer,
      email: '',
      registryNote: clip(invoice.registryNote, LIMITS.registryNote),
      bankAccount: clip(invoice.bankAccount),
    },
    customer: migrateParty(invoice.customer),
    items: invoice.items.map(migrateItem),
    note: '',
    paymentMethod: clip(invoice.paymentMethod),
    showQr: true,
    paid,
    paidAt: null,
    savedAt: clip(savedAt),
  };
}

function migrateProfile(profile: SupplierProfileV1): SupplierProfile {
  const account = parseCzechAccount(profile.bankAccount);
  return {
    party: migrateParty(profile.supplier),
    vatPayer: profile.vatPayer,
    email: '',
    registryNote: clip(profile.registryNote, LIMITS.registryNote),
    accountPrefix: account?.prefix ?? '',
    accountNumber: account?.number ?? '',
    bankCode: account?.bankCode ?? '',
  };
}

function migrateCatalog(items: InvoiceItemV1[]): CatalogItem[] {
  return items
    .filter((item) => item.description.trim())
    .map((item) => ({
      description: clip(item.description),
      unit: clip(item.unit),
      unitPriceCents: v1PriceCents(item.unitPrice),
      vatRate: 0,
    }));
}

/**
 * v1 → v2. Items get VAT rate 0 and keep the v1 float line total where exact arithmetic differs, so every issued
 * total stays the same; v1 paid invoices get no invented payment date.
 */
export function migrateV1(v1: AppDataV1): AppData {
  const taken = new Set<string>();
  const invoices = v1.invoices.map((invoice: SavedInvoiceV1) => {
    const id = uniqueInvoiceId(invoice.number, taken);
    taken.add(id);
    return migrateInvoice(invoice, id, invoice.paid, invoice.savedAt);
  });
  const newest = invoices.reduce<Invoice | null>(
    (best, i) => (!best || i.number.localeCompare(best.number) > 0 ? i : best),
    null,
  );
  const supplier = v1.supplier ? migrateProfile(v1.supplier) : newest ? profileFromSnapshot(newest.supplier) : null;
  return {
    version: 2,
    supplier,
    invoices,
    customers: v1.customers.map(migrateParty),
    items: migrateCatalog(v1.items),
    lastBackupAt: null,
  };
}

/** The unsaved v1 draft as a v2 invoice, with an id no saved invoice holds. */
export function migrateDraftV1(draft: InvoiceV1, takenIds: ReadonlySet<string>): Invoice {
  return migrateInvoice(draft, uniqueInvoiceId(draft.number, takenIds), false, '');
}
