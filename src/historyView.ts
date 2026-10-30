import type { SavedInvoice } from './appData';
import { formatCzechDate } from './dates';
import { h } from './dom';
import { invoiceTotalCents } from './invoiceTotal';
import { formatCzk } from './money';

export interface HistoryActions {
  open: (invoice: SavedInvoice) => void;
  togglePaid: (invoice: SavedInvoice) => void;
  remove: (invoice: SavedInvoice) => void;
}

function button(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: cls }, text);
  b.addEventListener('click', onClick);
  return b;
}

export function renderHistory(invoices: SavedInvoice[], today: string, actions: HistoryActions): HTMLElement {
  if (invoices.length === 0) {
    return h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Historie faktur'),
      h('p', { class: 'empty' }, 'Zatím žádná uložená faktura. Fakturu uložíte tlačítkem Uložit nebo tiskem.'),
    );
  }
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, 'Historie faktur'),
    h(
      'table',
      { class: 'list' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', {}, 'Číslo'),
          h('th', {}, 'Odběratel'),
          h('th', {}, 'Vystaveno'),
          h('th', {}, 'Splatnost'),
          h('th', { class: 'num' }, 'Částka'),
          h('th', {}, 'Stav'),
          h('th', {}, ''),
        ),
      ),
      h(
        'tbody',
        {},
        ...invoices.map((invoice) => {
          const overdue = !invoice.paid && invoice.dueDate < today;
          const state = invoice.paid ? 'Zaplaceno' : overdue ? 'Po splatnosti' : 'Nezaplaceno';
          const stateClass = invoice.paid ? 'paid' : overdue ? 'overdue' : 'open';
          return h(
            'tr',
            {},
            h('td', {}, invoice.number),
            h('td', {}, invoice.customer.name),
            h('td', {}, formatCzechDate(invoice.issueDate)),
            h('td', {}, formatCzechDate(invoice.dueDate)),
            h('td', { class: 'num' }, formatCzk(invoiceTotalCents(invoice))),
            h(
              'td',
              {},
              button(state, () => actions.togglePaid(invoice), `state ${stateClass}`),
            ),
            h(
              'td',
              { class: 'actions' },
              button('Otevřít', () => actions.open(invoice)),
              button('Smazat', () => {
                if (confirm(`Smazat fakturu ${invoice.number}?`)) actions.remove(invoice);
              }),
            ),
          );
        }),
      ),
    ),
  );
}
