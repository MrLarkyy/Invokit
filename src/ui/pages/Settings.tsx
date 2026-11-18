import { useRef, useState } from 'react';
import { czechAccountToIban, formatIban, isValidIban } from '../../czech/czechIban';
import { isValidDic } from '../../czech/dic';
import { isValidIco } from '../../czech/ico';
import { formatCzechDate } from '../../domain/dates';
import type { CatalogItem, Party } from '../../domain/invoice';
import { isAccent, type InvoiceAppearance } from '../../domain/invoiceAppearance';
import { LIMITS } from '../../domain/limits';
import { logoUrl, saveSupplierLogo } from '../../domain/logos';
import { createBlankInvoice } from '../../domain/newInvoice';
import { byDescription, byName } from '../../domain/records';
import { emptyProfile, profileAccount, savedProfile, type SupplierProfile } from '../../domain/supplierProfile';
import type { AppData } from '../../storage/appData';
import { backupFileName, downloadBackup, readBackup } from '../../storage/backupFile';
import { newRowId, todayIso } from '../clock';
import { CUSTOMERS, czechPlural, INVOICES } from '../czechPlural';
import { AdSlot } from '../components/AdSlot';
import { Field } from '../components/Field';
import { IconDownload, IconShield, IconUpload } from '../components/Icons';
import { InvoicePaper } from '../components/InvoicePaper';
import { SavedRecords } from '../components/SavedRecords';
import { TemplatePicker } from '../components/TemplatePicker';
import { useToast } from '../components/Toast';
import { Toggle } from '../components/Toggle';
import { LOGO_ERRORS, readLogoFile } from '../logoFile';
import { previewInvoice } from '../previewInvoice';
import { navigate } from '../router';
import { useStore } from '../StoreProvider';
import { notStored } from '../texts';
import { useDocumentTitle } from '../useDocumentTitle';

const BANKS: [string, string][] = [
  ['0100', 'Komerční banka'],
  ['0300', 'ČSOB'],
  ['0600', 'MONETA Money Bank'],
  ['0710', 'Česká národní banka'],
  ['0800', 'Česká spořitelna'],
  ['2010', 'Fio banka'],
  ['2700', 'UniCredit Bank'],
  ['3030', 'Air Bank'],
  ['5500', 'Raiffeisenbank'],
  ['6210', 'mBank'],
];

// The colour picker shows the Invoo orange while no accent is chosen.
const DEFAULT_ACCENT = '#ff5b1f';

/** The profile without its logo id: the logo is edited apart from the form and compared as an image. */
const withoutLogoId = (profile: SupplierProfile) =>
  JSON.stringify({ ...profile, appearance: { ...profile.appearance, logoId: null } });

interface PendingRestore {
  fileName: string;
  data: AppData;
}

function ibanPreview(profile: SupplierProfile): string {
  const account = profileAccount(profile);
  if (!account) return 'Doplň číslo účtu a banku';
  const iban = czechAccountToIban(account);
  return iban && isValidIban(iban) ? formatIban(iban) : 'Číslo účtu neprošlo kontrolou.';
}

export function Settings() {
  const { data, dispatch, loadDraft, saveDraft, persistent, canWrite, lastWriteFailed, legacyBlocking, newer } =
    useStore();
  const toast = useToast();
  const storing = persistent && canWrite && !lastWriteFailed && !legacyBlocking;
  const [saved] = useState(() => savedProfile(data) ?? emptyProfile());
  const [form, setForm] = useState<SupplierProfile>(saved);
  const [logo, setLogo] = useState(() => logoUrl(data.logos, saved.appearance.logoId));
  const [logoError, setLogoError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  useDocumentTitle('Nastavení');

  const patch = (changes: Partial<SupplierProfile>) => setForm((current) => ({ ...current, ...changes }));
  const patchParty = (changes: Partial<Party>) =>
    setForm((current) => ({ ...current, party: { ...current.party, ...changes } }));
  const patchAppearance = (changes: Partial<InvoiceAppearance>) =>
    setForm((current) => ({ ...current, appearance: { ...current.appearance, ...changes } }));
  const current = data.supplier ?? saved;
  const dirty =
    withoutLogoId(form) !== withoutLogoId(current) || logo !== logoUrl(data.logos, current.appearance.logoId);
  const banks =
    form.bankCode && !BANKS.some(([code]) => code === form.bankCode)
      ? [...BANKS, [form.bankCode, 'jiná banka'] as [string, string]]
      : BANKS;

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      setLogo(await readLogoFile(file));
      setLogoError(null);
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : LOGO_ERRORS.unreadable);
    } finally {
      if (logoInput.current) logoInput.current.value = '';
    }
  };

  const save = () => {
    try {
      // The same check the store makes: a logo it cannot keep is reported here instead of a save that does nothing.
      saveSupplierLogo(data, form, logo);
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : LOGO_ERRORS.unreadable);
      return;
    }
    const done = dispatch({ type: 'supplier/save', supplier: form, logo });
    if (done.result === 'rejected') {
      // Another tab took the last free logo slot after this page checked.
      setLogoError(done.reason);
    } else if (done.result === 'stored') {
      toast('Údaje jsou uložené. Použijí se na nových fakturách, vystavené zůstávají beze změny.', 'happy');
    } else {
      toast(notStored('údaje platí'));
    }
  };

  const exportBackup = () => {
    const today = todayIso();
    downloadBackup({ ...data, lastBackupAt: today }, today);
    dispatch({ type: 'backup/exported', at: today });
    toast(`Záloha se stáhla jako ${backupFileName(today)}.`, 'happy');
  };

  const clearFile = () => {
    if (fileInput.current) fileInput.current.value = '';
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending({ fileName: file.name, data: await readBackup(file) });
    } catch (error) {
      setPending(null);
      clearFile();
      toast(error instanceof Error ? error.message : 'Soubor se nepodařilo přečíst.');
    }
  };

  const confirmRestore = () => {
    if (!pending) return;
    // A confirmed restore also resumes saving that was off: the restored data replaces the unreadable data.
    const stored = dispatch({ type: 'backup/restore', data: pending.data }).result === 'stored';
    const restored = savedProfile(pending.data) ?? emptyProfile();
    setForm(restored);
    setLogo(logoUrl(pending.data.logos, restored.appearance.logoId));
    setLogoError(null);
    if (stored) toast(`Data jsou obnovená ze souboru ${pending.fileName}.`, 'happy');
    else toast(notStored(`data ze souboru ${pending.fileName} zůstanou`));
    setPending(null);
    clearFile();
  };

  const newInvoiceFor = (customer: Party) => {
    const draft = loadDraft() ?? createBlankInvoice(data, todayIso(), newRowId);
    saveDraft({ ...draft, customer: { ...customer } });
    navigate({ name: 'nova' });
  };

  const deleteCustomer = (customer: Party) => {
    if (!window.confirm(`Smazat uloženého odběratele ${customer.name}? Vystavené faktury zůstanou.`)) return;
    dispatch({ type: 'customer/delete', customer });
  };

  const deleteItem = (item: CatalogItem) => {
    if (!window.confirm(`Smazat uloženou položku ${item.description}? Vystavené faktury zůstanou.`)) return;
    dispatch({ type: 'catalog/delete', description: item.description });
  };

  return (
    <div className="page container">
      <header className="page__head">
        <div>
          <h1>Nastavení</h1>
          <p className="page__lead">Údaje o tobě se propisují na každou novou fakturu. Vyplníš je jednou.</p>
        </div>
      </header>

      <div className="settings">
        <form className="settings__form" onSubmit={(event) => event.preventDefault()} noValidate>
          <section className="card">
            <h2 className="card__title">Dodavatel</h2>
            <div className="grid-2">
              <Field label="Jméno nebo název firmy" htmlFor="s-name" className="span-2">
                <input
                  id="s-name"
                  className="input"
                  autoComplete="organization"
                  maxLength={LIMITS.text}
                  value={form.party.name}
                  onChange={(event) => patchParty({ name: event.target.value })}
                />
              </Field>
              <Field
                label="IČO"
                htmlFor="s-ico"
                hint={
                  form.party.ico && !isValidIco(form.party.ico) ? 'IČO neprošlo kontrolou, zkontroluj ho.' : undefined
                }
              >
                <input
                  id="s-ico"
                  className="input"
                  inputMode="numeric"
                  maxLength={LIMITS.text}
                  value={form.party.ico}
                  onChange={(event) => patchParty({ ico: event.target.value })}
                />
              </Field>
              <Field label="E-mail (nepovinné)" htmlFor="s-email">
                <input
                  id="s-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  maxLength={LIMITS.text}
                  value={form.email}
                  onChange={(event) => patch({ email: event.target.value })}
                />
              </Field>
              <Field label="Ulice a číslo" htmlFor="s-street" className="span-2">
                <input
                  id="s-street"
                  className="input"
                  autoComplete="street-address"
                  maxLength={LIMITS.text}
                  value={form.party.street}
                  onChange={(event) => patchParty({ street: event.target.value })}
                />
              </Field>
              <Field label="PSČ" htmlFor="s-zip">
                <input
                  id="s-zip"
                  className="input"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={LIMITS.text}
                  value={form.party.zip}
                  onChange={(event) => patchParty({ zip: event.target.value })}
                />
              </Field>
              <Field label="Město" htmlFor="s-city">
                <input
                  id="s-city"
                  className="input"
                  autoComplete="address-level2"
                  maxLength={LIMITS.text}
                  value={form.party.city}
                  onChange={(event) => patchParty({ city: event.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">DPH</h2>
            <div className="segmented" role="group" aria-label="Plátce DPH">
              <button type="button" aria-pressed={!form.vatPayer} onClick={() => patch({ vatPayer: false })}>
                Neplátce DPH
              </button>
              <button type="button" aria-pressed={form.vatPayer} onClick={() => patch({ vatPayer: true })}>
                Plátce DPH
              </button>
            </div>
            {form.vatPayer ? (
              <Field
                label="DIČ"
                htmlFor="s-dic"
                hint={
                  form.party.dic && !isValidDic(form.party.dic)
                    ? 'České DIČ má tvar CZ a 8 až 10 číslic.'
                    : 'U položek se objeví sazby DPH a na faktuře rozpis daně a DUZP.'
                }
              >
                <input
                  id="s-dic"
                  className="input"
                  placeholder="CZ12345678"
                  maxLength={LIMITS.text}
                  value={form.party.dic}
                  onChange={(event) => patchParty({ dic: event.target.value })}
                />
              </Field>
            ) : (
              <p className="field__hint">Na faktuře bude uvedeno „Neplátce DPH“ a ceny se nezdaňují.</p>
            )}
            <Field
              label="Text v patičce faktury"
              htmlFor="s-note"
              hint="Například zápis v živnostenském nebo obchodním rejstříku."
            >
              <input
                id="s-note"
                className="input"
                maxLength={LIMITS.registryNote}
                value={form.registryNote}
                onChange={(event) => patch({ registryNote: event.target.value })}
              />
            </Field>
          </section>

          <section className="card">
            <h2 className="card__title">Bankovní účet</h2>
            <div className="account">
              <Field label="Předčíslí" htmlFor="s-prefix">
                <input
                  id="s-prefix"
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.accountPrefix}
                  onChange={(event) => patch({ accountPrefix: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                />
              </Field>
              <Field label="Číslo účtu" htmlFor="s-account">
                <input
                  id="s-account"
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.accountNumber}
                  onChange={(event) => patch({ accountNumber: event.target.value.replace(/\D/g, '').slice(0, 10) })}
                />
              </Field>
              <Field label="Banka" htmlFor="s-bank">
                <select
                  id="s-bank"
                  className="input"
                  value={form.bankCode}
                  onChange={(event) => patch({ bankCode: event.target.value })}
                >
                  <option value="">Vybrat banku</option>
                  {banks.map(([code, name]) => (
                    <option key={code} value={code}>
                      {code} · {name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="IBAN pro QR platbu"
              htmlFor="s-iban"
              hint="Počítá se sám z čísla účtu. Na faktuře se z něj skládá QR kód."
            >
              <input id="s-iban" className="input input--mono" readOnly value={ibanPreview(form)} />
            </Field>
          </section>

          <section className="card">
            <h2 className="card__title">Vzhled faktury</h2>
            <p className="field__hint">
              Platí pro nové faktury. Každá uložená faktura si vzhled pamatuje, změna tady ji nezmění.
            </p>
            <TemplatePicker
              name="s-template"
              legend="Šablona"
              value={form.appearance.template}
              onChange={(template) => patchAppearance({ template })}
            />
            <div className="appearance__accent">
              <Field
                label="Barva zvýraznění"
                htmlFor="s-accent"
                hint={`${form.appearance.accent ? 'Vlastní barva.' : 'Výchozí barva šablony.'} Barví jen plochy, text na nich zůstane čitelný. Klasik se tiskne černobíle.`}
              >
                <input
                  id="s-accent"
                  className="input input--color"
                  type="color"
                  value={form.appearance.accent ?? DEFAULT_ACCENT}
                  onChange={(event) => {
                    const accent = event.target.value.toLowerCase();
                    if (isAccent(accent)) patchAppearance({ accent });
                  }}
                />
              </Field>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={form.appearance.accent === null}
                onClick={() => patchAppearance({ accent: null })}
              >
                Výchozí barva
              </button>
            </div>
            <div className="appearance__logo">
              <span className="field__label">Logo (nepovinné)</span>
              <div className="appearance__logo-row">
                {logo ? (
                  <img className="appearance__logo-thumb" src={logo} alt="Vybrané logo" />
                ) : (
                  <span className="appearance__logo-none">Bez loga</span>
                )}
                <input
                  ref={logoInput}
                  id="s-logo"
                  className="visually-hidden file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-describedby="s-logo-hint"
                  aria-invalid={logoError ? true : undefined}
                  onChange={(event) => void pickLogo(event.target.files?.[0])}
                />
                <label className="btn btn--outline btn--sm" htmlFor="s-logo">
                  {logo ? 'Změnit logo' : 'Vybrat logo'}
                </label>
                {logo ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setLogo(null);
                      setLogoError(null);
                    }}
                  >
                    Odebrat logo
                  </button>
                ) : null}
              </div>
              {logoError ? (
                <p className="field__hint field__hint--error" id="s-logo-hint" role="alert">
                  {logoError}
                </p>
              ) : (
                <p className="field__hint" id="s-logo-hint">
                  PNG, JPEG nebo WebP do 5 MB, zmenší se samo. Zůstane jen v tomto prohlížeči a v záloze.
                </p>
              )}
            </div>
            <Toggle
              checked={form.appearance.brandFooter}
              onChange={(brandFooter) => patchAppearance({ brandFooter })}
              label="Patička Vystaveno v Invoo"
              hint="Malý řádek „Vystaveno v Invoo · invoo.cz“ dole na faktuře."
            />
            <figure className="appearance__preview" aria-label="Náhled vzhledu faktury">
              <InvoicePaper invoice={previewInvoice(form, todayIso())} logo={logo} />
            </figure>
          </section>

          <div className="editor__save">
            <button type="button" className="btn btn--primary btn--lg" onClick={save} disabled={!dirty}>
              Uložit údaje
            </button>
            {dirty ? <span className="field__hint">Máš neuložené změny.</span> : null}
          </div>

          <SavedRecords
            customers={[...data.customers].sort(byName)}
            items={[...data.items].sort(byDescription)}
            onNewInvoice={newInvoiceFor}
            onDeleteCustomer={deleteCustomer}
            onDeleteItem={deleteItem}
          />
        </form>

        <aside className="settings__side">
          <section className="card card--dark">
            <h2 className="card__title">
              <IconShield />
              Data a záloha
            </h2>
            <p>
              {storing ? 'Všechno je uložené jen v tomhle prohlížeči' : 'Teď se nic neukládá'}:{' '}
              {czechPlural(data.invoices.length, INVOICES)}, tvoje údaje, uložení odběratelé a položky. Když smažeš data
              prohlížeče, zmizí. Zálohuj si je do souboru.
            </p>
            <p className="backup__last">
              {data.lastBackupAt
                ? `Poslední záloha: ${formatCzechDate(data.lastBackupAt)}`
                : 'Zálohu jsi zatím neudělal.'}
            </p>
            <button type="button" className="btn btn--primary" onClick={exportBackup}>
              <IconDownload size={18} />
              Stáhnout zálohu (JSON)
            </button>
            <input
              ref={fileInput}
              id="restore-file"
              className="visually-hidden file-input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void pickFile(event.target.files?.[0])}
            />
            <label className="btn btn--light" htmlFor="restore-file">
              <IconUpload size={18} />
              Obnovit ze souboru
            </label>
            {pending ? (
              <div className="restore" role="alert">
                <p>
                  Soubor <strong>{pending.fileName}</strong>: {czechPlural(pending.data.invoices.length, INVOICES)},{' '}
                  {czechPlural(pending.data.customers.length, CUSTOMERS)}. Obnovit data? Přepíše to všechno, co je teď
                  uložené.
                  {canWrite || newer ? null : ' Přepíše to i původní nečitelná data: nejdřív si je nahoře stáhni.'}
                </p>
                <div className="restore__actions">
                  <button type="button" className="btn btn--primary btn--sm" onClick={confirmRestore}>
                    Obnovit data
                  </button>
                  <button
                    type="button"
                    className="btn btn--light btn--sm"
                    onClick={() => {
                      setPending(null);
                      clearFile();
                    }}
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            ) : null}
            <p className="backup__last">Před obnovou si raději stáhni zálohu současných dat.</p>
          </section>

          <AdSlot />
        </aside>
      </div>
    </div>
  );
}
