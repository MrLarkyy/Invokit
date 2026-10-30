import { h } from './dom';
import type { Invoice, InvoiceItem, Party } from './invoice';

type TextKey = 'number' | 'issueDate' | 'dueDate' | 'variableSymbol' | 'bankAccount' | 'paymentMethod' | 'registryNote';

/** The edit form. It mutates the invoice in place and calls onChange after every edit. */
export function renderForm(invoice: Invoice, onChange: () => void): HTMLElement {
  function text(label: string, value: string, set: (v: string) => void, type = 'text'): HTMLElement {
    const input = h('input', { type, value });
    input.addEventListener('input', () => {
      set(input.value);
      onChange();
    });
    return h('label', {}, h('span', {}, label), input);
  }

  function field(label: string, key: TextKey, type = 'text'): HTMLElement {
    return text(label, invoice[key], (v) => (invoice[key] = v), type);
  }

  function party(title: string, p: Party): HTMLElement {
    return h(
      'fieldset',
      {},
      h('legend', {}, title),
      text('Jméno / firma', p.name, (v) => (p.name = v)),
      text('Ulice', p.street, (v) => (p.street = v)),
      text('PSČ a obec', p.city, (v) => (p.city = v)),
      h(
        'div',
        { class: 'pair' },
        text('IČO', p.ico, (v) => (p.ico = v)),
        text('DIČ', p.dic, (v) => (p.dic = v)),
      ),
    );
  }

  const itemList = h('div', { class: 'item-list' });
  function itemRow(item: InvoiceItem): HTMLElement {
    const remove = h('button', { type: 'button', class: 'remove', title: 'Odebrat položku' }, '×');
    const rowEl = h(
      'div',
      { class: 'item' },
      text('Množství', item.quantity, (v) => (item.quantity = v)),
      text('Jednotka', item.unit, (v) => (item.unit = v)),
      text('Popis', item.description, (v) => (item.description = v)),
      text('Cena za MJ', item.unitPrice, (v) => (item.unitPrice = v)),
      remove,
    );
    remove.addEventListener('click', () => {
      invoice.items.splice(invoice.items.indexOf(item), 1);
      rowEl.remove();
      onChange();
    });
    return rowEl;
  }
  itemList.append(...invoice.items.map(itemRow));
  const add = h('button', { type: 'button' }, '+ Přidat položku');
  add.addEventListener('click', () => {
    const item: InvoiceItem = { quantity: '1', unit: 'ks', description: '', unitPrice: '' };
    invoice.items.push(item);
    itemList.append(itemRow(item));
    onChange();
  });

  const vatPayer = h('input', { type: 'checkbox' });
  vatPayer.checked = invoice.vatPayer;
  vatPayer.addEventListener('change', () => {
    invoice.vatPayer = vatPayer.checked;
    onChange();
  });

  return h(
    'form',
    { class: 'editor', autocomplete: 'off' },
    h(
      'fieldset',
      {},
      h('legend', {}, 'Faktura'),
      field('Číslo faktury', 'number'),
      h(
        'div',
        { class: 'pair' },
        field('Datum vystavení', 'issueDate', 'date'),
        field('Datum splatnosti', 'dueDate', 'date'),
      ),
      h(
        'div',
        { class: 'pair' },
        field('Variabilní symbol', 'variableSymbol'),
        field('Způsob platby', 'paymentMethod'),
      ),
      field('Bankovní účet (např. 1234567899/0100)', 'bankAccount'),
    ),
    party('Dodavatel', invoice.supplier),
    h(
      'fieldset',
      {},
      h('label', { class: 'check' }, vatPayer, h('span', {}, 'Plátce DPH')),
      field('Poznámka v patičce', 'registryNote'),
    ),
    party('Odběratel', invoice.customer),
    h('fieldset', {}, h('legend', {}, 'Položky'), itemList, add),
  );
}
