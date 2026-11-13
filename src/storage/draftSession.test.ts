import { describe, expect, it } from 'vitest';
import { fixtureInvoice } from '../test/invoiceFixture';
import { DRAFT_KEY, PREVIOUS_DRAFT_KEY, saveDraft } from './appDataStorage';
import { DraftSession } from './draftSession';
import { MemoryStorage } from './memoryStorage';

const forCustomer = (name: string) => {
  const draft = fixtureInvoice({ id: 'draft', number: '2026-09-002' });
  return { ...draft, customer: { ...draft.customer, name } };
};

describe('DraftSession', () => {
  it('keeps the draft in the browser storage while saving is on', () => {
    const storage = new MemoryStorage();
    const draft = forCustomer('Odběratel Test a.s.');
    new DraftSession(storage).save(draft, true);
    expect(new DraftSession(storage).load()).toEqual(draft);
  });

  it('hands a draft to the next page while saving is off, and writes nothing', () => {
    const storage = new MemoryStorage();
    const session = new DraftSession(storage);
    session.save(forCustomer('Vybraný odběratel s.r.o.'), false);
    expect(session.load()?.customer.name).toBe('Vybraný odběratel s.r.o.');
    expect(storage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('keeps an older stored draft untouched while saving is off, and a discarded draft stays discarded', () => {
    const storage = new MemoryStorage();
    saveDraft(storage, forCustomer('Starší koncept a.s.'));
    const before = storage.getItem(DRAFT_KEY);
    const session = new DraftSession(storage);
    expect(session.load()?.customer.name).toBe('Starší koncept a.s.');
    session.save(null, false);
    expect(session.load()).toBeNull();
    expect(storage.getItem(DRAFT_KEY)).toBe(before);
  });

  it('opens a draft an older Invoo left and touches its key only once this tab may write', () => {
    const storage = new MemoryStorage();
    const before = JSON.stringify(forCustomer('Koncept z dřívějška s.r.o.'));
    storage.setItem(PREVIOUS_DRAFT_KEY, before);
    const session = new DraftSession(storage);
    expect(session.load()?.customer.name).toBe('Koncept z dřívějška s.r.o.');
    session.save(forCustomer('Upravený odběratel s.r.o.'), false);
    session.save(null, false);
    expect(storage.getItem(PREVIOUS_DRAFT_KEY)).toBe(before);
    expect(storage.getItem(DRAFT_KEY)).toBeNull();

    session.save(forCustomer('Upravený odběratel s.r.o.'), true);
    expect(storage.getItem(PREVIOUS_DRAFT_KEY)).toBeNull();
    expect(new DraftSession(storage).load()?.customer.name).toBe('Upravený odběratel s.r.o.');
  });

  it('holds the draft in memory when the browser refuses the write', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const session = new DraftSession(storage);
    session.save(forCustomer('Vybraný odběratel s.r.o.'), true);
    expect(session.load()?.customer.name).toBe('Vybraný odběratel s.r.o.');
  });

  it('goes back to the browser storage once the draft is written there', () => {
    const storage = new MemoryStorage();
    const session = new DraftSession(storage);
    session.save(forCustomer('Jen v paměti s.r.o.'), false);
    session.save(forCustomer('Uložený odběratel s.r.o.'), true);
    expect(new DraftSession(storage).load()?.customer.name).toBe('Uložený odběratel s.r.o.');
    saveDraft(storage, forCustomer('Z jiné záložky a.s.'));
    expect(session.load()?.customer.name).toBe('Z jiné záložky a.s.');
  });
});
