import { useEffect, useRef, useState } from 'react';
import { isValidDic } from '../../czech/dic';
import { isValidIco } from '../../czech/ico';
import { addDays, diffDays, formatCzechDate } from '../../domain/dates';
import { defaultAppearance } from '../../domain/invoiceAppearance';
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
import { findInvoiceProblem, isCompleteSupplier, type InvoiceProblem } from '../../domain/invoiceValidation';
import { parseItemPrice, parseItemQuantity } from '../../domain/itemInput';
import { LIMITS } from '../../domain/limits';
import { logoUrl } from '../../domain/logos';
import { centsToInput, formatCzk, formatQuantity } from '../../domain/money';
import { createBlankInvoice, newItem, refreshDraft } from '../../domain/newInvoice';
import { byDescription, byName, saveProblem } from '../../domain/records';
import { completeSupplierSnapshot, savedProfile, snapshotOf } from '../../domain/supplierProfile';
import { newRowId, todayIso } from '../clock';
import { AdSlot } from '../components/AdSlot';
import { DecimalInput } from '../components/DecimalInput';
import { Eyes } from '../components/Eyes';
import { Field } from '../components/Field';
import { IconDownload, IconPlus, IconTrash } from '../components/Icons';
import { InvoicePaper } from '../components/InvoicePaper';
import { NotFound } from '../components/NotFound';
import { TemplatePicker } from '../components/TemplatePicker';
import { useToast } from '../components/Toast';
import { Toggle } from '../components/Toggle';
import { printInvoice } from '../printInvoice';
import { navigate, toHash } from '../router';
import { useStore } from '../StoreProvider';
import { notStored } from '../texts';
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
  /** A save problem of this row, shown under its description. */
  error: string | null;
}

function ItemRow({ item, index, vatPayer, removable, catalog, onChange, onRemove, error }: ItemRowProps) {
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
      <Field label="Popis" htmlFor={`i-desc-${item.id}`} className="item__desc" error={error}>
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
          parse={parseItemQuantity}
          onCommit={(quantity) => onChange({ quantity })}
          invalidHint="Zadej číslo do 1 000 000, nejvýš 6 desetinných míst."
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
          parse={parseItemPrice}
          onCommit={(unitPriceCents) => onChange({ unitPriceCents })}
          invalidHint="Zadej částku do 1 000 000 000 Kč, nejvýš 2 desetinná místa."
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

interface EditorProblem {
  message: string;
  /** The id of the element to mark and focus. */
  targetId: string;
}

function problemTarget(problem: InvoiceProblem, firstItemId: string): string {
  switch (problem.field) {
    case 'supplier':
      return 'supplier-notice';
    case 'customerName':
    case 'customer':
      return 'c-name';
    case 'items':
      return `i-desc-${firstItemId}`;
    case 'item':
      return `i-desc-${problem.itemId ?? firstItemId}`;
    case 'total':
      return 'items-sum';
    case 'number':
      return 'f-number';
    case 'variableSymbol':
      return 'f-vs';
    case 'issueDate':
      return 'f-issue';
    case 'dueDate':
      return 'f-due';
    case 'taxableSupplyDate':
      return 'f-duzp';
    case 'note':
      return 'f-note';
  }
}

function withoutLegacy(item: InvoiceItem, changes: Partial<InvoiceItem>): InvoiceItem {
  const next = { ...item, ...changes };
  // An edited amount is computed exactly again; the migrated v1 rounding applies to the unchanged line only.
  if ('quantity' in changes || 'unitPriceCents' in changes) delete next.legacyLineCents;
  return next;
}

export function InvoiceEditor({ editId }: { editId?: string }) {
  const { data, dispatch, loadDraft, saveDraft } = useStore();
  const toast = useToast();
  const isNew = editId === undefined;
  const existing = isNew ? undefined : data.invoices.find((invoice) => invoice.id === editId);
  const [initial] = useState<Invoice>(() => {
    if (existing) return structuredClone(existing);
    const stored = loadDraft();
    return stored ? refreshDraft(stored, data, todayIso()) : createBlankInvoice(data, todayIso(), newRowId);
  });
  const [draft, setDraftState] = useState(initial);
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form');
  const [problem, setProblem] = useState<EditorProblem | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const setDraft: typeof setDraftState = (next) => {
    setProblem(null);
    setDraftState(next);
  };
  useDocumentTitle(existing ? `Úprava faktury ${existing.number}` : 'Nová faktura');

  // The unsaved new invoice survives a reload once the user changed something (this visit only while it cannot be
  // written to the browser).
  useEffect(() => {
    if (isNew && draft !== initial) saveDraft(draft);
  }, [isNew, draft, initial, saveDraft]);

  // A refused save points at its field: marked, announced and focused.
  useEffect(() => {
    if (problem) document.getElementById(problem.targetId)?.focus();
  }, [problem]);

  if (!isNew && !existing) return <NotFound />;

  // A new invoice takes the supplier profile as it is now. An issued one keeps its own snapshot (VAT status, bank
  // account, notes); only the details it lacks to name its supplier are filled in from the profile.
  const profile = savedProfile(data);
  const supplier = isNew ? snapshotOf(profile) : completeSupplierSnapshot(draft.supplier, profile);
  const supplierFilledIn = !isNew && supplier !== draft.supplier;
  // Likewise the look: a new invoice takes accent, logo and footer from the profile and only its template from the
  // editor; an issued one keeps its own look, of which only the template can be changed here.
  const appearance = isNew
    ? { ...(profile?.appearance ?? defaultAppearance()), template: draft.appearance.template }
    : draft.appearance;
  const invoice: Invoice =
    supplier === draft.supplier && appearance === draft.appearance ? draft : { ...draft, supplier, appearance };
  const supplierComplete = isCompleteSupplier(invoice.supplier);
  const customers = [...data.customers].sort(byName);
  const catalog = [...data.items].sort(byDescription);
  const errorFor = (targetId: string) => (problem?.targetId === targetId ? problem.message : null);
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

  /**
   * Validates and saves; returns null (after a Czech message) when the invoice cannot be saved. `stored` is false
   * when the invoice is kept for this visit only (saving off, write refused, storage blocked).
   */
  const commit = (): { invoice: Invoice; stored: boolean } | null => {
    const takenIds = new Set(data.invoices.map((i) => i.id));
    const id = isNew && takenIds.has(invoice.id) ? uniqueInvoiceId(invoice.number, takenIds) : invoice.id;
    const toSave = { ...invoice, id };
    const invalidNumber = formRef.current?.querySelector<HTMLElement>('[data-invalid-number]');
    const found = findInvoiceProblem(toSave);
    const stored = saveProblem(data, toSave);
    const next: EditorProblem | null = invalidNumber
      ? { message: 'Oprav zvýrazněné číslo u položky.', targetId: invalidNumber.id }
      : found
        ? { message: found.message, targetId: problemTarget(found, draft.items[0]?.id ?? '') }
        : stored
          ? { message: stored, targetId: stored.startsWith('Faktura s číslem') ? 'f-number' : 'items-sum' }
          : null;
    if (next) {
      setMobileView('form');
      setProblem(next);
      return null;
    }
    const inBrowser = dispatch({ type: 'invoice/save', invoice: toSave, now: new Date().toISOString() });
    if (isNew) saveDraft(null);
    return { invoice: toSave, stored: inBrowser };
  };

  const save = () => {
    const done = commit();
    if (!done) return;
    const saved = done.invoice;
    if (done.stored) {
      toast(`Faktura ${saved.number} je uložená. Hlídám ji do ${formatCzechDate(saved.dueDate)}.`, 'happy');
    } else {
      toast(notStored(`faktura ${saved.number} zůstane`));
    }
    navigate({ name: 'faktura', id: saved.id });
  };

  const downloadPdf = () => {
    const done = commit();
    if (!done) return;
    if (!done.stored) toast(notStored(`faktura ${done.invoice.number} zůstane`));
    // Print uses @media print in app.css: only the invoice paper goes to the printer or the PDF.
    printInvoice(done.invoice.number);
    navigate({ name: 'faktura', id: done.invoice.id });
  };

  const discard = () => {
    if (isNew) {
      saveDraft(null);
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
            {supplierFilledIn
              ? 'Chybějící údaje dodavatele se doplní z nastavení. DPH, účet a poznámky zůstávají jako při vystavení.'
              : existing
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
        <form ref={formRef} className="editor__form" onSubmit={(event) => event.preventDefault()} noValidate>
          <div className="form-problem" role="alert">
            {problem ? problem.message : null}
          </div>
          {!supplierComplete ? (
            <div
              id="supplier-notice"
              className={`notice${problem?.targetId === 'supplier-notice' ? ' notice--error' : ''}`}
              tabIndex={-1}
            >
              Na faktuře chybí tvoje údaje: jméno nebo název, adresa a IČO
              {invoice.supplier.vatPayer ? ', u plátce DPH i DIČ' : ''}.{' '}
              <a href={toHash({ name: 'nastaveni' })}>Doplň je v nastavení</a>.
            </div>
          ) : null}
          <section className="card">
            <h2 className="card__title">Odběratel</h2>
            {customers.length > 0 ? (
              <Field label="Vybrat uloženého odběratele" htmlFor="c-past">
                <select
                  id="c-past"
                  className="input"
                  value=""
                  onChange={(event) => {
                    const picked = customers[Number(event.target.value)];
                    if (picked) patchCustomer({ ...picked });
                  }}
                >
                  <option value="">Vybrat ze seznamu</option>
                  {customers.map((saved, index) => (
                    <option key={`${saved.ico}-${saved.name}`} value={index}>
                      {saved.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="grid-2">
              <Field label="Název nebo jméno" htmlFor="c-name" className="span-2" error={errorFor('c-name')}>
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
              {catalog.map((entry) => (
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
                  catalog={catalog}
                  error={errorFor(`i-desc-${item.id}`)}
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
              <p
                id="items-sum"
                className={`items__sum${problem?.targetId === 'items-sum' ? ' items__sum--error' : ''}`}
                tabIndex={-1}
              >
                Celkem k úhradě <strong>{formatCzk(totals.totalCents)}</strong>
              </p>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Termíny a platba</h2>
            <div className="grid-2">
              <Field label="Číslo faktury" htmlFor="f-number" error={errorFor('f-number')}>
                <input
                  id="f-number"
                  className="input"
                  maxLength={LIMITS.text}
                  value={draft.number}
                  onChange={(event) => changeNumber(event.target.value)}
                />
              </Field>
              <Field
                label="Variabilní symbol"
                htmlFor="f-vs"
                hint="Podle něj spáruješ platbu. Nejvýš 10 číslic."
                error={errorFor('f-vs')}
              >
                <input
                  id="f-vs"
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  value={draft.variableSymbol}
                  onChange={(event) => patch({ variableSymbol: event.target.value.replace(/\D/g, '').slice(0, 10) })}
                />
              </Field>
              <Field label="Datum vystavení" htmlFor="f-issue" error={errorFor('f-issue')}>
                <input
                  id="f-issue"
                  className="input"
                  type="date"
                  value={draft.issueDate}
                  onChange={(event) => changeIssueDate(event.target.value)}
                />
              </Field>
              <Field label="Datum splatnosti" htmlFor="f-due" error={errorFor('f-due')}>
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
                  error={errorFor('f-duzp')}
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
            <Field label="Text pod součtem (nepovinné)" htmlFor="f-note" error={errorFor('f-note')}>
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

          <section className="card">
            <h2 className="card__title">Vzhled faktury</h2>
            <TemplatePicker
              name="f-template"
              legend="Šablona"
              value={invoice.appearance.template}
              onChange={(template) =>
                setDraft((current) => ({ ...current, appearance: { ...current.appearance, template } }))
              }
              hint={
                isNew
                  ? 'Barvu, logo a patičku vezme faktura z nastavení. Uložená faktura si vzhled pamatuje.'
                  : 'Barvu, logo a patičku si faktura pamatuje z doby uložení.'
              }
            />
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
          <InvoicePaper invoice={invoice} logo={logoUrl(data.logos, invoice.appearance.logoId)} />
        </aside>
      </div>

      <AdSlot />
    </div>
  );
}
