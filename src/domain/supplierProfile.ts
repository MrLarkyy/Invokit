import { formatCzechAccount, parseCzechAccount } from '../czech/czechIban';
import { emptyParty, type Invoice, type Party, type SupplierSnapshot } from './invoice';

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
