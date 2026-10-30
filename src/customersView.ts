import { h } from './dom';
import type { Party } from './invoice';

export interface CustomerActions {
  invoiceFor: (customer: Party) => void;
  remove: (customer: Party) => void;
}

export function renderCustomers(customers: Party[], actions: CustomerActions): HTMLElement {
  if (customers.length === 0) {
    return h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Odběratelé'),
      h('p', { class: 'empty' }, 'Odběratel se uloží sám, když uložíte fakturu.'),
    );
  }
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, 'Odběratelé'),
    h(
      'table',
      { class: 'list' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', {}, 'Název'),
          h('th', {}, 'Adresa'),
          h('th', {}, 'IČO'),
          h('th', {}, 'DIČ'),
          h('th', {}, ''),
        ),
      ),
      h(
        'tbody',
        {},
        ...customers.map((c) => {
          const invoice = h('button', { type: 'button' }, 'Nová faktura');
          invoice.addEventListener('click', () => actions.invoiceFor(c));
          const remove = h('button', { type: 'button' }, 'Smazat');
          remove.addEventListener('click', () => {
            if (confirm(`Smazat odběratele ${c.name}? Faktury v historii zůstanou.`)) actions.remove(c);
          });
          return h(
            'tr',
            {},
            h('td', {}, c.name),
            h('td', {}, [c.street, c.city].filter(Boolean).join(', ')),
            h('td', {}, c.ico),
            h('td', {}, c.dic),
            h('td', { class: 'actions' }, invoice, remove),
          );
        }),
      ),
    ),
  );
}
