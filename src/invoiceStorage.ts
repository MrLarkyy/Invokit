import type { Invoice } from './invoice';

// Everything stays in this browser: the draft is the only thing stored and nothing is ever sent anywhere.
const KEY = 'fakturka.draft.v1';

export function loadDraft(): Invoice | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Invoice) : null;
  } catch {
    return null;
  }
}

export function saveDraft(invoice: Invoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(invoice));
  } catch {
    // Private mode or a full quota: the invoice still works, it is just not remembered.
  }
}
