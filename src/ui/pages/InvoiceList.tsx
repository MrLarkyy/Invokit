import { useMemo, useState } from 'react';
import { formatCzechDate } from '../../domain/dates';
import type { Invoice } from '../../domain/invoice';
import { getStatus, type InvoiceStatus } from '../../domain/invoiceStatus';
import { computeTotals } from '../../domain/invoiceTotals';
import { formatCzk, formatCzkRound } from '../../domain/money';
import { todayIso } from '../clock';
import { czechPlural, INVOICES } from '../czechPlural';
import { Eyes } from '../components/Eyes';
import { IconCheck, IconCopy, IconEye, IconPencil, IconSearch, IconUndo } from '../components/Icons';
import { StatsPanel } from '../components/StatsPanel';
import { StatusChip } from '../components/StatusChip';
import { useToast } from '../components/Toast';
import { toHash } from '../router';
import { useStore } from '../StoreProvider';
import { dueLabel, withStoredNote } from '../texts';
import { useDocumentTitle } from '../useDocumentTitle';
import { useDuplicateInvoice } from '../useDuplicateInvoice';

type Filter = 'all' | InvoiceStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Všechny' },
  { id: 'pending', label: 'Čekají na platbu' },
  { id: 'overdue', label: 'Po splatnosti' },
  { id: 'paid', label: 'Zaplacené' },
];

export function InvoiceList() {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const duplicate = useDuplicateInvoice();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const today = todayIso();
  useDocumentTitle('Faktury');

  const rows = useMemo(
    () =>
      data.invoices.map((invoice) => ({
        invoice,
        status: getStatus(invoice, today),
        // Each invoice with its own supplier snapshot: a later VAT registration never changes an issued total.
        total: computeTotals(invoice.items, invoice.supplier.vatPayer).totalCents,
      })),
    [data.invoices, today],
  );

  const stats = useMemo(() => {
    const sum = (status?: InvoiceStatus) => {
      const selected = status ? rows.filter((row) => row.status === status) : rows;
      return { count: selected.length, total: selected.reduce((s, row) => s + row.total, 0) };
    };
    return { all: sum(), pending: sum('pending'), overdue: sum('overdue'), paid: sum('paid') };
  }, [rows]);

  const needle = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (filter === 'all' || row.status === filter) &&
      (needle === '' ||
        row.invoice.number.toLowerCase().includes(needle) ||
        row.invoice.customer.name.toLowerCase().includes(needle)),
  );

  const togglePaid = (invoice: Invoice) => {
    if (invoice.paid) {
      const done = dispatch({ type: 'invoice/setPaid', id: invoice.id, paidAt: null });
      toast(withStoredNote(`Faktura ${invoice.number} je zpátky mezi nezaplacenými.`, done));
    } else {
      const done = dispatch({ type: 'invoice/setPaid', id: invoice.id, paidAt: today });
      const tone = done.result === 'stored' ? 'happy' : 'watch';
      toast(withStoredNote(`Faktura ${invoice.number} je zaplacená. Dobrá práce.`, done), tone);
    }
  };

  return (
    <div className="page container">
      <header className="page__head">
        <div>
          <h1>Faktury</h1>
          <p className="page__lead">
            {stats.overdue.count > 0
              ? `${czechPlural(stats.overdue.count, INVOICES)} po splatnosti. Stojí za to se připomenout.`
              : 'Nic není po splatnosti. Hlídám dál.'}
          </p>
        </div>
      </header>

      <section className="stats" aria-label="Souhrn">
        <div className="stat">
          <span className="stat__label">Celkem vystaveno</span>
          <strong className="stat__value">{formatCzkRound(stats.all.total)}</strong>
          <span className="stat__meta">{czechPlural(stats.all.count, INVOICES)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Čeká na platbu</span>
          <strong className="stat__value">{formatCzkRound(stats.pending.total)}</strong>
          <span className="stat__meta">{czechPlural(stats.pending.count, INVOICES)} ve splatnosti</span>
        </div>
        <div className={`stat${stats.overdue.count > 0 ? ' stat--alert' : ''}`}>
          <span className="stat__label">Po splatnosti</span>
          <strong className="stat__value">{formatCzkRound(stats.overdue.total)}</strong>
          <span className="stat__meta">{czechPlural(stats.overdue.count, INVOICES)}</span>
          <Eyes size={26} mood={stats.overdue.count > 0 ? 'watch' : 'happy'} variant="solid" className="stat__eyes" />
        </div>
      </section>

      <section className="list-main" aria-label="Seznam faktur">
        <div className="toolbar">
          <div className="filters" role="group" aria-label="Filtr podle stavu">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="filter"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span className="filter__count">{stats[item.id].count}</span>
              </button>
            ))}
          </div>
          <label className="search">
            <span className="visually-hidden">Hledat podle čísla nebo odběratele</span>
            <IconSearch size={18} />
            <input
              type="search"
              placeholder="Hledat číslo nebo odběratele"
              maxLength={100}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <Eyes size={44} mood="follow" variant="outline" />
            <h2>{rows.length === 0 ? 'Zatím tu není žádná faktura' : 'Tomuhle výběru nic neodpovídá'}</h2>
            <p>
              {rows.length === 0
                ? 'Vystav první a objeví se tady i se stavem platby.'
                : 'Zkus jiný filtr nebo kratší hledaný text.'}
            </p>
            {rows.length === 0 ? (
              <a className="btn btn--primary" href={toHash({ name: 'nova' })}>
                Vystavit fakturu
              </a>
            ) : (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => {
                  setFilter('all');
                  setQuery('');
                }}
              >
                Zobrazit všechny
              </button>
            )}
          </div>
        ) : (
          <ul className="invoices">
            <li className="invoices__head" aria-hidden="true">
              <span>Číslo</span>
              <span>Odběratel</span>
              <span>Splatnost</span>
              <span className="num">Částka</span>
              <span>Stav</span>
              <span>Akce</span>
            </li>
            {visible.map(({ invoice, status, total }) => (
              <li key={invoice.id} className="invoice-row">
                <a className="invoice-row__number" href={toHash({ name: 'faktura', id: invoice.id })}>
                  {invoice.number}
                </a>
                <div className="invoice-row__customer">
                  <strong>{invoice.customer.name}</strong>
                  <span>vystaveno {formatCzechDate(invoice.issueDate)}</span>
                </div>
                <div className="invoice-row__due">
                  <strong>{formatCzechDate(invoice.dueDate)}</strong>
                  <span>{dueLabel(invoice, today)}</span>
                </div>
                <strong className="invoice-row__total num">{formatCzk(total)}</strong>
                <div className="invoice-row__status">
                  <StatusChip status={status} />
                </div>
                <div className="invoice-row__actions">
                  <a
                    className="icon-btn"
                    href={toHash({ name: 'faktura', id: invoice.id })}
                    aria-label={`Otevřít fakturu ${invoice.number}`}
                    title="Otevřít"
                  >
                    <IconEye />
                  </a>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => duplicate(invoice)}
                    aria-label={`Duplikovat fakturu ${invoice.number}`}
                    title="Duplikovat"
                  >
                    <IconCopy />
                  </button>
                  <a
                    className="icon-btn"
                    href={toHash({ name: 'upravit', id: invoice.id })}
                    aria-label={`Upravit fakturu ${invoice.number}`}
                    title="Upravit"
                  >
                    <IconPencil />
                  </a>
                  <button
                    type="button"
                    className={`icon-btn${invoice.paid ? '' : ' icon-btn--accent'}`}
                    onClick={() => togglePaid(invoice)}
                    aria-label={
                      invoice.paid
                        ? `Vrátit fakturu ${invoice.number} mezi nezaplacené`
                        : `Označit fakturu ${invoice.number} jako zaplacenou`
                    }
                    title={invoice.paid ? 'Vrátit mezi nezaplacené' : 'Označit jako zaplacenou'}
                  >
                    {invoice.paid ? <IconUndo /> : <IconCheck />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StatsPanel invoices={data.invoices} today={today} />
    </div>
  );
}
