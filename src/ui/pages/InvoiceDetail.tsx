import { getStatus } from '../../domain/invoiceStatus';
import { computeTotals } from '../../domain/invoiceTotals';
import { formatCzk } from '../../domain/money';
import { duplicateInvoice } from '../../domain/newInvoice';
import { newRowId, todayIso } from '../clock';
import { AdSlot } from '../components/AdSlot';
import { Eyes } from '../components/Eyes';
import { IconArrowLeft, IconCheck, IconCopy, IconDownload, IconPencil, IconTrash, IconUndo } from '../components/Icons';
import { InvoicePaper } from '../components/InvoicePaper';
import { NotFound } from '../components/NotFound';
import { StatusChip } from '../components/StatusChip';
import { useToast } from '../components/Toast';
import { navigate, toHash } from '../router';
import { useStore } from '../StoreProvider';
import { dueLabel } from '../texts';
import { useDocumentTitle } from '../useDocumentTitle';

export function InvoiceDetail({ id }: { id: string }) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const invoice = data.invoices.find((item) => item.id === id);
  useDocumentTitle(invoice ? `Faktura ${invoice.number}` : 'Faktura nenalezena');

  if (!invoice) return <NotFound />;

  const today = todayIso();
  const status = getStatus(invoice, today);
  const total = computeTotals(invoice.items, invoice.supplier.vatPayer).totalCents;

  const togglePaid = () => {
    if (invoice.paid) {
      dispatch({ type: 'invoice/setPaid', id: invoice.id, paidAt: null });
      toast(`Faktura ${invoice.number} je zpátky mezi nezaplacenými.`);
    } else {
      dispatch({ type: 'invoice/setPaid', id: invoice.id, paidAt: today });
      toast(`Faktura ${invoice.number} je zaplacená. Dobrá práce.`, 'happy');
    }
  };

  const duplicate = () => {
    const copy = duplicateInvoice(invoice, data, today, newRowId);
    dispatch({ type: 'invoice/save', invoice: copy, now: new Date().toISOString() });
    toast(`Kopie je uložená jako ${copy.number}. Můžeš ji rovnou upravit.`);
    navigate({ name: 'upravit', id: copy.id });
  };

  const remove = () => {
    if (!window.confirm(`Smazat fakturu ${invoice.number}? Smaže se jen z tohoto prohlížeče a nejde to vrátit.`)) return;
    dispatch({ type: 'invoice/delete', id: invoice.id });
    toast(`Faktura ${invoice.number} je smazaná.`);
    navigate({ name: 'faktury' });
  };

  return (
    <div className="page container">
      <a className="back" href={toHash({ name: 'faktury' })}>
        <IconArrowLeft size={18} />
        Všechny faktury
      </a>

      <div className="detail">
        <div className="detail__paper">
          <InvoicePaper invoice={invoice} />
        </div>

        <aside className="detail__side">
          <section className="card detail__summary">
            <StatusChip status={status} />
            <h1>Faktura {invoice.number}</h1>
            <p className="detail__customer">{invoice.customer.name}</p>
            <strong className="detail__total">{formatCzk(total)}</strong>
            <p className="detail__due">
              <Eyes size={18} mood={invoice.paid ? 'happy' : 'watch'} variant="outline" />
              {dueLabel(invoice, today)}
            </p>

            <button
              type="button"
              className={`btn ${invoice.paid ? 'btn--outline' : 'btn--primary'}`}
              onClick={togglePaid}
            >
              {invoice.paid ? <IconUndo size={18} /> : <IconCheck size={18} />}
              {invoice.paid ? 'Vrátit mezi nezaplacené' : 'Označit jako zaplacenou'}
            </button>
            <div className="detail__actions">
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => window.print()}
                title="Otevře tisk, kde zvolíš Uložit jako PDF."
              >
                <IconDownload size={18} />
                Stáhnout PDF
              </button>
              <a className="btn btn--outline" href={toHash({ name: 'upravit', id: invoice.id })}>
                <IconPencil size={18} />
                Upravit
              </a>
              <button type="button" className="btn btn--outline" onClick={duplicate}>
                <IconCopy size={18} />
                Duplikovat
              </button>
              <button type="button" className="btn btn--outline btn--danger" onClick={remove}>
                <IconTrash size={18} />
                Smazat fakturu
              </button>
            </div>
            <p className="field__hint">Stáhnout PDF otevře tisk, kde zvolíš Uložit jako PDF.</p>
          </section>

          <AdSlot />
        </aside>
      </div>
    </div>
  );
}
