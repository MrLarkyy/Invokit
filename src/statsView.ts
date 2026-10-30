import type { SavedInvoice } from './appData';
import { czechPlural, INVOICES } from './czechPlural';
import { h } from './dom';
import { invoiceStats } from './invoiceStats';
import { formatCzk } from './money';

const MONTHS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

function card(label: string, value: string, sub: string): HTMLElement {
  return h('div', { class: 'card' }, h('span', {}, label), h('strong', {}, value), h('small', {}, sub));
}

export function renderStats(invoices: SavedInvoice[], today: string): HTMLElement {
  const stats = invoiceStats(invoices, today);
  const max = Math.max(1, ...stats.months.map((m) => m.cents));
  const year = today.slice(0, 4);
  const average = stats.yearCount ? Math.round(stats.yearCents / stats.yearCount) : 0;

  const chart = h(
    'div',
    { class: 'chart', role: 'img', 'aria-label': 'Fakturováno za posledních 12 měsíců' },
    ...stats.months.map((m) => {
      const bar = h('div', { class: 'bar', title: formatCzk(m.cents) });
      bar.style.height = `${(m.cents / max) * 100}%`;
      const label = MONTHS[Number(m.month.slice(5)) - 1] ?? '';
      return h('div', { class: 'col' }, h('div', { class: 'track' }, bar), h('span', {}, label));
    }),
  );

  const byCustomer = stats.customers.length
    ? h(
        'table',
        { class: 'list' },
        h(
          'tbody',
          {},
          ...stats.customers.map((c) =>
            h('tr', {}, h('td', {}, c.name), h('td', {}, `${c.count}×`), h('td', { class: 'num' }, formatCzk(c.cents))),
          ),
        ),
      )
    : h('p', { class: 'empty' }, 'Zatím žádná data.');

  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, 'Statistiky'),
    h(
      'div',
      { class: 'cards' },
      card(`Fakturováno ${year}`, formatCzk(stats.yearCents), czechPlural(stats.yearCount, INVOICES)),
      card(
        'Nezaplaceno',
        formatCzk(stats.unpaidCents),
        `${czechPlural(stats.unpaidCount, INVOICES)}, ${stats.overdueCount} po splatnosti`,
      ),
      card('Průměr na fakturu', formatCzk(average), `v roce ${year}`),
    ),
    h('h3', {}, 'Posledních 12 měsíců'),
    chart,
    h('h3', {}, 'Podle odběratele'),
    byCustomer,
  );
}
