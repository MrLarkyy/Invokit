import { czechAccountToIban, formatIban } from '../../czech/czechIban';
import { buildSpayd } from '../../czech/spayd';
import { formatCzechDate } from '../../domain/dates';
import type { Invoice } from '../../domain/invoice';
import { paymentResult } from '../../domain/invoicePayment';
import { computeTotals, filledItems, itemTotalCents } from '../../domain/invoiceTotals';
import { formatCzk, formatQuantity } from '../../domain/money';
import { Eyes } from './Eyes';
import { QrCode } from './QrCode';

/**
 * The A4 invoice: live preview in the editor, the detail page and print (see @media print in app.css).
 * It reads only the invoice and its own supplier snapshot, never the current profile.
 */
export function InvoicePaper({ invoice }: { invoice: Invoice }) {
  const { supplier, customer } = invoice;
  const payer = supplier.vatPayer;
  const totals = computeTotals(invoice.items, payer);
  const payment = paymentResult(invoice);
  const iban = czechAccountToIban(supplier.bankAccount);
  const items = filledItems(invoice.items);
  const hasCustomer = customer.name.trim() !== '';
  const zipCity = (zip: string, city: string) => `${zip} ${city}`.trim();

  return (
    <div className="paper-wrap">
      <article className="paper" aria-label={`Faktura ${invoice.number}`}>
        <header className="paper__head">
          <div>
            <h2 className="paper__title">Faktura</h2>
            <p className="paper__kind">{payer ? 'Daňový doklad' : 'Neplátce DPH'}</p>
          </div>
          <div className="paper__number">
            <span>Číslo dokladu</span>
            <strong>{invoice.number || '…'}</strong>
          </div>
        </header>

        <section className="paper__parties">
          <div className={supplier.party.name ? '' : 'is-empty'}>
            <h3>Dodavatel</h3>
            <strong>{supplier.party.name || 'Doplň své údaje v nastavení'}</strong>
            {supplier.party.street ? <span>{supplier.party.street}</span> : null}
            {zipCity(supplier.party.zip, supplier.party.city) ? (
              <span>{zipCity(supplier.party.zip, supplier.party.city)}</span>
            ) : null}
            {supplier.party.ico ? <span>IČO {supplier.party.ico}</span> : null}
            {payer && supplier.party.dic ? <span>DIČ {supplier.party.dic}</span> : null}
            {supplier.email ? <span>{supplier.email}</span> : null}
          </div>
          <div className={hasCustomer ? '' : 'is-empty'}>
            <h3>Odběratel</h3>
            <strong>{hasCustomer ? customer.name : 'Název odběratele'}</strong>
            <span>{customer.street || (hasCustomer ? '' : 'Ulice a číslo')}</span>
            <span>{zipCity(customer.zip, customer.city) || (hasCustomer ? '' : 'PSČ a město')}</span>
            {customer.ico ? <span>IČO {customer.ico}</span> : null}
            {customer.dic ? <span>DIČ {customer.dic}</span> : null}
          </div>
        </section>

        <section className={`paper__meta${payer ? ' paper__meta--payer' : ''}`}>
          <div>
            <span>Vystaveno</span>
            <strong>{formatCzechDate(invoice.issueDate)}</strong>
          </div>
          {payer ? (
            <div>
              <span>DUZP</span>
              <strong>{formatCzechDate(invoice.taxableSupplyDate)}</strong>
            </div>
          ) : null}
          <div>
            <span>Splatnost</span>
            <strong>{formatCzechDate(invoice.dueDate)}</strong>
          </div>
          <div>
            <span>Variabilní symbol</span>
            <strong>{invoice.variableSymbol || '…'}</strong>
          </div>
          <div>
            <span>Účet</span>
            <strong>{supplier.bankAccount || 'doplň v nastavení'}</strong>
          </div>
        </section>

        <table className="paper__items">
          <thead>
            <tr>
              <th>Položka</th>
              <th className="num">Množství</th>
              <th className="num">{payer ? 'Cena bez DPH' : 'Cena za j.'}</th>
              {payer ? <th className="num">DPH</th> : null}
              <th className="num">{payer ? 'Základ' : 'Celkem'}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr className="is-empty">
                <td colSpan={payer ? 5 : 4}>Tady se objeví položky faktury.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description || 'Položka bez názvu'}</td>
                  <td className="num">
                    {formatQuantity(item.quantity)} {item.unit}
                  </td>
                  <td className="num">{formatCzk(item.unitPriceCents)}</td>
                  {payer ? <td className="num">{item.vatRate} %</td> : null}
                  <td className="num">{formatCzk(itemTotalCents(item))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <section className="paper__totals">
          {payer ? (
            <table className="paper__vat">
              <thead>
                <tr>
                  <th>Sazba DPH</th>
                  <th className="num">Základ</th>
                  <th className="num">DPH</th>
                </tr>
              </thead>
              <tbody>
                {totals.rates.map((rate) => (
                  <tr key={rate.rate}>
                    <td>{rate.rate} %</td>
                    <td className="num">{formatCzk(rate.baseCents)}</td>
                    <td className="num">{formatCzk(rate.vatCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Celkem</th>
                  <td className="num">{formatCzk(totals.baseCents)}</td>
                  <td className="num">{formatCzk(totals.vatCents)}</td>
                </tr>
              </tfoot>
            </table>
          ) : null}
          <div className="paper__sum">
            <span>Celkem k úhradě</span>
            <strong>{formatCzk(totals.totalCents)}</strong>
          </div>
        </section>

        <section className="paper__pay">
          {payment.request ? (
            <div className="paper__qr">
              <QrCode text={buildSpayd(payment.request)} />
              <div>
                <strong>QR platba</strong>
                <span>Naskenuj v aplikaci své banky.</span>
                <span className="paper__iban">IBAN {formatIban(payment.request.iban)}</span>
                {invoice.paymentMethod ? <span>Způsob úhrady: {invoice.paymentMethod}</span> : null}
              </div>
            </div>
          ) : (
            <div className="paper__qr paper__qr--off">
              <div>
                <strong>{invoice.paymentMethod || 'Platba převodem'}</strong>
                <span>
                  Účet {supplier.bankAccount || '…'}, variabilní symbol {invoice.variableSymbol || '…'}
                </span>
                {iban ? <span className="paper__iban">IBAN {formatIban(iban)}</span> : null}
                {payment.problem ? <span className="paper__qr-why">{payment.problem}</span> : null}
              </div>
            </div>
          )}
          {invoice.note ? <p className="paper__note">{invoice.note}</p> : null}
        </section>

        <footer className="paper__foot">
          <span>{supplier.registryNote}</span>
          <span className="paper__brand">
            <Eyes size={9} variant="outline" mood="watch" />
            Vystaveno v Invoo · invoo.cz
          </span>
        </footer>

        {invoice.paid ? (
          <div className="paper__stamp">
            <Eyes size={14} mood="happy" variant="outline" />
            {invoice.paidAt ? `Zaplaceno ${formatCzechDate(invoice.paidAt)}` : 'Zaplaceno'}
          </div>
        ) : null}
      </article>
    </div>
  );
}
