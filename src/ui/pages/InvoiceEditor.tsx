import { useEffect, useState } from 'react';
import { isValidDic } from '../../czech/dic';
import { isValidIco } from '../../czech/ico';
import { addDays, diffDays, formatCzechDate } from '../../domain/dates';
import {
  VAT_RATES,
  type CatalogItem,
  type Invoice,
  type InvoiceItem,
  type Party,
  type VatRate,
} from '../../domain/invoice';
import { uniqueInvoiceId, variableSymbolFor } from '../../domain/invoiceNumber';
import { computeTotals, itemTotalCents } from '../../domain/invoiceTotals';
import { invoiceProblem } from '../../domain/invoiceValidation';
import { LIMITS } from '../../domain/limits';
import { centsToInput, formatCzk, formatQuantity, parseCents, parseQuantity } from '../../domain/money';
import { createBlankInvoice, newItem } from '../../domain/newInvoice';
import { numberTakenProblem } from '../../domain/records';
import { savedProfile, snapshotOf } from '../../domain/supplierProfile';
import { loadDraft, saveDraft } from '../../storage/appDataStorage';
import { newRowId, todayIso } from '../clock';
import { AdSlot } from '../components/AdSlot';
import { DecimalInput } from '../components/DecimalInput';
import { Eyes } from '../components/Eyes';
import { Field } from '../components/Field';
import { IconDownload, IconPlus, IconTrash } from '../components/Icons';
import { InvoicePaper } from '../components/InvoicePaper';
import { NotFound } from '../components/NotFound';
import { useToast } from '../components/Toast';
import { Toggle } from '../components/Toggle';
import { navigate } from '../router';
import { useStore } from '../StoreProvider';
import { useDocumentTitle } from '../useDocumentTitle';

const TERMS = [7, 14, 30];
const CATALOG_LIST = 'catalog-items';
const norm = (text: string) => text.trim().toLowerCase();

interface ItemRowProps {
  item: InvoiceItem;
  index: number;
  vatPayer: boolean;
  removable: boolean;
  catalog: CatalogItem[];
  onChange: (changes: Partial<InvoiceItem>) => void;
  onRemove: () => void;
}

function ItemRow({ item, index, vatPayer, removable, catalog, onChange, onRemove }: ItemRowProps) {
  const changeDescription = (description: string) => {
    const picked = catalog.find((entry) => norm(entry.description) === norm(description));
    onChange(
      picked
        ? { description, unit: picked.unit, unitPriceCents: picked.unitPriceCents, vatRate: picked.vatRate }
        : { description },
    );
  };

  return (
    <li className="item">
      <Field label="Popis" htmlFor={`i-desc-${item.id}`} className="item__desc">
        <input
          id={`i-desc-${item.id}`}
          className="input"
          placeholder="Co fakturuješ"
          list={CATALOG_LIST}
          maxLength={LIMITS.text}
          value={item.description}
          onChange={(event) => changeDescription(event.target.value)}
        />
      </Field>
      <Field label="Množství" htmlFor={`i-qty-${item.id}`}>
        <DecimalInput
          id={`i-qty-${item.id}`}
          value={item.quantity}
          format={formatQuantity}
          parse={parseQuantity}
          onCommit={(quantity) => onChange({ quantity })}
          invalidHint="Zadej číslo, nejvýš 6 desetinných míst."
        />
      </Field>
      <Field label="Jednotka" htmlFor={`i-unit-${item.id}`}>
        <input
          id={`i-unit-${item.id}`}
          className="input"
          maxLength={LIMITS.text}
          value={item.unit}
          onChange={(event) => onChange({ unit: event.target.value })}
        />
      </Field>
      <Field label={vatPayer ? 'Cena bez DPH' : 'Cena za jednotku'} htmlFor={`i-price-${item.id}`}>
        <DecimalInput
          id={`i-price-${item.id}`}
          value={item.unitPriceCents}
          format={centsToInput}
          parse={parseCents}
          onCommit={(unitPriceCents) => onChange({ unitPriceCents })}
          invalidHint="Zadej číslo, nejvýš 2 desetinná místa."
        />
      </Field>
      {vatPayer ? (
        <Field label="DPH" htmlFor={`i-vat-${item.id}`}>
          <select
            id={`i-vat-${item.id}`}
            className="input"
            value={item.vatRate}
            onChange={(event) => onChange({ vatRate: Number(event.target.value) as VatRate })}
          >
            {VAT_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate} %
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="item__total">
        <span>Celkem</span>
        <strong>{formatCzk(itemTotalCents(item))}</strong>
      </div>
      <button
        type="button"
        className="icon-btn item__remove"
        aria-label={`Odebrat položku ${index + 1}`}
        title="Odebrat položku"
        disabled={!removable}
        onClick={onRemove}
      >
        <IconTrash />
      </button>
    </li>
  );
}

function withoutLegacy(item: InvoiceItem, changes: Partial<InvoiceItem>): InvoiceItem {
  const next = { ...item, ...changes };
  // An edited amount is computed exactly again; the migrated v1 rounding applies to the unchanged line only.
  if ('quantity' in changes || 'unitPriceCents' in changes) delete next.legacyLineCents;
  return next;
}

export function InvoiceEditor({ editId }: { editId?: string }) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const isNew = editId === undefined;
  const existing = isNew ? undefined : data.invoices.find((invoice) => invoice.id === editId);
  const [initial] = useState<Invoice>(() =>
    existing
      ? structuredClone(existing)
      : (loadDraft(window.localStorage) ?? createBlankInvoice(data, todayIso(), newRowId)),
  );
  const [draft, setDraft] = useState(initial);
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form');
  useDocumentTitle(existing ? `Úprava faktury ${existing.number}` : 'Nová faktura');

  // The unsaved new invoice survives a reload once the user changed something; a refused write only loses that.
  useEffect(() => {
    if (isNew && draft !== initial) saveDraft(window.localStorage, draft);
  }, [isNew, draft, initial]);

  if (!isNew && !existing) return <NotFound />;

  // A new invoice takes the supplier profile as it is now; an issued one keeps its own snapshot.
  const invoice: Invoice = isNew ? { ...draft, supplier: snapshotOf(savedProfile(data)) } : draft;
  const vatPayer = invoice.supplier.vatPayer;
  const totals = computeTotals(invoice.items, vatPayer);
  const term = diffDays(invoice.issueDate, invoice.dueDate);
  const { customer } = invoice;

  const patch = (changes: Partial<Invoice>) => setDraft((current) => ({ ...current, ...changes }));
  const patchCustomer = (changes: Partial<Party>) =>
    setDraft((current) => ({ ...current, customer: { ...current.customer, ...changes } }));
  const patchItem = (id: string, changes: Partial<InvoiceItem>) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? withoutLegacy(item, changes) : item)),
    }));

  const changeNumber = (number: string) => {
    // The variable symbol follows the number until the user types their own.
    const vsIsAuto = draft.variableSymbol === variableSymbolFor(draft.number);
    patch({ number, ...(vsIsAuto ? { variableSymbol: variableSymbolFor(number) } : {}) });
  };

  const changeIssueDate = (issueDate: string) => {
    if (!issueDate) return;
    const supplyFollows = draft.taxableSupplyDate === draft.issueDate;
    patch({
      issueDate,
      dueDate: addDays(issueDate, Math.max(0, term || 0)),
      ...(supplyFollows ? { taxableSupplyDate: issueDate } : {}),
    });
  };

  /** Validates and saves; returns null (after a Czech message) when the invoice cannot be saved. */
  const commit = (): Invoice | null => {
    const takenIds = new Set(data.invoices.map((i) => i.id));
    const id = isNew && takenIds.has(invoice.id) ? uniqueInvoiceId(invoice.number, takenIds) : invoice.id;
    const toSave = { ...invoice, id };
    const problem = invoiceProblem(toSave) ?? numberTakenProblem(data, toSave);
    if (problem) {
      setMobileView('form');
      toast(problem);
      return null;
    }
    dispatch({ type: 'invoice/save', invoice: toSave, now: new Date().toISOString() });
    if (isNew) saveDraft(window.localStorage, null);
    return toSave;
  };

  const save = () => {
    const saved = commit();
    if (!saved) return;
    toast(`Faktura ${saved.number} je uložená. Hlídám ji do ${formatCzechDate(saved.dueDate)}.`, 'happy');
    navigate({ name: 'faktura', id: saved.id });
  };

  const downloadPdf = () => {
    const saved = commit();
    if (!saved) return;
    // Print uses @media print in app.css: only the invoice paper goes to the printer or the PDF.
    window.print();
    navigate({ name: 'faktura', id: saved.id });
  };

  const discard = () => {
    if (isNew) {
      saveDraft(window.localStorage, null);
      navigate({ name: 'faktury' });
    } else {
      navigate({ name: 'faktura', id: invoice.id });
    }
  };

  return (
    <div className="page container">
      <header className="page__head">
        <div>
          <h1>{existing ? `Úprava faktury ${existing.number}` : 'Nová faktura'}</h1>
          <p className="page__lead">
            {existing
              ? 'Dodavatel, DPH a účet zůstávají tak, jak byly při vystavení.'
              : 'Vpravo vidíš fakturu tak, jak půjde do tisku. Mění se, jak píšeš.'}
          </p>
        </div>
        <div className="page__actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={downloadPdf}
            title="Otevře tisk, kde zvolíš Uložit jako PDF."
          >
            <IconDownload size={18} />
            Stáhnout PDF
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Uložit fakturu
          </button>
        </div>
      </header>

      <div className="segmented editor__switch" role="group" aria-label="Zobrazení">
        <button type="button" aria-pressed={mobileView === 'form'} onClick={() => setMobileView('form')}>
          Formulář
        </button>
        <button type="button" aria-pressed={mobileView === 'preview'} onClick={() => setMobileView('preview')}>
          Náhled
        </button>
      </div>

      <div className={`editor editor--${mobileView}`}>
        <form className="editor__form" onSubmit={(event) => event.preventDefault()} noValidate>
          <section className="card">
            <h2 className="card__title">Odběratel</h2>
            {data.customers.length > 0 ? (
              <Field label="Vybrat uloženého odběratele" htmlFor="c-past">
                <select
                  id="c-past"
                  className="input"
                  value=""
                  onChange={(event) => {
                    const picked = data.customers[Number(event.target.value)];
                    if (picked) patchCustomer({ ...picked });
                  }}
                >
                  <option value="">Vybrat ze seznamu</option>
                  {data.customers.map((saved, index) => (
                    <option key={`${saved.ico}-${saved.name}`} value={index}>
                      {saved.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="grid-2">
              <Field label="Název nebo jméno" htmlFor="c-name" className="span-2">
                <input
                  id="c-name"
                  className="input"
                  maxLength={LIMITS.text}
                  value={customer.name}
                  onChange={(event) => patchCustomer({ name: event.target.value })}
                />
              </Field>
              <Field label="Ulice a číslo" htmlFor="c-street" className="span-2">
                <input
                  id="c-street"
                  className="input"
                  maxLength={LIMITS.text}
                  value={customer.street}
                  onChange={(event) => patchCustomer({ street: event.target.value })}
                />
              </Field>
              <Field label="PSČ" htmlFor="c-zip">
                <input
                  id="c-zip"
                  className="input"
                  inputMode="numeric"
                  maxLength={LIMITS.text}
                  value={customer.zip}
                  onChange={(event) => patchCustomer({ zip: event.target.value })}
                />
              </Field>
              <Field label="Město" htmlFor="c-city">
                <input
                  id="c-city"
                  className="input"
                  maxLength={LIMITS.text}
                  value={customer.city}
                  onChange={(event) => patchCustomer({ city: event.target.value })}
                />
              </Field>
              <Field
                label="IČO (nepovinné)"
                htmlFor="c-ico"
                hint={
                  customer.ico && !isValidIco(customer.ico)
                    ? 'IČO neprošlo kontrolou. U zahraničního odběratele to nevadí.'
                    : undefined
                }
              >
                <input
                  id="c-ico"
                  className="input"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={LIMITS.text}
                  value={customer.ico}
                  onChange={(event) => patchCustomer({ ico: event.target.value })}
                />
              </Field>
              <Field
                label="DIČ (nepovinné)"
                htmlFor="c-dic"
                hint={customer.dic && !isValidDic(customer.dic) ? 'České DIČ má tvar CZ a 8 až 10 číslic.' : undefined}
              >
                <input
                  id="c-dic"
                  className="input"
                  maxLength={LIMITS.text}
                  value={customer.dic}
                  onChange={(event) => patchCustomer({ dic: event.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Položky</h2>
            <datalist id={CATALOG_LIST}>
              {data.items.map((entry) => (
                <option key={entry.description} value={entry.description} />
              ))}
            </datalist>
            <ul className={`items${vatPayer ? ' items--vat' : ''}`}>
              {draft.items.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  vatPayer={vatPayer}
                  removable={draft.items.length > 1}
                  catalog={data.items}
                  onChange={(changes) => patchItem(item.id, changes)}
                  onRemove={() => patch({ items: draft.items.filter((other) => other.id !== item.id) })}
                />
              ))}
            </ul>
            <div className="items__foot">
              <button
                type="button"
                className="btn btn--outline"
                disabled={draft.items.length >= LIMITS.itemsPerInvoice}
                onClick={() => patch({ items: [...draft.items, newItem(vatPayer, newRowId)] })}
              >
                <IconPlus size={18} />
                Přidat položku
              </button>
              <p className="items__sum">
                Celkem k úhradě <strong>{formatCzk(totals.totalCents)}</strong>
              </p>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Termíny a platba</h2>
            <div className="grid-2">
              <Field label="Číslo faktury" htmlFor="f-number">
                <input
                  id="f-number"
                  className="input"
                  maxLength={LIMITS.text}
                  value={draft.number}
                  onChange={(event) => changeNumber(event.target.value)}
                />
              </Field>
              <Field label="Variabilní symbol" htmlFor="f-vs" hint="Podle něj spáruješ platbu. Nejvýš 10 číslic.">
                <input
                  id="f-vs"
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  value={draft.variableSymbol}
                  onChange={(event) => patch({ variableSymbol: event.target.value.replace(/\D/g, '').slice(0, 10) })}
                />
              </Field>
              <Field label="Datum vystavení" htmlFor="f-issue">
                <input
                  id="f-issue"
                  className="input"
                  type="date"
                  value={draft.issueDate}
                  onChange={(event) => changeIssueDate(event.target.value)}
                />
              </Field>
              <Field label="Datum splatnosti" htmlFor="f-due">
                <input
                  id="f-due"
                  className="input"
                  type="date"
                  min={draft.issueDate}
                  value={draft.dueDate}
                  onChange={(event) => event.target.value && patch({ dueDate: event.target.value })}
                />
              </Field>
              {vatPayer ? (
                <Field
                  label="Datum zdanitelného plnění (DUZP)"
                  htmlFor="f-duzp"
                  className="span-2"
                  hint="Na daňovém dokladu je povinné. Obvykle je stejné jako datum vystavení."
                >
                  <input
                    id="f-duzp"
                    className="input"
                    type="date"
                    value={draft.taxableSupplyDate}
                    onChange={(event) => event.target.value && patch({ taxableSupplyDate: event.target.value })}
                  />
                </Field>
              ) : null}
            </div>
            <div className="terms" role="group" aria-label="Rychlá volba splatnosti">
              <span>Splatnost za</span>
              {TERMS.map((days) => (
                <button
                  key={days}
                  type="button"
                  className="filter"
                  aria-pressed={term === days}
                  onClick={() => patch({ dueDate: addDays(draft.issueDate, days) })}
                >
                  {days} dní
                </button>
              ))}
            </div>
            <Toggle
              checked={draft.showQr}
              onChange={(showQr) => patch({ showQr })}
              label="QR platba na faktuře"
              hint={
                invoice.supplier.bankAccount
                  ? `Z účtu ${invoice.supplier.bankAccount}, částky a variabilního symbolu.`
                  : 'Nejdřív doplň číslo účtu v nastavení.'
              }
            />
          </section>

          <section className="card">
            <h2 className="card__title">Poznámka</h2>
            <Field label="Text pod součtem (nepovinné)" htmlFor="f-note">
              <textarea
                id="f-note"
                className="input textarea"
                rows={3}
                maxLength={LIMITS.note}
                value={draft.note}
                onChange={(event) => patch({ note: event.target.value })}
              />
            </Field>
          </section>

          <div className="editor__save">
            <button type="button" className="btn btn--primary btn--lg" onClick={save}>
              Uložit fakturu
            </button>
            <button type="button" className="btn btn--outline btn--lg" onClick={downloadPdf}>
              <IconDownload size={18} />
              Stáhnout PDF
            </button>
            <button type="button" className="btn btn--ghost" onClick={discard}>
              Zahodit změny
            </button>
            <p className="field__hint">Stáhnout PDF fakturu uloží a otevře tisk, kde zvolíš Uložit jako PDF.</p>
          </div>
        </form>

        <aside className="editor__preview" aria-label="Náhled faktury">
          <div className="editor__preview-head">
            <Eyes size={20} mood="read" variant="outline" />
            <span>Živý náhled</span>
          </div>
          <InvoicePaper invoice={invoice} />
        </aside>
      </div>

      <AdSlot />
    </div>
  );
}
