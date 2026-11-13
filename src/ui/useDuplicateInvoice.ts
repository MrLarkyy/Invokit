import type { Invoice } from '../domain/invoice';
import { invoiceProblem } from '../domain/invoiceValidation';
import { duplicateInvoice } from '../domain/newInvoice';
import { saveProblem } from '../domain/records';
import { newRowId, todayIso } from './clock';
import { useToast } from './components/Toast';
import { navigate } from './router';
import { useStore } from './StoreProvider';

/** Saves a copy of the invoice and opens it for editing; a copy that could not be saved is refused with a message. */
export function useDuplicateInvoice(): (source: Invoice) => void {
  const { data, dispatch } = useStore();
  const toast = useToast();
  return (source) => {
    const copy = duplicateInvoice(source, data, todayIso(), newRowId);
    const problem = invoiceProblem(copy) ?? saveProblem(data, copy);
    if (problem) {
      toast(`Kopii nejde uložit: ${problem}`);
      return;
    }
    dispatch({ type: 'invoice/save', invoice: copy, now: new Date().toISOString() });
    toast(`Kopie je uložená jako ${copy.number}. Můžeš ji rovnou upravit.`);
    navigate({ name: 'upravit', id: copy.id });
  };
}
