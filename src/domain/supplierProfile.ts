import { formatCzechAccount, parseCzechAccount } from '../czech/czechIban';
import { emptyParty, type Invoice, type Party, type SupplierSnapshot } from './invoice';
import { isCompleteSupplier } from './invoiceValidation';

/** The user's own details, edited in Settings and copied into each invoice when it is saved. */
export interface SupplierProfile {
  party: Party;
  vatPayer: boolean;
  email: string;
  registryNote: string;
  accountPrefix: string;
  accountNumber: string;
  bankCode: string;
}

export function emptyProfile(): SupplierProfile {
  return {
    party: emptyParty(),
    vatPayer: false,
    email: '',
    registryNote: '',
    accountPrefix: '',
    accountNumber: '',
    bankCode: '',
  };
}

export function profileAccount(profile: SupplierProfile): string {
  return formatCzechAccount({
    prefix: profile.accountPrefix,
    number: profile.accountNumber,
    bankCode: profile.bankCode,
  });
}

/** A copy of the profile for one invoice; no profile gives an empty non-payer supplier. */
export function snapshotOf(profile: SupplierProfile | null): SupplierSnapshot {
  const source = profile ?? emptyProfile();
  return {
    party: { ...source.party },
    vatPayer: source.vatPayer,
    email: source.email,
    registryNote: source.registryNote,
    bankAccount: profileAccount(source),
  };
}

/**
 * The supplier of an issued invoice with its missing details filled in from the profile, so that an invoice saved
 * without them (typically one migrated from Invokit) can be corrected. Only empty fields of the name, address and
 * IČO are filled, and the DIČ of a VAT payer's invoice. What the invoice says already stays, and so do its VAT
 * status, bank account, e-mail and registry note: they decide how it prints and where it is paid. A supplier that
 * is complete, or that the profile cannot improve, is returned as it is.
 */
export function completeSupplierSnapshot(
  snapshot: SupplierSnapshot,
  profile: SupplierProfile | null,
): SupplierSnapshot {
  if (!profile || isCompleteSupplier(snapshot)) return snapshot;
  const empty = (field: keyof Party) => snapshot.party[field].trim() === '';
  const fields: (keyof Party)[] = ['name', 'street', 'city', 'ico'];
  // The postcode belongs to its city: it is taken only together with the city, never added to another one.
  if (empty('city')) fields.push('zip');
  // A non-payer's invoice is complete without a DIČ; the one of a later VAT registration does not belong on it.
  if (snapshot.vatPayer) fields.push('dic');
  const missing = fields.filter((field) => empty(field) && profile.party[field].trim() !== '');
  if (missing.length === 0) return snapshot;
  const party = { ...snapshot.party };
  for (const field of missing) party[field] = profile.party[field];
  return { ...snapshot, party };
}

/** A profile rebuilt from an invoice; an account that does not parse leaves the account fields empty. */
export function profileFromSnapshot(snapshot: SupplierSnapshot): SupplierProfile {
  const account = parseCzechAccount(snapshot.bankAccount);
  return {
    party: { ...snapshot.party },
    vatPayer: snapshot.vatPayer,
    email: snapshot.email,
    registryNote: snapshot.registryNote,
    accountPrefix: account?.prefix ?? '',
    accountNumber: account?.number ?? '',
    bankCode: account?.bankCode ?? '',
  };
}

/** The remembered profile, or the one of the newest invoice when none was saved yet. */
export function savedProfile(data: { supplier: SupplierProfile | null; invoices: Invoice[] }): SupplierProfile | null {
  if (data.supplier) return data.supplier;
  const newest = data.invoices.reduce<Invoice | null>(
    (best, i) => (!best || i.number.localeCompare(best.number) > 0 ? i : best),
    null,
  );
  return newest ? profileFromSnapshot(newest.supplier) : null;
}
