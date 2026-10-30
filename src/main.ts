import './style.css';
import type { AppData } from './appData';
import { loadAppData, saveAppData } from './appDataStorage';
import { downloadBackup, readBackup } from './backupFile';
import { renderCustomers } from './customersView';
import { CUSTOMERS, czechPlural, INVOICES } from './czechPlural';
import { toIsoDate } from './dates';
import { renderHistory } from './historyView';
import type { Invoice, Party } from './invoice';
import { renderForm } from './invoiceForm';
import { renderInvoice } from './invoicePreview';
import { loadDraft, saveDraft } from './invoiceStorage';
import { newInvoice } from './newInvoice';
import { latestNumber, saveInvoice, sameParty, toDraft } from './records';
import { renderStats } from './statsView';

type Tab = 'invoice' | 'history' | 'customers' | 'stats';

const editor = document.querySelector<HTMLElement>('#editor')!;
const preview = document.querySelector<HTMLElement>('#preview')!;
const invoiceView = document.querySelector<HTMLElement>('#invoice-view')!;
const otherView = document.querySelector<HTMLElement>('#other-view')!;
const status = document.querySelector<HTMLElement>('#status')!;

const today = () => toIsoDate(new Date());
let data: AppData = loadAppData();
let invoice: Invoice = loadDraft() ?? newInvoice(null);
let tab: Tab = 'invoice';

function flash(message: string): void {
  status.textContent = message;
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 3000);
}

function setData(next: AppData): void {
  data = next;
  saveAppData(data);
}

function refreshPreview(): void {
  preview.replaceChildren(renderInvoice(invoice));
  document.title = `Faktura ${invoice.number} – Invokit`;
}

function onChange(): void {
  saveDraft(invoice);
  refreshPreview();
}

function mountEditor(): void {
  editor.replaceChildren(renderForm(invoice, data, onChange, mountEditor));
  onChange();
}

function startInvoice(customer: Party | null): void {
  const previous = { ...invoice, number: latestNumber(data, invoice.number) };
  invoice = newInvoice(previous, today());
  if (customer) {
    invoice.customer = { ...customer };
    invoice.items = [{ quantity: '1', unit: 'ks', description: '', unitPrice: '' }];
  }
  show('invoice');
  mountEditor();
}

function store(): void {
  setData(saveInvoice(data, invoice, new Date().toISOString()));
  mountEditor();
}

function renderOther(): HTMLElement {
  switch (tab) {
    case 'history':
      return renderHistory(data.invoices, today(), {
        open: (saved) => {
          invoice = toDraft(saved);
          show('invoice');
          mountEditor();
        },
        togglePaid: (saved) => {
          setData({ ...data, invoices: data.invoices.map((i) => (i === saved ? { ...i, paid: !i.paid } : i)) });
          show('history');
        },
        remove: (saved) => {
          setData({ ...data, invoices: data.invoices.filter((i) => i !== saved) });
          show('history');
        },
      });
    case 'customers':
      return renderCustomers(data.customers, {
        invoiceFor: (customer) => startInvoice(customer),
        remove: (customer) => {
          setData({ ...data, customers: data.customers.filter((c) => !sameParty(c, customer)) });
          show('customers');
        },
      });
    default:
      return renderStats(data.invoices, today());
  }
}

function show(next: Tab): void {
  tab = next;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    button.setAttribute('aria-current', String(button.dataset.tab === tab));
  }
  document.body.dataset.tab = tab;
  invoiceView.hidden = tab !== 'invoice';
  otherView.hidden = tab === 'invoice';
  if (tab !== 'invoice') otherView.replaceChildren(renderOther());
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
  button.addEventListener('click', () => show(button.dataset.tab as Tab));
}
document.querySelector('#new')!.addEventListener('click', () => startInvoice(null));
document.querySelector('#save')!.addEventListener('click', () => {
  store();
  flash(`Faktura ${invoice.number} uložena.`);
});
document.querySelector('#print')!.addEventListener('click', () => {
  store();
  window.print();
});
document.querySelector('#export')!.addEventListener('click', () => downloadBackup(data, today()));
const importInput = document.querySelector<HTMLInputElement>('#import-file')!;
document.querySelector('#import')!.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
  const file = importInput.files?.[0];
  importInput.value = '';
  if (!file) return;
  readBackup(file)
    .then((backup) => {
      const summary = `${czechPlural(backup.invoices.length, INVOICES)}, ${czechPlural(backup.customers.length, CUSTOMERS)}`;
      if (!confirm(`Nahradit současná data zálohou (${summary})?`)) return;
      setData(backup);
      show(tab);
      if (tab === 'invoice') mountEditor();
      flash(`Obnoveno ${summary}.`);
    })
    .catch((error: unknown) => flash(error instanceof Error ? error.message : 'Zálohu nelze načíst.'));
});

show('invoice');
mountEditor();
