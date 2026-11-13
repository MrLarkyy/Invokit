import { describe, expect, it } from 'vitest';
import { defaultAppearance } from '../domain/invoiceAppearance';
import { logoUrl } from '../domain/logos';
import { createBlankInvoice } from '../domain/newInvoice';
import { FIXTURE_LOGO, fixtureInvoice, fixtureProfile } from '../test/invoiceFixture';
import { emptyAppData, type AppData } from './appData';
import { appReducer } from './appReducer';

const saved = (): AppData =>
  appReducer(emptyAppData(), { type: 'invoice/save', invoice: fixtureInvoice(), now: '2026-09-02T10:00:00Z' });

describe('appReducer', () => {
  it('saves, marks paid and deletes an invoice', () => {
    let data = saved();
    expect(data.invoices).toHaveLength(1);
    data = appReducer(data, { type: 'invoice/setPaid', id: '2026-09-001', paidAt: '2026-09-10' });
    expect(data.invoices[0]?.paid).toBe(true);
    data = appReducer(data, { type: 'invoice/delete', id: '2026-09-001' });
    expect(data.invoices).toEqual([]);
  });

  it('leaves the data as is when a save is rejected', () => {
    const data = saved();
    const duplicate = { ...fixtureInvoice(), id: 'other' };
    expect(appReducer(data, { type: 'invoice/save', invoice: duplicate, now: 'b' })).toBe(data);
  });

  it('saves the profile as a copy', () => {
    const profile = fixtureProfile();
    const data = appReducer(emptyAppData(), { type: 'supplier/save', supplier: profile, logo: null });
    profile.party.name = 'Changed';
    expect(data.supplier?.party.name).toBe('Ukázka s.r.o.');
  });

  it('never changes a saved invoice when the default look, accent, logo or footer change', () => {
    let data = appReducer(emptyAppData(), { type: 'supplier/save', supplier: fixtureProfile(), logo: FIXTURE_LOGO });
    const issued = createBlankInvoice(data, '2026-09-02', () => 'r1');
    data = appReducer(data, { type: 'invoice/save', invoice: issued, now: '2026-09-02T10:00:00Z' });
    const before = structuredClone(data.invoices[0]!);
    expect(before.appearance).toEqual({ template: 'invoo', accent: null, logoId: 'logo-1', brandFooter: true });
    const changed = fixtureProfile({
      appearance: { template: 'klasik', accent: '#1d4ed8', logoId: null, brandFooter: false },
    });
    data = appReducer(data, { type: 'supplier/save', supplier: changed, logo: FIXTURE_LOGO.replace('YII=', 'YIA=') });
    data = appReducer(data, { type: 'supplier/save', supplier: changed, logo: null });
    expect(data.invoices[0]).toEqual(before);
    expect(logoUrl(data.logos, data.invoices[0]!.appearance.logoId)).toBe(FIXTURE_LOGO);
    expect(data.supplier?.appearance).toEqual({
      template: 'klasik',
      accent: '#1d4ed8',
      logoId: null,
      brandFooter: false,
    });
  });

  it('saves an invoice naming a logo that is no longer stored without it', () => {
    const invoice = fixtureInvoice({ appearance: { ...defaultAppearance(), logoId: 'logo-5' } });
    const data = appReducer(emptyAppData(), { type: 'invoice/save', invoice, now: 'a' });
    expect(data.invoices[0]?.appearance.logoId).toBeNull();
  });

  it('drops a logo with the last invoice that prints it', () => {
    let data = appReducer(emptyAppData(), { type: 'supplier/save', supplier: fixtureProfile(), logo: FIXTURE_LOGO });
    data = appReducer(data, {
      type: 'invoice/save',
      invoice: createBlankInvoice(data, '2026-09-02', () => 'r1'),
      now: 'a',
    });
    data = appReducer(data, { type: 'supplier/save', supplier: fixtureProfile(), logo: null });
    expect(data.logos).toHaveLength(1);
    data = appReducer(data, { type: 'invoice/delete', id: data.invoices[0]!.id });
    expect(data.logos).toEqual([]);
  });

  it('leaves the data as is when a logo cannot be stored', () => {
    const data = saved();
    expect(
      appReducer(data, {
        type: 'supplier/save',
        supplier: fixtureProfile(),
        logo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      }),
    ).toBe(data);
  });

  it('deletes a saved customer and catalog item', () => {
    let data = saved();
    data = appReducer(data, { type: 'customer/delete', customer: data.customers[0]! });
    data = appReducer(data, { type: 'catalog/delete', description: 'Vývoj' });
    expect(data.customers).toEqual([]);
    expect(data.items).toEqual([]);
  });

  it('records the backup date and replaces everything on restore or reload', () => {
    const data = appReducer(saved(), { type: 'backup/exported', at: '2026-09-30' });
    expect(data.lastBackupAt).toBe('2026-09-30');
    const restored = { ...emptyAppData(), supplier: fixtureProfile() };
    expect(appReducer(data, { type: 'backup/restore', data: restored })).toBe(restored);
    expect(appReducer(data, { type: 'data/reload', data: restored })).toBe(restored);
  });
});
