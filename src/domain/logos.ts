import type { InvoiceAppearance } from './invoiceAppearance';
import { LIMITS } from './limits';
import { isLogoDataUrl } from './logoImage';
import type { SupplierProfile } from './supplierProfile';

/** One logo, kept once however many invoices print it; invoices and the profile refer to it by id. */
export interface StoredLogo {
  /** "logo-<n>" */
  id: string;
  dataUrl: string;
}

/** The parts of the stored data that refer to logos; the rest is kept as it is. */
export interface LogoBook {
  supplier: { appearance: InvoiceAppearance } | null;
  invoices: { appearance: InvoiceAppearance }[];
  logos: StoredLogo[];
}

export const LOGO_ID = /^logo-[1-9]\d{0,8}$/;

export const TOO_MANY_LOGOS =
  `Invoo pojme nejvýš ${LIMITS.logos} různých log a uložené faktury už všechna používají. Smaž starší faktury ` +
  's jinými logy, nebo vyber znovu soubor loga, které už některá faktura má.';
const INVALID_LOGO = 'Logo musí být obrázek PNG, JPEG nebo WebP do 50 000 znaků.';

/** The logos with this one added, or the same one found; throws a Czech message for an invalid one or one too many. */
export function storeLogo(logos: readonly StoredLogo[], dataUrl: string): { logos: StoredLogo[]; id: string } {
  if (!isLogoDataUrl(dataUrl)) throw new Error(INVALID_LOGO);
  const same = logos.find((logo) => logo.dataUrl === dataUrl);
  if (same) return { logos: [...logos], id: same.id };
  if (logos.length >= LIMITS.logos) throw new Error(TOO_MANY_LOGOS);
  // The lowest free number: with at most 20 logos it stays small, whatever ids a restored backup brought.
  const taken = new Set(logos.map((logo) => logo.id));
  let n = 1;
  while (taken.has(`logo-${n}`)) n += 1;
  const id = `logo-${n}`;
  return { logos: [...logos, { id, dataUrl }], id };
}

/** The data URL of a logo, or null for none or an id that is not stored. */
export function logoUrl(logos: readonly StoredLogo[], id: string | null): string | null {
  return id === null ? null : (logos.find((logo) => logo.id === id)?.dataUrl ?? null);
}

/** Drops the logos neither the profile nor any invoice uses. */
export function pruneLogos<T extends LogoBook>(data: T): T {
  const used = new Set<string>();
  if (data.supplier?.appearance.logoId) used.add(data.supplier.appearance.logoId);
  for (const invoice of data.invoices) if (invoice.appearance.logoId) used.add(invoice.appearance.logoId);
  const logos = data.logos.filter((logo) => used.has(logo.id));
  return logos.length === data.logos.length ? data : { ...data, logos };
}

/**
 * Saves the profile with this logo (null: none). The previous logo is dropped first when no invoice prints it, so
 * replacing a logo never counts against the limit. Throws the Czech reason when the logo cannot be stored.
 */
export function saveSupplierLogo<T extends Omit<LogoBook, 'supplier'> & { supplier: SupplierProfile | null }>(
  data: T,
  supplier: SupplierProfile,
  logo: string | null,
): T {
  const profile = structuredClone(supplier);
  profile.appearance.logoId = null;
  const without = pruneLogos({ ...data, supplier: profile });
  if (logo === null) return without;
  const stored = storeLogo(without.logos, logo);
  profile.appearance.logoId = stored.id;
  return { ...without, logos: stored.logos };
}
