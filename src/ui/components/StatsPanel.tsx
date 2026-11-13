import type { Invoice } from '../../domain/invoice';
import { invoiceStats } from '../../domain/invoiceStats';
import { formatCzkRound } from '../../domain/money';
import { czechPlural, INVOICES } from '../czechPlural';

const MONTH = new Intl.DateTimeFormat('cs-CZ', { month: 'short' });
const TOP_CUSTOMERS = 5;

function monthLabel(month: string): string {
  const [y = 0, m = 1] = month.split('-').map(Number);
  return MONTH.format(new Date(y, m - 1, 1));
}

/** Year total, the last 12 months and the best customers, each invoice counted with its own VAT status. */
export function StatsPanel({ invoices, today }: { invoices: Invoice[]; today: string }) {
  if (invoices.length === 0) return null;
  const stats = invoiceStats(invoices, today);
  const highest = Math.max(1, ...stats.months.map((m) => m.cents));

  return (
    <section className="card stats-panel" aria-labelledby="stats-title">
      <h2 className="card__title" id="stats-title">
        Statistiky
      </h2>
      <p className="stats-panel__year">
        Rok {today.slice(0, 4)}: <strong>{formatCzkRound(stats.yearCents)}</strong>, {czechPlural(stats.yearCount, INVOICES)}
      </p>
      <ol className="stats-panel__months" aria-label="Fakturováno za posledních 12 měsíců">
        {stats.months.map((m) => (
          <li key={m.month} title={`${monthLabel(m.month)}: ${formatCzkRound(m.cents)}`}>
            <span
              className="stats-panel__bar"
              style={{ height: `${Math.max(0, Math.round((m.cents / highest) * 100))}%` }}
            />
            <span className="stats-panel__month">{monthLabel(m.month)}</span>
            <span className="visually-hidden">{formatCzkRound(m.cents)}</span>
          </li>
        ))}
      </ol>
      <h3 className="stats-panel__subtitle">Největší odběratelé</h3>
      <ul className="stats-panel__customers">
        {stats.customers.slice(0, TOP_CUSTOMERS).map((c) => (
          <li key={`${c.name}-${c.count}-${c.cents}`}>
            <span>{c.name || 'Bez názvu'}</span>
            <span className="num">
              {formatCzkRound(c.cents)} · {czechPlural(c.count, INVOICES)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
