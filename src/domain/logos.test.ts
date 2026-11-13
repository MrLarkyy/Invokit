import { describe, expect, it } from 'vitest';
import { FIXTURE_LOGO, fixtureInvoice, fixtureProfile } from '../test/invoiceFixture';
import type { Invoice } from './invoice';
import { defaultAppearance } from './invoiceAppearance';
import type { SupplierProfile } from './supplierProfile';
import { LOGO_ID, logoUrl, pruneLogos, saveSupplierLogo, storeLogo, TOO_MANY_LOGOS, type StoredLogo } from './logos';

/** A distinct valid PNG data URL per n: the 1×1 PNG with a different filler block after its header. */
function otherLogo(n: number): string {
  const block = n.toString(36).padStart(4, 'A').slice(-4);
  return `${FIXTURE_LOGO.slice(0, -4)}${block}${FIXTURE_LOGO.slice(-4)}`;
}

const withLogo = (logoId: string | null) => ({ ...defaultAppearance(), logoId });

describe('storeLogo', () => {
  it('keeps an identical logo once', () => {
    const first = storeLogo([], FIXTURE_LOGO);
    expect(first).toEqual({ logos: [{ id: 'logo-1', dataUrl: FIXTURE_LOGO }], id: 'logo-1' });
    const again = storeLogo(first.logos, FIXTURE_LOGO);
    expect(again.id).toBe('logo-1');
    expect(again.logos).toHaveLength(1);
  });

  it('takes the lowest id no stored logo holds', () => {
    const logos: StoredLogo[] = [
      { id: 'logo-1', dataUrl: otherLogo(1) },
      { id: 'logo-3', dataUrl: otherLogo(3) },
    ];
    expect(storeLogo(logos, otherLogo(2)).id).toBe('logo-2');
  });

  it('keeps a new id valid next to the highest id a backup may hold', () => {
    const logos: StoredLogo[] = [{ id: 'logo-999999999', dataUrl: otherLogo(9) }];
    const { id } = storeLogo(logos, otherLogo(1));
    expect(id).toBe('logo-1');
    expect(LOGO_ID.test(id)).toBe(true);
  });

  it('refuses the 21st logo and an invalid one', () => {
    let logos: StoredLogo[] = [];
    for (let n = 1; n <= 20; n++) logos = storeLogo(logos, otherLogo(n)).logos;
    expect(new Set(logos.map((l) => l.dataUrl)).size).toBe(20);
    expect(() => storeLogo(logos, otherLogo(21))).toThrow(TOO_MANY_LOGOS);
    // Issued invoices are kept: the way out is a logo already stored, or none.
    expect(TOO_MANY_LOGOS).not.toMatch(/smaž|smaz|odstraň|vymaž/i);
    expect(TOO_MANY_LOGOS).toContain('logo odeber');
    expect(storeLogo(logos, otherLogo(3)).logos).toHaveLength(20);
    expect(() => storeLogo([], 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toThrow('PNG, JPEG nebo WebP');
  });
});

describe('logoUrl', () => {
  it('finds a stored logo, null for none or an unknown id', () => {
    const logos = [{ id: 'logo-1', dataUrl: FIXTURE_LOGO }];
    expect(logoUrl(logos, 'logo-1')).toBe(FIXTURE_LOGO);
    expect(logoUrl(logos, 'logo-2')).toBeNull();
    expect(logoUrl(logos, null)).toBeNull();
  });
});

describe('pruneLogos', () => {
  it('keeps a logo only an issued invoice uses and drops unused ones', () => {
    const data = {
      supplier: fixtureProfile({ appearance: withLogo('logo-2') }),
      invoices: [fixtureInvoice({ appearance: withLogo('logo-1') }), fixtureInvoice({ id: 'b', number: 'b' })],
      logos: [
        { id: 'logo-1', dataUrl: otherLogo(1) },
        { id: 'logo-2', dataUrl: otherLogo(2) },
        { id: 'logo-3', dataUrl: otherLogo(3) },
      ],
    };
    expect(pruneLogos(data).logos.map((l) => l.id)).toEqual(['logo-1', 'logo-2']);
    const pruned = pruneLogos({ ...data, logos: data.logos.slice(0, 2) });
    expect(pruned).toBe(pruneLogos(pruned));
  });
});

describe('saveSupplierLogo', () => {
  const book = () => ({
    supplier: null as SupplierProfile | null,
    invoices: [fixtureInvoice()],
    logos: [] as StoredLogo[],
  });

  it('stores the profile with its logo, and without one for null', () => {
    const saved = saveSupplierLogo(book(), fixtureProfile(), FIXTURE_LOGO);
    expect(saved.supplier?.appearance.logoId).toBe('logo-1');
    expect(saved.logos).toEqual([{ id: 'logo-1', dataUrl: FIXTURE_LOGO }]);
    const removed = saveSupplierLogo(saved, fixtureProfile(), null);
    expect(removed.supplier?.appearance.logoId).toBeNull();
    expect(removed.logos).toEqual([]);
  });

  it('keeps the old logo an invoice prints and frees the slot of one nothing prints', () => {
    let data = saveSupplierLogo(book(), fixtureProfile(), otherLogo(1));
    data = { ...data, invoices: [fixtureInvoice({ appearance: withLogo('logo-1') })] };
    data = saveSupplierLogo(data, fixtureProfile(), otherLogo(2));
    expect(data.logos.map((l) => l.id)).toEqual(['logo-1', 'logo-2']);
    data = saveSupplierLogo(data, fixtureProfile(), otherLogo(3));
    expect(data.logos.map((l) => l.id)).toEqual(['logo-1', 'logo-2']);
    expect(logoUrl(data.logos, data.supplier!.appearance.logoId)).toBe(otherLogo(3));
  });

  it('replaces the last of 20 logos when only the profile uses it', () => {
    let data = book();
    const invoices: Invoice[] = [];
    for (let n = 1; n <= 19; n++) {
      data = saveSupplierLogo(data, fixtureProfile(), otherLogo(n));
      invoices.push(fixtureInvoice({ id: `f${n}`, number: `f${n}`, appearance: withLogo(`logo-${n}`) }));
      data = { ...data, invoices };
    }
    data = saveSupplierLogo(data, fixtureProfile(), otherLogo(20));
    expect(data.logos).toHaveLength(20);
    expect(saveSupplierLogo(data, fixtureProfile(), otherLogo(21)).logos).toHaveLength(20);
    data = {
      ...data,
      invoices: [...invoices, fixtureInvoice({ id: 'f20', number: 'f20', appearance: withLogo('logo-20') })],
    };
    expect(() => saveSupplierLogo(data, fixtureProfile(), otherLogo(21))).toThrow(TOO_MANY_LOGOS);
  });

  it('never keeps the caller’s profile by reference', () => {
    const profile = fixtureProfile();
    const saved = saveSupplierLogo(book(), profile, FIXTURE_LOGO);
    expect(profile.appearance.logoId).toBeNull();
    profile.party.name = 'Changed';
    expect(saved.supplier?.party.name).toBe('Ukázka s.r.o.');
  });
});
