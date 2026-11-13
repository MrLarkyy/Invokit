import { describe, expect, it } from 'vitest';
import { fixtureInvoice, fixtureProfile } from '../test/invoiceFixture';
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
    const data = appReducer(emptyAppData(), { type: 'supplier/save', supplier: profile });
    profile.party.name = 'Changed';
    expect(data.supplier?.party.name).toBe('Ukázka s.r.o.');
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
