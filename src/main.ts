import './style.css';
import type { Invoice } from './invoice';
import { renderForm } from './invoiceForm';
import { renderInvoice } from './invoicePreview';
import { loadDraft, saveDraft } from './invoiceStorage';
import { newInvoice } from './newInvoice';

const editor = document.querySelector<HTMLElement>('#editor')!;
const preview = document.querySelector<HTMLElement>('#preview')!;

let invoice: Invoice = loadDraft() ?? newInvoice(null);

function refreshPreview(): void {
  preview.replaceChildren(renderInvoice(invoice));
  document.title = `Faktura ${invoice.number} – Fakturka`;
}

function onChange(): void {
  saveDraft(invoice);
  refreshPreview();
}

function mount(): void {
  editor.replaceChildren(renderForm(invoice, onChange));
  refreshPreview();
}

document.querySelector('#print')!.addEventListener('click', () => window.print());
document.querySelector('#new')!.addEventListener('click', () => {
  invoice = newInvoice(invoice);
  saveDraft(invoice);
  mount();
});

mount();
