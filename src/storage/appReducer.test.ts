import { describe, expect, it } from 'vitest';
import { defaultAppearance } from '../domain/invoiceAppearance';
import { logoUrl, TOO_MANY_LOGOS } from '../domain/logos';
import { ID_TAKEN } from '../domain/records';
import { createBlankInvoice } from '../domain/newInvoice';
import { fullLogoData, printedLogos } from '../test/fullLogoData';
import { FIXTURE_LOGO, fixtureInvoice, fixtureLogo, fixtureProfile } from '../test/invoiceFixture';
import { emptyAppData, type AppData } from './appData';
import { parseAppData } from './appDataSchema';
import { appReducer, applyAppAction, INVOICE_GONE, type AppAction } from './appReducer';

const saved = (): AppData =>
  appReducer(emptyAppData(), {
    type: 'invoice/save',
    invoice: fixtureInvoice(),
    now: '2026-09-02T10:00:00Z',
    create: true,
  });

describe('appReducer', () => {
  it('saves, marks paid and deletes an invoice', () => {
    let data = saved();
    expect(data.invoices).toHaveLength(1);
    data = appReducer(data, { type: 'invoice/setPaid', id: '2026-09-001', paidAt: '2026-09-10' });
    expect(data.invoices[0]?.paid).toBe(true);
    data = appReducer(data, { type: 'invoice/delete', id: '2026-09-001' });
    expect(data.invoices).toEqual([]);
  });

  it('leaves the data as is when a save is rejected, and says why', () => {
    const data = saved();
    const duplicate = { ...fixtureInvoice(), id: 'other' };
    for (const create of [true, false]) {
      const action: AppAction = { type: 'invoice/save', invoice: duplicate, now: 'b', create };
      expect(appReducer(data, action)).toBe(data);
      expect(applyAppAction(data, action)).toEqual({ data, problem: 'Faktura s číslem 2026-09-001 už existuje.' });
    }
  });

  it('saves an edited invoice in place of its older version, and never a new one in place of another', () => {
    const data = saved();
    const edited = { ...fixtureInvoice(), note: 'Děkujeme.' };
    const asEdit = applyAppAction(data, { type: 'invoice/save', invoice: edited, now: 'b', create: false });
    expect(asEdit.problem).toBeNull();
    expect(asEdit.data.invoices.map((i) => i.note)).toEqual(['Děkujeme.']);

    // A new invoice with the id and number of a saved one: two tabs were offered the same next number.
    const asNew = applyAppAction(data, { type: 'invoice/save', invoice: edited, now: 'b', create: true });
    expect(asNew).toEqual({ data, problem: 'Faktura s číslem 2026-09-001 už existuje.' });
    // The same id under another number is still another invoice.
    const renumbered = { ...edited, number: '2026-09-002' };
    expect(applyAppAction(data, { type: 'invoice/save', invoice: renumbered, now: 'b', create: true })).toEqual({
      data,
      problem: ID_TAKEN,
    });
    expect(
      applyAppAction(data, { type: 'invoice/save', invoice: renumbered, now: 'b', create: false }).data.invoices,
    ).toHaveLength(1);
  });

  it('leaves the data as is for an invoice that is no longer there', () => {
    const data = saved();
    const gone = { data, problem: INVOICE_GONE };
    expect(applyAppAction(data, { type: 'invoice/setPaid', id: 'smazana', paidAt: '2026-09-10' })).toEqual(gone);
    expect(applyAppAction(data, { type: 'invoice/delete', id: 'smazana' })).toEqual(gone);
  });

  it('reports no problem for an action that is applied or has nothing to change', () => {
    const data = saved();
    expect(
      applyAppAction(data, { type: 'invoice/setPaid', id: '2026-09-001', paidAt: '2026-09-10' }).problem,
    ).toBeNull();
    expect(applyAppAction(data, { type: 'customer/delete', customer: fixtureInvoice().customer }).problem).toBeNull();
    expect(applyAppAction(data, { type: 'backup/exported', at: '2026-09-30' }).problem).toBeNull();
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
    data = appReducer(data, { type: 'invoice/save', invoice: issued, now: '2026-09-02T10:00:00Z', create: true });
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
    const data = appReducer(emptyAppData(), { type: 'invoice/save', invoice, now: 'a', create: true });
    expect(data.invoices[0]?.appearance.logoId).toBeNull();
  });

  it('drops a logo with the last invoice that prints it', () => {
    let data = appReducer(emptyAppData(), { type: 'supplier/save', supplier: fixtureProfile(), logo: FIXTURE_LOGO });
    data = appReducer(data, {
      type: 'invoice/save',
      invoice: createBlankInvoice(data, '2026-09-02', () => 'r1'),
      now: 'a',
      create: true,
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

describe('a logo saved next to a restored high id', () => {
  it('stays loadable after the save', () => {
    const issued = fixtureInvoice({ appearance: { ...defaultAppearance(), logoId: 'logo-999999999' } });
    const restored = parseAppData(
      JSON.stringify({
        ...emptyAppData(),
        invoices: [issued],
        logos: [{ id: 'logo-999999999', dataUrl: FIXTURE_LOGO }],
      }),
    );
    const other = FIXTURE_LOGO.replace('YII=', 'YIA=');
    const saved = appReducer(restored, { type: 'supplier/save', supplier: fixtureProfile(), logo: other });
    expect(saved.supplier?.appearance.logoId).toBe('logo-1');
    expect(parseAppData(JSON.stringify(saved))).toEqual(saved);
  });
});

describe('logos the invoices print, with every logo slot taken', () => {
  const profileLogo = (data: AppData) => logoUrl(data.logos, data.supplier?.appearance.logoId ?? null);

  it('refuses one logo too many without changing anything', () => {
    const full = fullLogoData();
    const oneTooMany: AppAction = { type: 'supplier/save', supplier: fixtureProfile(), logo: fixtureLogo(21) };
    expect(appReducer(full, oneTooMany)).toBe(full);
    expect(applyAppAction(full, oneTooMany)).toEqual({ data: full, problem: TOO_MANY_LOGOS });
  });

  it('keeps every logo an invoice or the profile prints through saves, refusals and removals', () => {
    const full = fullLogoData();
    const printed = printedLogos(full);
    const blank = createBlankInvoice(full, '2026-09-02', () => 'r1');
    const actions: AppAction[] = [
      { type: 'supplier/save', supplier: fixtureProfile(), logo: fixtureLogo(21) },
      { type: 'supplier/save', supplier: fixtureProfile({ email: 'fakturace@ukazka.example' }), logo: fixtureLogo(3) },
      { type: 'supplier/save', supplier: fixtureProfile(), logo: fixtureLogo(22) },
      { type: 'invoice/save', invoice: { ...blank, id: 'new', number: '2026-09-050' }, now: 'a', create: true },
      {
        type: 'invoice/save',
        invoice: fixtureInvoice({
          id: 'gone',
          number: '2026-09-051',
          appearance: { ...defaultAppearance(), logoId: 'logo-77' },
        }),
        now: 'b',
        create: true,
      },
      { type: 'supplier/save', supplier: fixtureProfile(), logo: null },
      { type: 'supplier/save', supplier: fixtureProfile(), logo: fixtureLogo(23) },
      { type: 'invoice/setPaid', id: 'f7', paidAt: '2026-09-10' },
      { type: 'customer/delete', customer: fixtureInvoice().customer },
      { type: 'catalog/delete', description: 'Vývoj' },
      { type: 'backup/exported', at: '2026-09-30' },
    ];
    let data = full;
    for (const action of actions) {
      data = appReducer(data, action);
      expect(printedLogos(data), action.type).toMatchObject(printed);
      expect(Object.values(printedLogos(data)), action.type).not.toContain('missing');
      expect(data.supplier === null || data.supplier.appearance.logoId === null || profileLogo(data) !== null).toBe(
        true,
      );
      expect(parseAppData(JSON.stringify(data)), action.type).toEqual(data);
    }
    expect(data.logos).toHaveLength(20);
    expect(profileLogo(data)).toBeNull();
    expect(data.invoices).toHaveLength(22);
  });

  it('frees a slot only with the last invoice that prints its logo', () => {
    const full = fullLogoData();
    const without = appReducer(full, { type: 'invoice/delete', id: 'f5' });
    const others = printedLogos(full);
    delete others.f5;
    expect(printedLogos(without)).toEqual(others);
    expect(without.logos).toHaveLength(19);
    const saved = appReducer(without, { type: 'supplier/save', supplier: fixtureProfile(), logo: fixtureLogo(21) });
    expect(printedLogos(saved)).toEqual(others);
    expect(profileLogo(saved)).toBe(fixtureLogo(21));
  });
});
