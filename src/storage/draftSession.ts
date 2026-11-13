import type { Invoice } from '../domain/invoice';
import { loadDraft, saveDraft } from './appDataStorage';

/**
 * The unsaved new invoice during one page visit. It lives in the browser storage; when it cannot be written there
 * (saving is off, or the browser refuses), it is held in memory, so a draft handed from one page to the next (a new
 * invoice for a saved customer) and a discarded draft still take effect for the rest of the visit.
 */
export class DraftSession {
  /** The draft the storage does not have; undefined when the storage is up to date. */
  private held: Invoice | null | undefined = undefined;

  constructor(private readonly storage: Storage) {}

  load(): Invoice | null {
    return this.held === undefined ? loadDraft(this.storage) : this.held;
  }

  /** Stores the draft, or clears it for null; `canWrite` false keeps the storage untouched. */
  save(draft: Invoice | null, canWrite: boolean): void {
    this.held = canWrite && saveDraft(this.storage, draft) ? undefined : draft;
  }
}
