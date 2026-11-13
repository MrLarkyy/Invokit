import type { Invoice } from '../domain/invoice';
import { invoiceProblem } from '../domain/invoiceValidation';
import { duplicateInvoice } from '../domain/newInvoice';
import { saveProblem } from '../domain/records';
import { newRowId, todayIso } from './clock';
import { useToast } from './components/Toast';
import { navigate } from './router';
import { useStore } from './StoreProvider';
import { notStored } from './texts';

/**
 * Saves a copy of the invoice and opens it for editing; a copy that cannot be saved is refused with a message, also
 * when another tab took its number in the meantime.
 */
export function useDuplicateInvoice(): (source: Invoice) => void {
  const { data, dispatch } = useStore();
  const toast = useToast();
  return (source) => {
    const copy = duplicateInvoice(source, data, todayIso(), newRowId);
    const refuse = (reason: string) => toast(`Kopii nejde uložit: ${reason}`);
    const problem = invoiceProblem(copy) ?? saveProblem(data, copy, true);
    if (problem) return refuse(problem);
    const done = dispatch({ type: 'invoice/save', invoice: copy, now: new Date().toISOString(), create: true });
    if (done.result === 'rejected') return refuse(done.reason);
    toast(
      done.result === 'stored'
        ? `Kopie je uložená jako ${copy.number}. Můžeš ji rovnou upravit.`
        : notStored(`kopie ${copy.number} zůstane`),
    );
    navigate({ name: 'upravit', id: copy.id });
  };
}
