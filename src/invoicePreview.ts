import { czechAccountToIban } from './czechIban';
import { formatCzechDate } from './dates';
import { h } from './dom';
import type { Invoice, Party } from './invoice';
import { formatCzk, lineTotalCents } from './money';
import { qrSvg } from './qrSvg';
import { buildSpayd } from './spayd';

function partyBlock(title: string, party: Party, extra: string | null): HTMLElement {
  return h(
    'section',
    { class: 'party' },
    h('h2', {}, title),
    h('p', { class: 'party-name' }, party.name),
    h('p', {}, party.street),
    h('p', {}, party.city),
    h(
      'dl',
      {},
      party.ico && h('dt', {}, 'IČO'),
      party.ico && h('dd', {}, party.ico),
      party.dic && h('dt', {}, 'DIČ'),
      party.dic && h('dd', {}, party.dic),
    ),
    extra && h('p', { class: 'note' }, extra),
  );
}

function row(label: string, value: string): HTMLElement[] {
  return [h('dt', {}, label), h('dd', {}, value)];
}

export function renderInvoice(invoice: Invoice): HTMLElement {
  const lines = invoice.items.filter((item) => item.description.trim() || item.unitPrice.trim());
  const totalCents = lines.reduce((sum, item) => sum + lineTotalCents(item.quantity, item.unitPrice), 0);
  const iban = czechAccountToIban(invoice.bankAccount);

  const items = h(
    'table',
    { class: 'items' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, ''), h('th', {}, 'Cena za MJ'), h('th', {}, 'Celkem'))),
    h(
      'tbody',
      {},
      ...lines.map((item) =>
        h(
          'tr',
          {},
          h('td', { class: 'qty' }, `${item.quantity} ${item.unit}`.trim()),
          h('td', {}, item.description),
          h('td', { class: 'num' }, formatCzk(lineTotalCents('1', item.unitPrice))),
          h('td', { class: 'num' }, formatCzk(lineTotalCents(item.quantity, item.unitPrice))),
        ),
      ),
    ),
  );

  const qr = iban && totalCents > 0 ? h('figure', { class: 'qr' }) : null;
  if (qr && iban) {
    qr.innerHTML = qrSvg(
      buildSpayd({
        iban,
        amountCents: totalCents,
        variableSymbol: invoice.variableSymbol,
        dueDate: invoice.dueDate,
        message: `Faktura ${invoice.number}`,
      }),
    );
    qr.append(h('figcaption', {}, 'QR Platba'));
  }

  return h(
    'article',
    { class: 'invoice' },
    h('header', {}, h('h1', {}, `Faktura ${invoice.number}`)),
    h(
      'div',
      { class: 'parties' },
      partyBlock('Dodavatel', invoice.supplier, invoice.vatPayer ? null : 'Neplátce DPH'),
      partyBlock('Odběratel', invoice.customer, null),
    ),
    h(
      'dl',
      { class: 'payment' },
      ...row('Bankovní účet', invoice.bankAccount),
      ...row('Variabilní symbol', invoice.variableSymbol),
      ...row('Způsob platby', invoice.paymentMethod),
      ...row('Datum vystavení', formatCzechDate(invoice.issueDate)),
      ...row('Datum splatnosti', formatCzechDate(invoice.dueDate)),
    ),
    items,
    h(
      'div',
      { class: 'summary' },
      qr,
      h('p', { class: 'total' }, h('span', {}, 'Celkem k úhradě'), h('strong', {}, formatCzk(totalCents))),
    ),
    h('footer', {}, invoice.registryNote),
  );
}
