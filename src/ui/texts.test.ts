import { describe, expect, it } from 'vitest';
import { fixtureInvoice } from '../test/invoiceFixture';
import { dueLabel, notStored, withStoredNote } from './texts';

describe('dueLabel', () => {
  it('describes the due date in Czech', () => {
    expect(dueLabel(fixtureInvoice(), '2026-09-13')).toBe('splatná za 3 dny');
    expect(dueLabel(fixtureInvoice(), '2026-09-11')).toBe('splatná za 5 dní');
    expect(dueLabel(fixtureInvoice(), '2026-09-15')).toBe('splatná za 1 den');
    expect(dueLabel(fixtureInvoice(), '2026-09-16')).toBe('splatná dnes');
    expect(dueLabel(fixtureInvoice(), '2026-09-18')).toBe('2 dny po splatnosti');
  });

  it('shows the payment date only when it is known', () => {
    expect(dueLabel(fixtureInvoice({ paid: true, paidAt: '2026-09-10' }), '2026-12-01')).toBe('zaplaceno 10. 09. 2026');
    expect(dueLabel(fixtureInvoice({ paid: true, paidAt: null }), '2026-12-01')).toBe('zaplaceno');
  });
});

describe('messages about unsaved changes', () => {
  it('say explicitly that the change is not stored', () => {
    expect(notStored('faktura 2026-09-001 zůstane')).toBe(
      'Neuloženo: faktura 2026-09-001 zůstane jen do zavření stránky.',
    );
  });

  it('leave a message alone when the change is stored and add the note when it is not', () => {
    expect(withStoredNote('Faktura 2026-09-001 je smazaná.', true)).toBe('Faktura 2026-09-001 je smazaná.');
    expect(withStoredNote('Faktura 2026-09-001 je smazaná.', false)).toBe(
      'Faktura 2026-09-001 je smazaná. Neuloženo: změna platí jen do zavření stránky.',
    );
  });
});
